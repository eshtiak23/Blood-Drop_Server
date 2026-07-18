import express from "express";
import Feedback from "../models/Feedback.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// GET /api/feedback (public)
router.get("/", async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ createdAt: -1 }).limit(50);
    res.json({ feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/feedback/my
router.get("/my", auth, async (req, res) => {
  try {
    const feedback = await Feedback.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/feedback
router.post("/", auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!comment) return res.status(400).json({ error: "Comment is required" });
    const today = new Date().toISOString().slice(0, 10);
    const alreadyToday = await Feedback.findOne({ userId: req.user._id, createdAt: { $gte: new Date(today) } });
    if (alreadyToday) return res.status(400).json({ error: "You can only submit one feedback per day" });
    const fb = await Feedback.create({ userId: req.user._id, userName: req.user.name, userPhoto: req.user.photo || "", rating, comment });
    res.status(201).json({ feedback: fb });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/feedback/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    await Feedback.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: "Feedback deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
