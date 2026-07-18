/**
 * FriendRequest.js — Connection Request Model
 *
 * Tracks friend/connect requests between two users.
 * When accepted, both users can see each other's phone numbers.
 *
 * Status flow: pending → accepted | rejected
 * A unique index prevents duplicate requests between the same two users.
 */

import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests between the same pair
friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });

export default mongoose.model("FriendRequest", friendRequestSchema);
