import asyncHandler from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { Admin } from "../models/Admin.model.js";
import { sendEmail } from "../utils/sendEmails.js";
import uploadPath from "../utils/uploadPaths.js"; // <-- Import the uploadPath object for file uploads

const filesUploadPath = process.env.FILES_UPLOAD_PATH;

// Helper to delete uploaded file if it exists
function deleteUploadedFiles(req, fileUploadPath) {
  const uploadPath = fileUploadPath;

  // For single file (e.g., upload.single)
  if (req.file) {
    const filePath = path.join(__dirname, uploadPath, req.file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  // For multiple files (e.g., upload.fields)
  if (req.files) {
    Object.values(req.files).forEach((fileArr) => {
      fileArr.forEach((file) => {
        const filePath = path.join(__dirname, uploadPath, file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    });
  }
}

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "365d", // ENHANCED: Extended token expiration for a year
  });
};

// Create Admin
const registerAdmin = asyncHandler(async (req, res) => {
  const { fullName, email, phoneNumber, password, adminSecretPassword } =
    req.body;

  const adminUploadPath = uploadPath.adminUpload;
  if (!fullName || !email || !password) {
    deleteUploadedFiles(req, adminUploadPath); // Clean up uploaded files if Admin not found
    return res.status(400).json({ message: "All fields are required." });
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    deleteUploadedFiles(req, adminUploadPath); // Clean up uploaded files if Admin not found
    return res.status(403).json({ message: "Admin Email already exists." });
  }

  if (adminSecretPassword !== process.env.SUPER_ADMIN_SECRET) {
    deleteUploadedFiles(req, adminUploadPath); // Clean up uploaded files if Admin not found
    return res.status(401).json({ message: "Invalid Admin secret password." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const avtarURLPath = adminUploadPath.replace("../", "/");
  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const admin = await Admin.create({
    fullName,
    email,
    phoneNumber: phoneNumber || null, // ENHANCED: Default phone number if not provided
    password: hashedPassword,
    avatar: {
      fileName: req.file ? req.file.filename : null, // ENHANCED: Handle avatar upload
      url: req.file
        ? `${avtarURLPath}${req.file.filename}`
        : null, // ENHANCED: Generate URL for avatar
    },
  });
  const token = generateToken(admin._id); // ENHANCED: Added token generation during login
  console.log("Generated Token:", token); // Debugging line

  res
    .status(200)
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json({
      message: "Login successful.",
      token: token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        phoneNumber: admin.phoneNumber,
      },
    });
});

// Login
const loginAdmin = asyncHandler(async (req, res) => {
  const email = req.body?.email;
  const password = req.body?.password;

  if (!email || !password) {
    let fields = [];
    if(!email) fields.push("email");
    if(!password) fields.push("password");
    const fieldsText = fields.join(", ");
    const verb = fields.length > 1 ? "are" : "is";
    return res.status(400).json({
      success: false,
      emptyFields: fields,
      message: `${fieldsText} ${verb} required.`,
    });
  }

  const admin = await Admin.findOne({ email });
  if (!admin) {
    return res.status(404).json({ success: false, message: "Invalid credentials." });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid credentials." });
  }

  const token = generateToken(admin._id); // ENHANCED: Added token generation during login

  res
    .status(200)
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json({
      success: true,
      message: "Login successful.",
      token: token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        phoneNumber: admin.phoneNumber,
        avatar: admin.avatar,
      },
    });
});

// Logout (Client side should token cookies are removed by backend)
const logoutAdmin = asyncHandler(async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // lax in dev
    path: "/",
  });

  return res.status(200).json({ message: "Logout successful." });
});

// Get Profile
const getAdminProfile = asyncHandler(async (req, res) => {
  // console.log("token..............", req.cookies.token);

  const admin = await Admin.findById(req.user.id).select("-password");
  if (!admin) {
    return res.status(404).json({ message: "Admin not found." });
  }
  res.status(200).json(admin);
});

