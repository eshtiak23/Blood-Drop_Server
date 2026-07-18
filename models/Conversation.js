/**
 * Conversation.js — Chat Conversation Model
 *
 * Represents a 1-on-1 chat between two users.
 * Each conversation tracks:
 * - The two participants (always exactly 2 users)
 * - The last message sent (for preview in conversation list)
 * - Unread message count per user (for badge display)
 *
 * When a user opens a chat with someone, we first check if a
 * conversation already exists between them. If not, we create one.
 */

import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    lastMessage: {
      text: { type: String, default: "" },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date },
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
