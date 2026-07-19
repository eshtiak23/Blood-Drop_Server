/**
 * server.js — Main Server Entry Point
 *
 * This is the "brain" of the backend. It:
 * 1. Connects to MongoDB database
 * 2. Sets up Socket.IO for real-time chat
 * 3. Configures security middleware (CORS, Helmet)
 * 4. Mounts 11 route groups (auth, donors, requests, chat, etc.)
 * 5. Starts the HTTP server on the configured port
 *
 * Architecture:
 *   HTTP Request → Express Middleware → Route Handler → MongoDB → Response
 *   WebSocket → Socket.IO → Event Handler → Broadcast to Room
 *
 * Environment Variables Required:
 *   MONGODB_URI  — MongoDB Atlas connection string
 *   JWT_SECRET   — Secret key for signing JWT tokens
 *   CLIENT_URL   — Frontend URL for CORS (e.g., https://blood-drop-jade.vercel.app)
 *   RESEND_API_KEY — Email service API key
 *   PORT         — Server port (default: 5000)
 */

// Load environment variables from .env file BEFORE anything else
// This must be the first import so process.env is available everywhere
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";       // Needed for Socket.IO (shares same port)
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import { initSocket } from "./socket/index.js";

// Import all 11 route groups — each handles a different feature
import authRoutes from "./routes/auth.js";
import donorRoutes from "./routes/donors.js";
import requestRoutes from "./routes/requests.js";
import notificationRoutes from "./routes/notifications.js";
import bookmarkRoutes from "./routes/bookmarks.js";
import donationLogRoutes from "./routes/donationLogs.js";
import feedbackRoutes from "./routes/feedback.js";
import ratingRoutes from "./routes/ratings.js";
import statsRoutes from "./routes/stats.js";
import chatRoutes from "./routes/chat.js";
import friendRoutes from "./routes/friends.js";
import errorHandler from "./middleware/errorHandler.js";

// Create Express app and HTTP server
// Socket.IO needs an HTTP server instance (not just Express)
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Step 1: Connect to MongoDB Atlas database
// If connection fails, the process exits (see config/db.js)
connectDB();

// Step 2: Initialize Socket.IO for real-time chat
// This sets up WebSocket event handlers and returns the onlineUsers map
// CORS allows the frontend domain to connect
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize Socket.IO event handlers (chat:join, typing:start, etc.)
// and get the onlineUsers helper for Express routes
initSocket(io);

/**
 * MIDDLEWARE: Make Socket.IO available to chat routes
 * Express routes need access to `io` to emit real-time events.
 * We attach it to `req.io` so chat routes can do:
 *   req.io.to(socketId).emit("message:new", data)
 *
 * Called by: Every request that passes through Express
 * Used by: chat.js routes, requests.js (for notifications)
 */
app.use((req, res, next) => {
  req.io = io;                    // Socket.IO instance for emitting events
  req.onlineUsers = io.onlineUsers; // Helper to check if a user is online
  next();
});

// Step 3: Security middleware
// Helmet sets HTTP security headers (X-Content-Type-Options, etc.)
app.use(helmet());

/**
 * CORS Configuration — Controls which domains can access this API
 * Without CORS, the browser blocks requests from blood-drop-jade.vercel.app
 * to blood-drop-server.onrender.com (cross-origin).
 *
 * We allow: Vercel frontend + localhost (for development)
 * Credentials: true allows cookies/auth headers to be sent
 */
const allowedOrigins = [
  process.env.CLIENT_URL,                          // From .env
  "https://blood-drop-jade.vercel.app",           // Hardcoded Vercel URL (fallback)
  "http://localhost:5173",                         // Local development
].filter(Boolean);  // Remove undefined values

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, Postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Parse JSON request bodies (max 5MB for base64 images in chat/profile)
app.use(express.json({ limit: "5mb" }));

// Step 4: Mount all API routes
// Each route group handles a specific feature
// All routes are prefixed with /api/
app.use("/api/auth", authRoutes);           // Login, register, profile
app.use("/api/donors", donorRoutes);       // Search donors, leaderboard
app.use("/api/requests", requestRoutes);   // Blood requests, accept, complete
app.use("/api/notifications", notificationRoutes); // In-app notifications
app.use("/api/bookmarks", bookmarkRoutes); // Saved/favorited donors
app.use("/api/donation-logs", donationLogRoutes); // Donation history
app.use("/api/feedback", feedbackRoutes);  // User reviews/testimonials
app.use("/api/ratings", ratingRoutes);     // Post-donation ratings
app.use("/api/stats", statsRoutes);        // Platform statistics
app.use("/api/chat", chatRoutes);          // Chat conversations, messages
app.use("/api/friends", friendRoutes);     // Connection requests, friends

// Root route — confirms the API is running
app.get("/", (req, res) => res.json({ name: "LifeDrop API", status: "running" }));

// Health check — used by Render to verify the server is alive
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// 404 catch-all — any unknown /api/* route gets a JSON error
// This must come AFTER all route definitions
app.use("/api", (req, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler — catches any unhandled errors
app.use(errorHandler);

// Step 5: Start the server
// httpServer.listen (not app.listen) because Socket.IO needs the HTTP server
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
