import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true },
  raterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  raterName: { type: String, required: true },
  ratedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: "" },
}, { timestamps: true });

ratingSchema.index({ requestId: 1, raterId: 1 }, { unique: true });

export default mongoose.model("Rating", ratingSchema);
