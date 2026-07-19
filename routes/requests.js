/**
 * requests.js — Blood Request Routes
 *
 * Handles all blood donation request operations:
 * - Creating requests (notifies matching blood group users)
 * - Viewing requests (all, mine, search, by ID)
 * - Accepting requests (donor agrees to donate)
 * - Completing requests (donation done)
 * - Deleting requests (requester only)
 *
 * IMPORTANT: Route ordering matters!
 * Express matches routes top-to-bottom. Static routes (/search, /my)
 * MUST come before parameter routes (/:id) or Express will try to
 * match "search" as an ID and fail.
 *
 * Email notifications:
 * When a request is created, matching donors are notified via:
 * 1. In-app Notification (stored in MongoDB)
 * 2. Email via Resend API (sent in background, fire-and-forget)
 *
 * Called by: RequestListPage, RequestDetailPage, CreateRequestPage, DashboardPage
 */

import express from "express";
import Request from "../models/Request.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import { sendBloodRequestEmails, sendEmail } from "../utils/email.js";
import { validateRequestForm } from "../utils/validate.js";

const router = express.Router();

/**
 * GET /api/requests/search — Search blood requests
 * Purpose: Filter requests by blood group, district, and urgency level
 * Called by: RequestListPage when user applies filters
 * Auth: Required (JWT) — users must be logged in to search requests
 *
 * Example: GET /api/requests/search?bloodGroup=A+&district=Dhaka&urgency=critical
 */
