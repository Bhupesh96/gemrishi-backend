import bcrypt from "bcryptjs";
import { Retailer } from "../models/retailer.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendEmail } from "../utils/sendEmails.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const filesUploadPath = process.env.FILES_UPLOAD_PATH;

const generateJwtToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

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

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const retailerUser = await Retailer.findOne({ email }).select("-cart");
  if (!retailerUser) {
    return res.status(404).json({ success: false, msg: "No Retailer found" });
  }

  if (retailerUser.isActive === false) {
    return res.status(401).json({
      success: false,
      msg: "Your account has been Deactivated, Please Reactivate Your Account.",
    });
  }

  if (retailerUser.isBlocked === true) {
    return res.status(401).json({
      success: false,
      msg: "Your account has been Blocked By Wholesaler, Please Contact Your Wholesaler.",
    });
  }

  const isMatch = await bcrypt.compare(password, retailerUser.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, msg: "Invalid credentials" });
  }

  const token = generateJwtToken(retailerUser);

  return res
    .status(200)
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json({
      success: true,
      msg: "Login successful",
      token: token,
      retailerUser: {
        _id: retailerUser._id,
        email: retailerUser.email,
        fullName: retailerUser.fullName,
        profilePic: retailerUser.profilePic,
        mobileNo: retailerUser.mobileNo,
        country: retailerUser.country,
        address: retailerUser.address,
      },
    });
});

export const logoutRetailer = asyncHandler(async (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    })
    .status(200)
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

export const register = asyncHandler(async (req, res) => {
  const { email, password, fullName, mobileNo, country, address } = req.body;

  const existingUser = await Retailer.findOne({ email });
  if (existingUser) {
    deleteUploadedFiles(req, "/public/uploads/");
    return res
      .status(409)
      .json({
        success: false,
        msg: "User Email Already Exists, Try With Another Email",
      });
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const user = new Retailer({
    email,
    password: hashedPassword,
    fullName,
    mobileNo,
    country,
    address,
    profilePic: {
      fileName: req.file?.filename || "",
      url: req.file ? `/public/uploads/${req.file.filename}` : null, // ENHANCED: Generate URL for avatar
    },
  });
  const token = generateJwtToken(user);
  await user.save();

  return res
    .status(200)
    .json({ success: true, msg: "Registration successful", user, token });
});

// Get all retailers by admin only
export const getAllRetailers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await Retailer.countDocuments();

  const retailers = await Retailer.find()
    .skip(skip)
    .limit(limit)
    .select("email fullName mobileNo country address profilePic");

  if (!retailers || retailers.length === 0) {
    return res.status(404).json({ success: false, msg: "No retailer found" });
  }

  return res.status(200).json({
    success: true,
    msg: "Retailers list fetched successfully",
    totalPage: Math.ceil(total / limit),
    currentPage: page,
    retailers,
  });
});

// Deactivate retailer by Retailer Only
export const deactivateRetailerByReatailer = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const retailerId = req.user._id;
  const retailer = await Retailer.findByIdAndUpdate(
    retailerId,
    { isActive: status },
    { new: true }
  ).select("isActive");
  if (!retailer) {
    return res.status(404).json({ success: false, msg: "Retailer not found" });
  }
  let message = "Operation Successful But Not Sure";
  if (retailer.isActive == false) {
    message = "Retailer Deactivated Successfully";
  } else if (retailer.isActive == true) {
    message = "Retailer Activated Successfully";
  }

  return res.status(200).json({ success: true, msg: message, retailer });
});

// Block and Unblock Retailer Account by Admin Only
export const blockUnblockRetailerByAdmin = asyncHandler(async (req, res) => {
  const { retailerId, status } = req.body;
  const retailer = await Retailer.findByIdAndUpdate(
    retailerId,
    { isBlocked: status },
    { new: true }
  ).select("isBlocked");
  if (!retailer) {
    return res.status(404).json({ success: false, msg: "Retailer not found" });
  }
  let message = "Operation Successful But Not Sure";
  if (retailer.isBlocked == true) {
    message = "Retailer Blocked Successfully";
  } else if (retailer.isBlocked == false) {
    message = "Retailer Unblocked Successfully";
  }

  return res.status(200).json({ success: true, msg: message, retailer });
});

// Delete retailer by Admin Only
export const deleteRetailer = asyncHandler(async (req, res) => {
  const { retailerId } = req.query;
  const retailer = await Retailer.findByIdAndDelete(retailerId);
  if (!retailer) {
    return res.status(404).json({ success: false, msg: "Retailer not found" });
  }
  return res
    .status(200)
    .json({ success: true, msg: "Retailer deleted successfully" });
});

