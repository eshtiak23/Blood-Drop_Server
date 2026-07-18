/**
 * Message.js — Chat Message Model
 *
 * Stores individual messages within a conversation.
 * Each message records:
 * - Which conversation it belongs to
 * - Who sent it and who received it
 * - The message text (required)
 * - Optional image (stored as base64 string, same as profile photos)
 * - Whether the receiver has seen it (for read receipts ✓✓)
 *
 * Messages are sorted by createdAt for chronological display.
 * Old messages can be loaded in batches (pagination) for performance.
 */

import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, default: "", maxlength: 5000 },
    image: { type: String, default: "" },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for fetching messages by conversation and checking unseen messages
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, seen: 1, receiverId: 1 });

export default mongoose.model("Message", messageSchema);
