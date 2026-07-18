import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/User.js";
import donors from "../../client/src/data/donors.json" with { type: "json" };

dotenv.config({ path: new URL("../.env", import.meta.url) });

const demoUsers = [
  { name: "Admin User", email: "admin@blooddrop.com", password: "admin123", phone: "01700000001", bloodGroup: "A+", district: "Dhaka", area: "Dhanmondi", role: "admin", isVerified: true },
  { name: "Rahim Uddin", email: "rahim@example.com", password: "pass123", phone: "01700000002", bloodGroup: "B+", district: "Dhaka", area: "Gulshan", isVerified: true },
  { name: "Fatima Begum", email: "fatima@example.com", password: "pass123", phone: "01700000003", bloodGroup: "O+", district: "Dhaka", area: "Mirpur", isVerified: true },
  { name: "Kamal Hossain", email: "kamal@example.com", password: "pass123", phone: "01700000004", bloodGroup: "AB+", district: "Chittagong", area: "Agrabad", isVerified: true },
  { name: "Nusrat Jahan", email: "nusrat@example.com", password: "pass123", phone: "01700000005", bloodGroup: "A-", district: "Sylhet", area: "Zindabazar", isVerified: true },
  { name: "Eshtiak Ahmed", email: "eshtiakasha@gmail.com", password: "pass123", phone: "0198984061", bloodGroup: "A+", district: "Rajshahi", area: "Rajshahi Sadar", isVerified: true, totalDonations: 15, lastDonationDate: "2026-05-10" },
];

const demoRequests = [
  { patientName: "Test Patient 1", patientBloodGroup: "A+", district: "Dhaka", area: "Dhanmondi", hospital: "Dhaka Medical", unitsRequired: 2, urgency: "urgent", contactNumber: "01700000010", status: "open" },
  { patientName: "Test Patient 2", patientBloodGroup: "B+", district: "Chittagong", area: "Agrabad", hospital: "Chittagong Medical", unitsRequired: 1, urgency: "normal", contactNumber: "01700000011", status: "open" },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing
    await User.deleteMany({});
    console.log("Cleared users");

    // Seed donors from JSON
    const emailCounts = {};
    const donorDocs = donors.map((d) => {
      let baseEmail = d.name.toLowerCase().replace(/[^a-z0-9]/g, ".");
      baseEmail = baseEmail.replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
      emailCounts[baseEmail] = (emailCounts[baseEmail] || 0) + 1;
      const email = emailCounts[baseEmail] > 1
        ? `${baseEmail}${emailCounts[baseEmail]}@blooddrop.com`
        : `${baseEmail}@blooddrop.com`;
      return {
        name: d.name,
        email,
        password: "donor123",
        phone: d.phone,
        bloodGroup: d.bloodGroup,
        district: d.district,
        area: d.area,
        lat: d.lat,
        lng: d.lng,
        photo: d.photo || "",
        isVerified: true,
        isAvailable: true,
        totalDonations: Math.floor(Math.random() * 45) + 1,
        lastDonationDate: d.lastDonated || null,
      };
    });
    await User.insertMany(donorDocs);
    console.log(`Seeded ${donorDocs.length} donors`);

    // Seed demo users (must use create() to trigger pre-save password hashing)
    const createdUsers = await User.create(demoUsers);
    console.log("Seeded demo users:", createdUsers.map((u) => u.email).join(", "));

    // Seed demo requests
    const Request = (await import("../models/Request.js")).default;
    await Request.deleteMany({});
    const requestDocs = demoRequests.map((r, i) => ({
      ...r,
      requester: createdUsers[i + 1]._id, // Skip admin
    }));
    await Request.insertMany(requestDocs);
    console.log("Seeded demo requests");

    console.log("Seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
};

seed();