export const updateRetailer = asyncHandler(async (req, res) => {
  const { retailerId } = req.params;
  const updateData = req.body;
  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const updatedProfilePic = req.file
    ? `/public/uploads/${req.file.filename}`
    : null;
  const payload = updatedProfilePic
    ? { profilePic: updatedProfilePic, ...updateData }
    : updateData;
  const retailer = await Retailer.findByIdAndUpdate(retailerId, payload, {
    new: true,
    runValidators: true,
  });
  if (!retailer) {
    deleteUploadedFiles(req, "/public/uploads/");
    return res.status(404).json({ success: false, msg: "Retailer not found" });
  }
  return res.status(200).json({
    success: true,
    msg: "Retailer updated successfully",
    retailer,
  });
});

export const sendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const retailer = await Retailer.findOne({ email });
  if (!retailer) {
    return res.status(404).json({ msg: "Retailer not found" });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  retailer.resetPasswordOtp = hashedOtp;
  retailer.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

  await retailer.save({ validateBeforeSave: false });

  await sendEmail({
    to: retailer.email,
    subject: "Password Reset OTP",
    html: `<div style="font-family: Arial, sans-serif; padding: 10px;">
    <h2 style="color: #333;">Your One-Time Password (OTP)</h2>
    <p>Hi ${retailer.fullName || "User"},</p>
    <p>Your OTP is:</p>
    <div style="font-size: 24px; font-weight: bold; margin: 10px 0;">${otp}</div>
    <p>This OTP is valid for the next 10 minutes. Please do not share it with anyone.</p>
    <br/>
    <p>Please don't reply to this email.</p>
    <p>Thank you!</p>
  </div>
  `,
  });

  return res.status(200).json({ msg: "OTP sent successfully" });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const retailer = await Retailer.findOne({ email });
  if (!retailer) {
    return res.status(404).json({ msg: "No retailer found" });
  }

  // hash incoming otp
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  // check hashed otp + expiry
  if (
    retailer.resetPasswordOtp !== hashedOtp ||
    retailer.resetPasswordExpires < Date.now()
  ) {
    return res.status(400).json({ msg: "Invalid or expired OTP" });
  }

  // hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // update retailer
  retailer.password = hashedPassword;
  retailer.resetPasswordOtp = undefined;
  retailer.resetPasswordExpires = undefined;

  await retailer.save();

  return res.status(200).json({
    msg: "Password reset successfully",
  });
});

// Get retailer Profile
export const getProfile = asyncHandler(async (req, res) => {
  const retailerId = req.user._id || req.user.id;
  const profile = await Retailer.findById(retailerId).select(
    "-password -resetPasswordOtp -resetPasswordExpires"
  );
  if (!profile) {
    return res.status(404).json({ success: false, msg: "Retailer not found" });
  }
  return res.status(200).json({
    success: true,
    msg: "Profile retrieved successfully",
    profile,
  });
});

export const getRetailerById = asyncHandler(async (req, res) => {
  const { retailerId } = req.params;

  const retailer = await Retailer.findById(retailerId);
  if (!retailer) {
    return res.status(400).json({ msg: "No Retailer Found" });
  }

  return res.status(200).json({
    msg: "Retailer retrieved successfully",
    retailer,
  });
});

export const changeRetailerPassword = asyncHandler(async (req, res) => {
  const retailerId = req.user._id || req.user.id;
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ msg: "All fields required" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match" });
  }

  const retailer = await Retailer.findById(retailerId);

  if (!retailer) {
    return res.status(404).json({ msg: "No Retailer Found" });
  }

  console.log("ret", retailer);

  const isMatch = await bcrypt.compare(currentPassword, retailer.password);
  console.log("ismtach", isMatch);
  console.log("ismtach", currentPassword);
  console.log("ismtach", retailer.password);
  if (!isMatch) {
    return res.status(400).json({ msg: "Current password does not match" });
  }

  const salt = await bcrypt.genSalt(10);
  retailer.password = await bcrypt.hash(newPassword, salt);

  await retailer.save();

  res.status(200).json({
    msg: "Password changed successfully",
  });
});

/**
  Retailse Login APIs =

  register()                                                                        **Testing
  login()                               Login Retailer                              DONE
  getProfile()                          Get Retailer Profile                        DONE
  updateRetailer()                                                                  **Testing
  sendOtp()                                                                         **Testing
  resetPassword()                                                                   **Testing
  deactivateRetailerByReatailer()       Deactivate Retailer By Retailer              DONE


  getAllRetailers()                     Get All Retailers                            DONE
  deactivateRetailerByAdmin()           Deactivate Retailer By Admin                 DONE
  deleteRetailer()                      Delete Retailer By Admin                     DONE


 */
