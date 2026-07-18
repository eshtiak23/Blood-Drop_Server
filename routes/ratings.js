import express from "express";
import Rating from "../models/Rating.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// GET /api/ratings/check/:requestId
router.get("/check/:requestId", auth, async (req, res) => {
  try {
    const exists = await Rating.findOne({ requestId: req.params.requestId, raterId: req.user._id });
    res.json({ rated: !!exists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ratings
router.post("/", auth, async (req, res) => {
  try {
    const { requestId, ratedUserId, rating, comment } = req.body;
    const existing = await Rating.findOne({ requestId, raterId: req.user._id });
    if (existing) return res.status(400).json({ error: "Already rated" });
    const r = await Rating.create({ requestId, raterId: req.user._id, raterName: req.user.name, ratedUserId, rating, comment });
    res.status(201).json({ rating: r });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ratings/user/:userId
router.get("/user/:userId", auth, async (req, res) => {
  try {
    const ratings = await Rating.find({ ratedUserId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ ratings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
