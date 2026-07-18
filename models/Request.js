import mongoose from "mongoose";

const requestSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  hospital: { type: String, required: true },
  patientBloodGroup: { type: String, required: true },
  unitsRequired: { type: Number, required: true, min: 1 },
  urgency: { type: String, enum: ["critical", "urgent", "normal"], default: "normal" },
  dateNeeded: { type: Date },
  contactNumber: { type: String, required: true },
  district: { type: String, required: true },
  area: { type: String, required: true },
  description: { type: String, default: "" },
  status: { type: String, enum: ["open", "accepted", "completed", "cancelled"], default: "open" },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

export default mongoose.model("Request", requestSchema);
