import express from "express";
import User from "../models/User.js";
import Request from "../models/Request.js";

const router = express.Router();

// GET /api/stats — public endpoint for landing page
router.get("/", async (req, res) => {
  try {
    const [totalDonors, totalRequests, completedRequests, districts] = await Promise.all([
      User.countDocuments({ role: { $ne: "admin" } }),
      Request.countDocuments(),
      Request.countDocuments({ status: "completed" }),
      User.distinct("district", { district: { $ne: "" } }),
    ]);
    res.json({
      totalDonors,
      totalRequests,
      completedRequests,
      livesSaved: completedRequests,
      districtsCovered: districts.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
