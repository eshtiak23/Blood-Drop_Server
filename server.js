import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import { initSocket } from "./socket/index.js";
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
import errorHandler from "./middleware/errorHandler.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize Socket and get online users map
initSocket(io);

// Make io and onlineUsers available to chat routes via req
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = io.onlineUsers;
  next();
});

// Middleware
app.use(helmet());

const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://blood-drop-jade.vercel.app",
  "http://localhost:5173",
].filter(Boolean);
app.use(cors({ origin: (origin, cb) => {
  if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
  cb(new Error("Not allowed by CORS"));
}, credentials: true }));

app.use(express.json({ limit: "5mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/donation-logs", donationLogRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/chat", chatRoutes);

// Root route
app.get("/", (req, res) => res.json({ name: "LifeDrop API", status: "running" }));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// 404 catch-all for unknown API routes
app.use("/api", (req, res) => res.status(404).json({ error: "Route not found" }));

// Error handler
app.use(errorHandler);

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