// Update Profile
const updateAdminProfile = asyncHandler(async (req, res) => {
  const { fullName, phoneNumber, email, address } = req.body;
  const admin = await Admin.findById(req.user.id);

  const adminUploadPath = uploadPath.adminUpload;
  if (!admin) {
    deleteUploadedFiles(req, adminUploadPath); // Clean up uploaded files if SuperAdmin not found
    return res.status(404).json({ message: "Admin User not found." });
  }

  // Check if a file is uploaded (avatar)
  let avatarFileName;
  let avatarURL;
  if (req.file) {
    // Delete old image if it exists

    const uploadPath = adminUploadPath;
    const avtarURLPath = uploadPath.replace("../", "/");
    if (admin.avatar.fileName || admin.avatar.url) {
      const oldPath = path.join(__dirname, uploadPath, admin.avatar.fileName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const filesUploadPath = process.env.FILES_UPLOAD_PATH;
    avatarURL = req.file
      ? `${avtarURLPath}${req.file.filename}`
      : null;
    // avatarURL = req.file ? `/public/uploads/admin/${req.file.filename}` : null;
    avatarFileName = req.file ? req.file.filename : null;
  } else {
    // Keep existing avatar if not updated
    avatarFileName = admin.avatar.fileName;
    avatarURL = admin.avatar.url;
  }

  // Update fields
  admin.fullName = fullName || admin.fullName;
  admin.phoneNumber = phoneNumber || admin.phoneNumber;
  admin.email = email || admin.email;
  admin.avatar.fileName = avatarFileName;
  admin.avatar.url = avatarURL;
  admin.address = address || admin.address;

  await admin.save();

  res.status(200).json({
    message: "Profile updated successfully.",
    admin: {
      _id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      avatar: admin.avatar,
      address: admin.address,
    },
  });
});


const changePassword = asyncHandler(async (req, res) => {
  const adminId = req.user._id || req.user.id; // assuming you get this from auth middleware
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match" });
  }

  const admin = await Admin.findById(adminId);

  if (!admin) {
    return res.status(404).json({ msg: "Admin not found" });
  }

  const isMatch = await bcrypt.compare(currentPassword, admin.password);
  if (!isMatch) {
    return res.status(400).json({ msg: "Current password is incorrect" });
  }

  const salt = await bcrypt.genSalt(10);
  admin.password = await bcrypt.hash(newPassword, salt);

  await admin.save();

  res.status(200).json({ msg: "Password changed successfully" });
});


const sendOtpToAdmin = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await Admin.findOne({ email });
  if (!user) {
    return res.status(404).json({ msg: "No user found" });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  user.resetPasswordToken = hashedOtp;
  user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  await sendEmail({
    to: user.email,
    subject: "Forgot Password OTP",
    html: `<div style="font-family: Arial, sans-serif; padding: 10px;">
    <h2 style="color: #333;">Your One-Time Password (OTP)</h2>
    <p>Hi ${user.fullName || "User"},</p>
    <p>Your OTP is:</p>
    <div style="font-size: 24px; font-weight: bold; margin: 10px 0;">${otp}</div>
    <p>This OTP is valid for the next 10 minutes. Please do not share it with anyone.</p>
    <br/>
    <p>Please don't reply to this email.</p>
    <p>Thank you!</p>
  </div>
  `,
  });
  return res.status(200).json({
    msg: "OTP sent to your email",
  });
});

const forgotPasswordAdmin = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await Admin.findOne({ email });
  if (!user) {
    return res.status(404).json({ msg: "No user found" });
  }
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  if (
    user.resetPasswordToken !== hashedOtp ||
    user.resetPasswordExpires < Date.now()
  ) {
    return res.status(400).json({ msg: "Invalid or expired OTP" });
  }
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();
  return res.status(200).json({
    msg: "Password reset successfully",
    user,
  });
});


/*
// following functions not yet required superadmin controllers
/**
// Change Password
const changeSuperAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const superAdmin = await SuperAdmin.findById(req.user.id);
  if (!superAdmin) {
    return res.status(404).json({ message: 'SuperAdmin not found.' });
  }

  const isMatch = await bcrypt.compare(currentPassword, superAdmin.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Current password is incorrect.' });
  }

  superAdmin.password = await bcrypt.hash(newPassword, 10);
  await superAdmin.save();

  res.status(200).json({ message: 'Password changed successfully.' });
});

// Forgot Password
const forgotSuperAdminPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Check if email is provided in request body
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  // Check if SuperAdmin with the provided email exists
  const superAdmin = await SuperAdmin.findOne({ email });
  if (!superAdmin) {
    return res.status(404).json({ message: 'SuperAdmin with this email does not exist.' });
  }

  // Generate a reset token and its hashed version
  const resetToken = crypto.randomBytes(20).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Save the reset token and its expiration time
  superAdmin.resetPasswordToken = hashedToken;
  superAdmin.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // Link valid for 10 minutes

  // Save the changes in the database
  await superAdmin.save({ validateBeforeSave: false });

  // Generate the reset URL and prepare the HTML email content
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const htmlMessage = `
  <h2>Password Reset Request</h2>
  <p>Hello ${superAdmin.fullName},</p>
  <p>We received a request to reset your password. Please click the link below to reset it:</p>
  <a href="${resetUrl}" target="_blank">${resetUrl}</a>
  <p>This link will expire in 10 minutes.</p>
  `;

  // Attempt to send the reset email
  try {
    await sendEmail({
      to: superAdmin.email,
      subject: 'SuperAdmin Password Reset',
      html: htmlMessage,
    });

    res.status(200).json({ message: 'Password reset link has been sent to your email address.' });
  } catch (error) {
    // If email fails, reset token and expiration are cleared from the database
    superAdmin.resetPasswordToken = undefined;
    superAdmin.resetPasswordExpires = undefined;
    await superAdmin.save({ validateBeforeSave: false });

    // Log the error for debugging and return a user-friendly message
    console.error('Error sending email:', error.message);
    res.status(500).json({ message: 'We encountered an issue sending the email. Please try again later.' });
  }
});

// Reset SuperAdmin Password
const resetSuperAdminPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const superAdmin = await SuperAdmin.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!superAdmin) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  superAdmin.password = hashedPassword;
  superAdmin.resetPasswordToken = undefined;
  superAdmin.resetPasswordExpires = undefined;

  await superAdmin.save();

  res.status(200).json({
    success: true,
    message: 'Password has been reset successfully.',
  });
});


*/

export {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  getAdminProfile,
  updateAdminProfile,

  changePassword,
  sendOtpToAdmin,
  forgotPasswordAdmin,

  // changeSuperAdminPassword,
  // forgotSuperAdminPassword,
  // resetSuperAdminPassword,
};

/**

  -- admin controllers

  registerAdmin()		- Registers a new Admin.									DONE
  loginAdmin()				- Admin Login. 												DONE
  logoutAdmin()				- Logs out the Admin (client-side token removal).			DONE
  getAdminProfile()			- Retrieves the Admin's profile information.				DONE
  updateAdminProfile()		- Updates the Admin's profile information.					DONE




 */
