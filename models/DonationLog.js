import mongoose from "mongoose";

const donationLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  donationDate: { type: Date, required: true },
  hospital: { type: String, required: true },
  bloodGroup: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("DonationLog", donationLogSchema);
