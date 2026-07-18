import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";
import { validateRegisterForm } from "../utils/validate.js";

const router = express.Router();

const generateToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "30d" });

const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  return obj;
};

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { valid, errors } = validateRegisterForm(req.body);
    if (!valid) {
      const firstErr = Object.values(errors)[0];
      return res.status(400).json({ error: firstErr, errors });
    }

    const { name, email, password, phone, age, bloodGroup, lastDonationDate, district, area } = req.body;
    const exists = await User.findOne({ email: email.trim() });
    if (exists) return res.status(400).json({ error: "Email already registered" });
    const user = await User.create({ name: name.trim(), email: email.trim(), password, phone: phone.trim(), age: Number(age), bloodGroup, lastDonationDate, district, area });
    const token = generateToken(user._id);
    res.status(201).json({ user: sanitizeUser(user), token });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const user = await User.findOne({ email: email.trim() }).select("+password");
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    if (!user.isActive) return res.status(401).json({ error: "Account is deactivated" });
    if (!(await user.comparePassword(password))) return res.status(401).json({ error: "Invalid email or password" });
    const token = generateToken(user._id);
    res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// PUT /api/auth/me
router.put("/me", auth, async (req, res) => {
  try {
    const allowed = ["name", "phone", "age", "bloodGroup", "district", "area", "bio", "photo", "isAvailable", "lastDonationDate"];
    const updates = {};
    allowed.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/users (admin only)
router.get("/users", auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/auth/users/:id/verify (admin only)
router.patch("/users/:id/verify", auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
