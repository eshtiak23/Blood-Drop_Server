/**
 * friends.js — Friend/Connection Request Routes
 *
 * Handles connection requests between users. When accepted,
 * both users can see each other's phone numbers.
 *
 * Endpoints:
 *   POST   /api/friends/send/:userId       → Send connection request
 *   PATCH  /api/friends/accept/:requestId   → Accept a request
 *   PATCH  /api/friends/reject/:requestId   → Reject a request
 *   DELETE /api/friends/:requestId          → Withdraw/cancel a request
 *   GET    /api/friends/status/:userId      → Check status with a user
 *   GET    /api/friends                     → List all friends (accepted)
 *   GET    /api/friends/pending             → List pending requests (received)
 */

import express from "express";
import auth from "../middleware/auth.js";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = express.Router();
router.use(auth);

/**
 * GET /api/friends/pending — List pending requests received by current user
 * Must be before /:requestId to avoid param collision
 */
router.get("/pending", async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user._id,
      status: "pending",
    })
      .populate("sender", "name photo bloodGroup district area")
      .sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/friends — List all accepted friends
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user._id;
    const sent = await FriendRequest.find({ sender: userId, status: "accepted" })
      .populate("receiver", "name photo bloodGroup district area phone");
    const received = await FriendRequest.find({ receiver: userId, status: "accepted" })
      .populate("sender", "name photo bloodGroup district area phone");

    const friends = [
      ...sent.map((r) => ({ ...r.toObject(), friend: r.receiver })),
      ...received.map((r) => ({ ...r.toObject(), friend: r.sender })),
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ friends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/friends/status/:userId — Check connection status with another user
 * Returns: { status: "none" | "pending_sent" | "pending_received" | "accepted", requestId? }
 */
router.get("/status/:userId", async (req, res) => {
  try {
    const userId = req.user._id;
    const otherId = req.params.userId;

    // Check sent request
    const sent = await FriendRequest.findOne({ sender: userId, receiver: otherId });
    if (sent) {
      return res.json({ status: sent.status === "accepted" ? "accepted" : "pending_sent", requestId: sent._id });
    }

    // Check received request
    const received = await FriendRequest.findOne({ sender: otherId, receiver: userId });
    if (received) {
      return res.json({ status: received.status === "accepted" ? "accepted" : "pending_received", requestId: received._id });
    }

    res.json({ status: "none" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/friends/send/:userId — Send a connection request
 * If the other user already sent one, auto-accept (mutual connection)
 */
router.post("/send/:userId", async (req, res) => {
  try {
    const senderId = req.user._id;
    const receiverId = req.params.userId;

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ error: "Cannot send request to yourself" });
    }

    const receiver = await User.findById(receiverId).select("name");
    if (!receiver) return res.status(404).json({ error: "User not found" });

    // Check if receiver already sent a request to sender — auto-accept
    const existingReverse = await FriendRequest.findOne({
      sender: receiverId,
      receiver: senderId,
      status: "pending",
    });

    if (existingReverse) {
      existingReverse.status = "accepted";
      await existingReverse.save();

      // Notify the original sender that it was auto-accepted
      try {
        await Notification.create({
          userId: receiverId,
          type: "friend_accepted",
          title: "Connection Accepted",
          message: `${req.user.name} accepted your connection request`,
          link: "/connect",
        });
      } catch (notifErr) {
        console.error("[Notification] Failed to create auto-accept notification:", notifErr.message);
      }

      return res.json({ request: existingReverse, autoAccepted: true });
    }

    // Check if already connected
    const alreadyConnected = await FriendRequest.findOne({
      $or: [
        { sender: senderId, receiver: receiverId, status: "accepted" },
        { sender: receiverId, receiver: senderId, status: "accepted" },
      ],
    });
    if (alreadyConnected) {
      return res.status(400).json({ error: "Already connected" });
    }

    // Check for existing pending request from sender
    const existingPending = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: "pending",
    });
    if (existingPending) {
      return res.status(400).json({ error: "Request already sent" });
    }

    const request = await FriendRequest.create({ sender: senderId, receiver: receiverId });

    // Notify receiver
    try {
      await Notification.create({
        userId: receiverId,
        type: "friend_request",
        title: "Connection Request",
        message: `${req.user.name} wants to connect with you`,
        link: "/connect",
      });
    } catch (notifErr) {
      console.error("[Notification] Failed to create friend request notification:", notifErr.message);
    }

    res.status(201).json({ request });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Request already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/friends/accept/:requestId — Accept a connection request
 */
router.patch("/accept/:requestId", async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request already processed" });
    }

    request.status = "accepted";
    await request.save();

    // Notify the sender
    try {
      await Notification.create({
        userId: request.sender,
        type: "friend_accepted",
        title: "Connection Accepted",
        message: `${req.user.name} accepted your connection request`,
        link: "/connect",
      });
    } catch (notifErr) {
      console.error("[Notification] Failed to create friend accept notification:", notifErr.message);
    }

    res.json({ request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/friends/reject/:requestId — Reject a connection request
 */
router.patch("/reject/:requestId", async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request already processed" });
    }

    request.status = "rejected";
    await request.save();

    res.json({ request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/friends/:requestId — Withdraw or remove a connection
 */
router.delete("/:requestId", async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    const userId = req.user._id.toString();
    const isParticipant = request.sender.toString() === userId || request.receiver.toString() === userId;
    if (!isParticipant) return res.status(403).json({ error: "Not authorized" });

    await FriendRequest.findByIdAndDelete(req.params.requestId);
    res.json({ message: "Connection removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
