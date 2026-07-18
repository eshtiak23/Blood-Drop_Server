import express from "express";
import DonationLog from "../models/DonationLog.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// GET /api/donation-logs
router.get("/", auth, async (req, res) => {
  try {
    const logs = await DonationLog.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/donation-logs
router.post("/", auth, async (req, res) => {
  try {
    const { donationDate, hospital } = req.body;
    if (!donationDate || !hospital) return res.status(400).json({ error: "Date and hospital are required" });
    const log = await DonationLog.create({
      userId: req.user._id,
      userName: req.user.name,
      donationDate,
      hospital,
      bloodGroup: req.user.bloodGroup,
    });
    await User.findByIdAndUpdate(req.user._id, {
      lastDonationDate: donationDate,
      $inc: { totalDonations: 1 },
    });
    res.status(201).json({ log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/donation-logs/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    await DonationLog.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: "Log deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
