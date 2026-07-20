import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["blood_request", "request_accepted", "request_completed", "donor_verified", "reminder", "friend_accepted", "friend_request"], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String, default: null },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("Notification", notificationSchema);
