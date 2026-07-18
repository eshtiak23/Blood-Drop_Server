import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, default: "" },
  age: { type: Number, default: null },
  bloodGroup: { type: String, enum: ["A+","A-","B+","B-","AB+","AB-","O+","O-",""], default: "" },
  gender: { type: String, default: "" },
  district: { type: String, default: "" },
  area: { type: String, default: "" },
  bio: { type: String, default: "" },
  photo: { type: String, default: "" },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  isAvailable: { type: Boolean, default: true },
  totalDonations: { type: Number, default: 0 },
  lastDonationDate: { type: Date, default: null },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
