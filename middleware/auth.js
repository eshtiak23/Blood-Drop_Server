/**
 * auth.js — JWT Authentication Middleware
 *
 * This middleware protects routes by verifying the user's JWT token.
 * It runs BEFORE the route handler and:
 * 1. Extracts the token from the "Authorization: Bearer <token>" header
 * 2. Verifies the token using the JWT_SECRET key
 * 3. Finds the user in the database
 * 4. Checks if the user is active (not deactivated)
 * 5. Attaches the user object to req.user for the route handler
 *
 * Usage in routes:
 *   router.get("/protected-route", auth, async (req, res) => {
 *     const user = req.user; // ← This is set by this middleware
 *   });
 *
 * If anything fails, returns 401 Unauthorized.
 * Called by: Every protected route (dashboard, requests, chat, settings, etc.)
 * NOT called by: Public routes (login, register, donor search, leaderboard)
 */

import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    // Step 1: Extract token from Authorization header
    // Header format: "Authorization: Bearer eyJhbGciOi..."
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Authentication required" });

    // Step 2: Verify token is valid and not expired
    // jwt.verify checks the signature and expiration date
    // Throws error if token is invalid or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Find the user in database by ID from token
    // The token contains { id: userId } which we use to fetch the full user
    const user = await User.findById(decoded.id);

    // Step 4: Check user exists and is active (not banned/deactivated)
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid token" });

    // Step 5: Attach user to request object
    // Route handlers can now access req.user to know who's making the request
    req.user = user;

    // Continue to the actual route handler
    next();
  } catch (err) {
    // Token expired, invalid signature, or malformed
    res.status(401).json({ error: "Invalid token" });
  }
};

export default auth;
