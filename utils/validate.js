const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const VALID_DISTRICTS = [
  "Bagerhat","Bandarban","Barguna","Barisal","Bhola","Bogura","Chandpur","Chattogram",
  "Chuadanga","Comilla","Cox's Bazar","Dinajpur","Faridpur","Feni","Gaibandha","Gazipur",
  "Gopalganj","Habiganj","Jamalpur","Jashore","Jhalakathi","Jhenaidah","Joypurhat",
  "Khagrachhari","Khulna","Kishoreganj","Kurigram","Kushtia","Lakshmipur","Lalmonirhat",
  "Madaripur","Magura","Manikganj","Meherpur","Moulvibazar","Munshiganj","Myymensingh",
  "Naogaon","Narail","Narayanganj","Narsingdi","Natore","Netrakona","Nilphamari",
  "Noakhali","Pabna","Panchagarh","Patuakhali","Pirojpur","Rajbari","Rajshahi","Rangamati",
  "Rangpur","Satkhira","Shariatpur","Sherpur","Sirajganj","Sunamganj","Sylhet",
  "Tangail","Thakurgaon"
];

function validateName(v) {
  if (!v || !v.trim()) return "Name is required";
  if (v.trim().length < 2 || v.trim().length > 50) return "Name must be 2-50 characters";
  return null;
}

function validateEmail(v) {
  if (!v || !v.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Invalid email address";
  return null;
}

function validatePassword(v) {
  if (!v) return "Password is required";
  if (v.length < 6) return "Password must be at least 6 characters";
  return null;
}

function validatePhone(v) {
  if (!v || !v.trim()) return "Phone number is required";
  if (!/^01[3-9]\d{8}$/.test(v.trim())) return "Invalid BD phone (01XXXXXXXXX)";
  return null;
}

function validateAge(v) {
  const n = Number(v);
  if (!v && v !== 0) return "Age is required";
  if (isNaN(n) || n < 18 || n > 65) return "Age must be 18-65";
  return null;
}

function validateBloodGroup(v) {
  if (!v) return "Blood group is required";
  if (!BLOOD_GROUPS.includes(v)) return "Invalid blood group";
  return null;
}

function validateDistrict(v) {
  if (!v || !v.trim()) return "District is required";
  return null;
}

function validateArea(v) {
  if (!v || !v.trim()) return "Area is required";
  return null;
}

function validateNumber(v, name, min, max) {
  const n = Number(v);
  if (v === undefined || v === null || v === "") return `${name} is required`;
  if (isNaN(n) || n < min || n > max) return `${name} must be ${min}-${max}`;
  return null;
}

function validateRequired(v, name) {
  if (!v || (typeof v === "string" && !v.trim())) return `${name} is required`;
  return null;
}

function validateRegisterForm(body) {
  const errors = {};
  const e1 = validateName(body.name);
  const e2 = validateEmail(body.email);
  const e3 = validatePassword(body.password);
  const e4 = validatePhone(body.phone);
  const e5 = validateAge(body.age);
  const e6 = validateBloodGroup(body.bloodGroup);
  const e7 = validateRequired(body.lastDonationDate, "Last donation date");
  const e8 = validateDistrict(body.district);
  const e9 = validateArea(body.area);
  if (e1) errors.name = e1;
  if (e2) errors.email = e2;
  if (e3) errors.password = e3;
  if (e4) errors.phone = e4;
  if (e5) errors.age = e5;
  if (e6) errors.bloodGroup = e6;
  if (e7) errors.lastDonationDate = e7;
  if (e8) errors.district = e8;
  if (e9) errors.area = e9;
  return { valid: Object.keys(errors).length === 0, errors };
}

function validateRequestForm(body) {
  const errors = {};
  const e1 = validateRequired(body.patientName, "Patient name");
  const e2 = validateRequired(body.hospital, "Hospital");
  const e3 = validateBloodGroup(body.patientBloodGroup);
  const e4 = validateNumber(body.unitsRequired, "Units required", 1, 10);
  const e5 = validateRequired(body.dateNeeded, "Date needed");
  const e6 = validatePhone(body.contactNumber);
  const e7 = validateDistrict(body.district);
  const e8 = validateArea(body.area);
  if (e1) errors.patientName = e1;
  if (e2) errors.hospital = e2;
  if (e3) errors.patientBloodGroup = e3;
  if (e4) errors.unitsRequired = e4;
  if (e5) errors.dateNeeded = e5;
  if (e6) errors.contactNumber = e6;
  if (e7) errors.district = e7;
  if (e8) errors.area = e8;
  return { valid: Object.keys(errors).length === 0, errors };
}

export {
  validateName, validateEmail, validatePassword, validatePhone, validateAge,
  validateBloodGroup, validateDistrict, validateArea, validateNumber, validateRequired,
  validateRegisterForm, validateRequestForm
};