router.get("/search", auth, async (req, res) => {
  try {
    const { bloodGroup, district, urgency } = req.query;
    let query = {};
    if (bloodGroup) query.patientBloodGroup = bloodGroup;
    if (district) query.district = district;
    if (urgency) query.urgency = urgency;
    // Populate requester name/email/photo for display, and acceptedBy for donor info
    const requests = await Request.find(query).populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup").sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/requests/my — Get current user's own requests
 * Purpose: Show only the requests created by the logged-in user
 * Called by: RequestListPage (My Requests tab), DashboardPage
 * Auth: Required — uses req.user._id to filter
 */
router.get("/my", auth, async (req, res) => {
  try {
    const requests = await Request.find({ requester: req.user._id }).populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup").sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/requests — Get ALL blood requests
 * Purpose: Show all open requests for donors to browse
 * Called by: RequestListPage (All Requests tab)
 * Auth: Required — only logged-in users can see requests
 */
router.get("/", auth, async (req, res) => {
  try {
    const requests = await Request.find().populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup").sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/requests/test-email — Send test email
 * Purpose: Debug email delivery by sending a test email to the current user
 * Called by: Developer/admin for testing Resend API configuration
 * Auth: Required
 */
router.get("/test-email", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email name");
    if (!user?.email) return res.status(400).json({ error: "No email on your account. Update your profile first." });
    await sendEmail({
      to: user.email,
      subject: "LifeDrop — Email Test",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#EF4444,#DC2626);padding:24px;border-radius:16px 16px 0 0;text-align:center;">
            <div style="font-size:32px;">✅</div>
            <h1 style="color:white;margin:8px 0 0;font-size:20px;">Email Works!</h1>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;">
            <p style="font-size:15px;color:#374151;">Hi <strong>${user.name}</strong>,</p>
            <p style="font-size:14px;color:#6B7280;">Your email is configured correctly on LifeDrop.</p>
          </div>
        </div>
      `,
    });
    res.json({ message: `Test email sent to ${user.email}` });
  } catch (err) {
    console.error("[Email] Test failed:", err.message);
    res.status(500).json({ error: `SMTP failed: ${err.message}` });
  }
});

/**
 * GET /api/requests/:id — Get single request details
 * Purpose: View full details of a specific blood request
 * Called by: RequestDetailPage when user clicks on a request
 * Auth: Required
 * NOTE: This route MUST come after /search, /my, and /test-email
 *       Otherwise Express would match "search" as an :id parameter
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup");
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json({ request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/requests — Create a new blood request
 * Purpose: User creates a request for blood donation
 * Called by: CreateRequestPage form submission
 * Auth: Required
 *
 * Flow:
 * 1. Validate form data (patient name, blood group, hospital, etc.)
 * 2. Create the request in database
 * 3. Find all users with matching blood group (excluding requester)
 * 4. Create in-app Notification for each matching user
 * 5. Send response immediately (don't wait for emails)
 * 6. Send emails in background (fire-and-forget pattern)
 *
 * Fire-and-forget: The API responds to the client FIRST, then sends emails
 * in the background. This prevents slow email delivery from delaying the user
 * experience. If emails fail, the request is still created successfully.
 */
router.post("/", auth, async (req, res) => {
  try {
    // Step 1: Validate form data using shared validator
    const { valid, errors } = validateRequestForm(req.body);
    if (!valid) {
      const firstErr = Object.values(errors)[0];
      return res.status(400).json({ error: firstErr, errors });
    }

    // Step 2: Create the request with requester reference
    const request = await Request.create({ ...req.body, requester: req.user._id });
    const populated = await request.populate("requester", "name email");

    // Step 3: Find all users with matching blood group (for notification)
    const matchingUsers = await User.find({
      _id: { $ne: req.user._id },           // Exclude the requester themselves
      bloodGroup: req.body.patientBloodGroup, // Same blood group needed
    }).select("_id");

    // Step 4: Create in-app notifications for each matching user
    if (matchingUsers.length > 0) {
      const notifications = matchingUsers.map((u) => ({
        userId: u._id,
        type: "blood_request",
        title: "New Blood Request",
        message: `${req.user.name} needs ${req.body.unitsRequired} unit(s) of ${req.body.patientBloodGroup} blood at ${req.body.hospital || req.body.district}`,
      }));
      await Notification.insertMany(notifications);
    }

    // Step 5: Respond immediately — don't wait for emails
    res.status(201).json({ request: populated });

    // Step 6: Fire-and-forget email sending (background, non-blocking)
    // This runs AFTER the response is sent to the client
    (async () => {
      try {
        const donorsWithEmail = await User.find({
          _id: { $ne: req.user._id },
          bloodGroup: req.body.patientBloodGroup,
          email: { $exists: true, $ne: "" },
        }).select("email name");
        console.log(`[Email] ${donorsWithEmail.length} donors with email to notify for ${req.body.patientBloodGroup}`);

        await sendBloodRequestEmails(donorsWithEmail, {
          patientBloodGroup: req.body.patientBloodGroup,
          patientName: req.body.patientName,
          hospital: req.body.hospital,
          area: req.body.area,
          district: req.body.district,
          unitsRequired: req.body.unitsRequired,
          urgency: req.body.urgency,
          contactNumber: req.body.contactNumber,
        });
      } catch (err) {
        console.error("[Email] Background error:", err.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/requests/:id/accept — Donor accepts a blood request
 * Purpose: A donor agrees to donate blood for this request
 * Called by: RequestDetailPage "Accept" button
 * Auth: Required — donor must be logged in
 *
 * Checks:
 * - Request exists
 * - Request status is "open" (not already accepted/completed)
 * - Requester is not accepting their own request
 *
 * Side effects:
 * - Sets status to "accepted"
 * - Records acceptedBy (the donor)
 * - Creates notification for the requester
 */
router.patch("/:id/accept", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "open") return res.status(400).json({ error: "Request is not open" });
    if (request.requester.toString() === req.user._id.toString()) return res.status(400).json({ error: "Cannot accept your own request" });

    // Update request status and record the donor
    request.status = "accepted";
    request.acceptedBy = req.user._id;
    await request.save();

    // Notify the requester that someone accepted their request
    // Wrapped in try-catch so notification failure doesn't break the accept
    try {
      await Notification.create({
        userId: request.requester,
        type: "request_accepted",
        title: "Request Accepted",
        message: `${req.user.name} (${req.user.phone}) accepted your blood request for ${request.patientName}`,
      });
    } catch (notifErr) {
      console.error("[Notification] Failed to create accept notification:", notifErr.message);
    }

    const populated = await request.populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup");
    res.json({ request: populated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/requests/:id/complete — Mark request as completed
 * Purpose: Either the requester or donor marks the donation as done
 * Called by: RequestDetailPage "Mark Complete" button
 * Auth: Required — only requester or acceptedBy can complete
 *
 * Side effects:
 * - Sets status to "completed"
 * - Notifies both requester AND donor
 */
router.patch("/:id/complete", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "accepted") return res.status(400).json({ error: "Request cannot be completed in its current state" });

    // Only requester or the donor who accepted can complete
    const userId = req.user._id.toString();
    if (userId !== request.requester.toString() && userId !== request.acceptedBy?.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    request.status = "completed";
    await request.save();

    // Notify requester (wrapped in try-catch for safety)
    try {
      await Notification.create({
        userId: request.requester,
        type: "request_completed",
        title: "Request Completed",
        message: `Your blood request for ${request.patientName} has been completed`,
      });
    } catch (notifErr) {
      console.error("[Notification] Failed to create complete notification for requester:", notifErr.message);
    }

    // Notify donor (if different from the person completing)
    if (request.acceptedBy && request.acceptedBy.toString() !== userId) {
      try {
        await Notification.create({
          userId: request.acceptedBy,
          type: "request_completed",
          title: "Request Completed",
          message: `The blood request for ${request.patientName} has been marked as completed`,
        });
      } catch (notifErr) {
        console.error("[Notification] Failed to create complete notification for donor:", notifErr.message);
      }
    }

    const populated = await request.populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup");
    res.json({ request: populated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/requests/:id — Delete a blood request
 * Purpose: Requester removes their own request
 * Called by: RequestDetailPage "Delete" button, RequestListPage
 * Auth: Required — only the person who created it can delete
 *
 * Note: Console.error is used for logging deletion failures
 * so we can debug issues in production logs on Render.
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.requester.toString() !== req.user._id.toString()) return res.status(403).json({ error: "Not authorized" });
    await Request.findByIdAndDelete(req.params.id);
    res.json({ message: "Request deleted" });
  } catch (err) {
    console.error("[Delete] Failed to delete request:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
