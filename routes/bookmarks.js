import express from "express";
import Bookmark from "../models/Bookmark.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// GET /api/bookmarks/check/:donorId — MUST be before /:donorId to avoid param collision
router.get("/check/:donorId", auth, async (req, res) => {
  try {
    const exists = await Bookmark.findOne({ userId: req.user._id, donorId: req.params.donorId });
    res.json({ bookmarked: !!exists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookmarks
router.get("/", auth, async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ userId: req.user._id }).populate("donorId", "-password -__v");
    res.json({ bookmarks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookmarks
router.post("/", auth, async (req, res) => {
  try {
    const { donorId } = req.body;
    const existing = await Bookmark.findOne({ userId: req.user._id, donorId });
    if (existing) return res.status(400).json({ error: "Already bookmarked" });
    const bookmark = await Bookmark.create({ userId: req.user._id, donorId });
    res.status(201).json({ bookmark });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bookmarks/:donorId — AFTER /check/:donorId
router.delete("/:donorId", auth, async (req, res) => {
  try {
    await Bookmark.findOneAndDelete({ userId: req.user._id, donorId: req.params.donorId });
    res.json({ message: "Bookmark removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
