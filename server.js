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
const onlineUsers = initSocket(io);

// Make io and onlineUsers available to chat routes via req
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
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

// Error handler
app.use(errorHandler);

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
