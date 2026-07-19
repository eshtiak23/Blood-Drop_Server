import express from "express";
import Request from "../models/Request.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import { sendBloodRequestEmails, sendEmail } from "../utils/email.js";
import { validateRequestForm } from "../utils/validate.js";

const router = express.Router();

// GET /api/requests/search — MUST be before /:id to avoid param collision
router.get("/search", auth, async (req, res) => {
  try {
    const { bloodGroup, district, urgency } = req.query;
    let query = {};
    if (bloodGroup) query.patientBloodGroup = bloodGroup;
    if (district) query.district = district;
    if (urgency) query.urgency = urgency;
    const requests = await Request.find(query).populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup").sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests/my — MUST be before /:id
router.get("/my", auth, async (req, res) => {
  try {
    const requests = await Request.find({ requester: req.user._id }).populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup").sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests
router.get("/", auth, async (req, res) => {
  try {
    const requests = await Request.find().populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup").sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests/test-email — send test email to verify SMTP works
router.get("/test-email", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email name");
    if (!user?.email) return res.status(400).json({ error: "No email on your account. Update your profile first." });
    await sendEmail({
      to: user.email,
      subject: "🩸 LifeDrop — Email Test",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <div style="background:linear-gradient(135deg,#EF4444,#DC2626);padding:24px;border-radius:16px 16px 0 0;text-align:center;">
            <div style="font-size:32px;">✅</div>
            <h1 style="color:white;margin:8px 0 0;font-size:20px;">Email Works!</h1>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;">
            <p style="font-size:15px;color:#374151;">Hi <strong>${user.name}</strong>,</p>
            <p style="font-size:14px;color:#6B7280;">Your Gmail SMTP is configured correctly on LifeDrop. Blood request notifications will be sent to <strong>${user.email}</strong>.</p>
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

// GET /api/requests/:id — AFTER /search, /my, and /test-email
router.get("/:id", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).populate("requester", "name email photo").populate("acceptedBy", "name phone bloodGroup");
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json({ request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/requests
router.post("/", auth, async (req, res) => {
  try {
    const { valid, errors } = validateRequestForm(req.body);
    if (!valid) {
      const firstErr = Object.values(errors)[0];
      return res.status(400).json({ error: firstErr, errors });
    }

    const request = await Request.create({ ...req.body, requester: req.user._id });
    const populated = await request.populate("requester", "name email");

    // Notify all users with matching blood group (excluding the requester)
    const matchingUsers = await User.find({
      _id: { $ne: req.user._id },
      bloodGroup: req.body.patientBloodGroup,
    }).select("_id");

    if (matchingUsers.length > 0) {
      const notifications = matchingUsers.map((u) => ({
        userId: u._id,
        type: "blood_request",
        title: "New Blood Request",
        message: `${req.user.name} needs ${req.body.unitsRequired} unit(s) of ${req.body.patientBloodGroup} blood at ${req.body.hospital || req.body.district}`,
      }));
      await Notification.insertMany(notifications);
    }

    // Respond immediately — emails go out in the background
    res.status(201).json({ request: populated });

    // Fire-and-forget: send emails without blocking the response
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

// PATCH /api/requests/:id/accept
router.patch("/:id/accept", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "open") return res.status(400).json({ error: "Request is not open" });
    if (request.requester.toString() === req.user._id.toString()) return res.status(400).json({ error: "Cannot accept your own request" });
    request.status = "accepted";
    request.acceptedBy = req.user._id;
    await request.save();
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

// PATCH /api/requests/:id/complete
router.patch("/:id/complete", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "accepted") return res.status(400).json({ error: "Request cannot be completed in its current state" });
    const userId = req.user._id.toString();
    if (userId !== request.requester.toString() && userId !== request.acceptedBy?.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }
    request.status = "completed";
    await request.save();
    // Notify requester
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
    // Notify donor
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

// DELETE /api/requests/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.requester.toString() !== req.user._id.toString()) return res.status(403).json({ error: "Not authorized" });
    await Request.findByIdAndDelete(req.params.id);
    res.json({ message: "Request deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
