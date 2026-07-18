/**
 * chat.js — Chat API Routes
 *
 * All chat-related endpoints:
 *   GET    /api/chat/conversations          → List conversations
 *   POST   /api/chat/conversation/:userId   → Create/get conversation
 *   GET    /api/chat/messages/:id           → Get messages (paginated)
 *   POST   /api/chat/send                   → Send message
 *   PATCH  /api/chat/seen/:id               → Mark messages as seen
 *   GET    /api/chat/unread-count            → Total unread for badge
 *   DELETE /api/chat/message/:messageId      → Delete own message
 *   DELETE /api/chat/conversation/:convId    → Delete entire conversation
 *
 * All routes require authentication (JWT token).
 * The io and onlineUsers objects are attached to req by server.js
 * for real-time Socket.IO functionality.
 */

import express from "express";
import auth from "../middleware/auth.js";
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markSeen,
  getUnreadCount,
  deleteMessage,
  deleteConversation,
} from "../controllers/chatController.js";

const router = express.Router();

// All chat routes require authentication
router.use(auth);

router.get("/conversations", getConversations);
router.post("/conversation/:userId", getOrCreateConversation);
router.get("/messages/:conversationId", getMessages);
router.post("/send", sendMessage);
router.patch("/seen/:conversationId", markSeen);
router.get("/unread-count", getUnreadCount);
router.delete("/message/:messageId", deleteMessage);
router.delete("/conversation/:conversationId", deleteConversation);

export default router;
