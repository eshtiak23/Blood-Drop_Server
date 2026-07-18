/**
 * socket/index.js — Socket.IO Server Setup
 *
 * Manages real-time WebSocket connections for the chat system.
 *
 * Features:
 * - JWT authentication on connection (only logged-in users can connect)
 * - Tracks which users are online (userId → socketId mapping)
 * - Handles: joining conversations, sending messages, typing indicators
 * - Auto-reconnection support on the client
 *
 * How it works:
 * 1. Client connects with their JWT token
 * 2. Server verifies the token and registers the user as "online"
 * 3. When a user opens a chat, they "join" that conversation room
 * 4. Messages are emitted to the room for instant delivery
 * 5. Typing indicators are broadcast to the other user in real-time
 */

import jwt from "jsonwebtoken";
import User from "../models/User.js";

export function initSocket(io) {
  // Map of userId → Set<socketId> for multi-device support
  const onlineUsers = new Map();

  function addSocket(userId, socketId) {
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
  }

  function removeSocket(userId, socketId) {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) onlineUsers.delete(userId);
    }
  }

  function getAnySocketId(userId) {
    const sockets = onlineUsers.get(userId);
    if (!sockets || sockets.size === 0) return null;
    return sockets.values().next().value;
  }

  function isUserOnline(userId) {
    return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
  }

  // Expose helper for Express routes
  io.onlineUsers = {
    get: (userId) => getAnySocketId(userId),
    has: (userId) => isUserOnline(userId),
  };

  // Authentication middleware — runs before every connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("User not found"));
      socket.userId = user._id.toString();
      socket.userName = user.name;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Register user as online (multi-device: add socket to set)
    addSocket(socket.userId, socket.id);
    io.emit("user:online", { userId: socket.userId });

    // Join a conversation room
    socket.on("chat:join", (conversationId) => {
      socket.join(conversationId);
    });

    // Leave a conversation room
    socket.on("chat:leave", (conversationId) => {
      socket.leave(conversationId);
    });

    // Typing indicator — broadcast to conversation room except sender
    socket.on("typing:start", (conversationId) => {
      socket.to(conversationId).emit("typing:start", {
        userId: socket.userId,
        userName: socket.userName,
        conversationId,
      });
    });

    socket.on("typing:stop", (conversationId) => {
      socket.to(conversationId).emit("typing:stop", {
        userId: socket.userId,
        conversationId,
      });
    });

    // Mark messages as seen — validate seenBy matches the socket user
    socket.on("message:seen", (data) => {
      const { conversationId } = data;
      socket.to(conversationId).emit("message:seen", { conversationId, seenBy: socket.userId });
    });

    // Handle disconnect — remove this socket, keep user online if other tabs exist
    socket.on("disconnect", () => {
      removeSocket(socket.userId, socket.id);
      if (!isUserOnline(socket.userId)) {
        io.emit("user:offline", { userId: socket.userId });
      }
    });
  });

  return onlineUsers;
}
