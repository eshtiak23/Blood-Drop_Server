import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

bookmarkSchema.index({ userId: 1, donorId: 1 }, { unique: true });

export default mongoose.model("Bookmark", bookmarkSchema);
