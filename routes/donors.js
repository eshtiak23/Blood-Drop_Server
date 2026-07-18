import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Haversine distance helper
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/donors/search
router.get("/search", async (req, res) => {
  try {
    const { bloodGroup, district, area, lat, lng, radius } = req.query;
    let query = { bloodGroup: { $ne: "" }, isAvailable: true };
    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (district) query.district = district;
    if (area) query.area = area;
    let donors = await User.find(query).select("-password -email -__v").sort({ createdAt: -1 }).lean();
    if (lat && lng && radius) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const maxRadius = parseFloat(radius);
      donors = donors.map((d) => ({ ...d, distance: haversineDistance(userLat, userLng, d.lat || 0, d.lng || 0) }))
        .filter((d) => d.distance <= maxRadius)
        .sort((a, b) => a.distance - b.distance);
    }
    res.json({ donors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/donors/leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const donors = await User.find({ bloodGroup: { $ne: "" } })
      .select("-password -email -__v")
      .sort({ totalDonations: -1, lastDonationDate: 1, createdAt: 1 })
      .lean();
    res.json({ donors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/donors/:id
router.get("/:id", async (req, res) => {
  try {
    const donor = await User.findById(req.params.id).select("-password -email -__v").lean();
    if (!donor) return res.status(404).json({ error: "Donor not found" });
    res.json({ donor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
