import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmails.js";
import jwt from "jsonwebtoken";
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

const generateJwtToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({
    email,
  }).select("email password");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = generateJwtToken(user);

  const userData = await User.findById(user._id).select("-password -wishlist -resetPasswordOtp -resetPasswordExpires");

  return res
    .status(200)
    .cookie("usertoken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json({
      msg: "User logged in successfully",
      user: userData,
      token,
    });
});

const logoutUser = asyncHandler(async (req, res) => {
  res.status(200)
    .clearCookie("usertoken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    })
    .json({ success: true, msg: "User logged out successfully" });
});

const register = asyncHandler(async (req, res) => {
  const { email, password, fullName, mobileNo, country, address, pinCode, city, landmark } = req.body;

  const userUploadPath = uploadPath.userUpload;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    deleteUploadedFiles(req, userUploadPath); // Clean up uploaded if field is missing
    return res.status(409).json({ msg: "User already exists" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const imagePath = userUploadPath.replace("../", "/");

  const user = new User({
    email,
    password: hashedPassword,
    fullName,
    mobileNo,
    country,
    address,
    pinCode,
    city,
    landmark,
    profilePic: {
      fileName: req.file?.filename || "",
      url: req.file ? `${imagePath}${req.file.filename}`: null, // ENHANCED: Generate URL for avatar
    },
  });

  const token = generateJwtToken(user);

  await user.save();

  return res
    .status(201)
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .json({
      msg: "User registered successfully",
      user,
    });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.page) || 10;
  const skip = (page - 1) * limit;

  const total = await User.countDocuments();

  const users = await User.find().skip(skip).limit(limit);

  if (!users || users.length === 0) {
    return res.status(404).json({ msg: "No user found" });
  }

  return res.status(200).json({
    msg: "Users fetched successfully",
    users,
    totalUsers: Math.ceil(total / limit),
    currentPage: page,
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updateData = req.body;
  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const userUploadPath = uploadPath.userUpload;
  const imagePath = userUploadPath.replace("../", "/");

  const updatedProfilePic = req.file ? {fileName: req.file.filename, url: `${imagePath}${req.file.filename}`,}: null;
  const payload = updatedProfilePic
    ? { profilePic: updatedProfilePic, ...updateData }
    : updateData;
  const user = await User.findByIdAndUpdate(userId, payload, {
    new: true,
    runValidators: false,
  });
  if (!user) {
    deleteUploadedFiles(req, userUploadPath); // Clean up uploaded if field is missing
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json({
    msg: "User updated successfully",
    user,
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findByIdAndDelete(userId);

  if (!user) {
    return res.status(404).json({
      msg: "User not found",
    });
  }
  return res.status(200).json({
    msg: "user deleted sucessfully",
  });
});

const sendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ msg: "No user found" });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  user.resetPasswordOtp = hashedOtp;
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


// api for to verify otp only for password reset
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ msg: "No user found or Invalid Email" });
  }
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  if (user.resetPasswordOtp !== hashedOtp || user.resetPasswordExpires < Date.now()) {
    return res.status(400).json({ success: false, msg: "Invalid or expired OTP" });
  }
  return res.status(200).json({
    success: true,
    msg: "OTP verified successfully",
  });
});



const forgotPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ msg: "No user found" });
  }
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  if (
    user.resetPasswordOtp !== hashedOtp ||
    user.resetPasswordExpires < Date.now()
  ) {
    return res.status(400).json({ msg: "Invalid or expired OTP" });
  }
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordOtp = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();
  return res.status(200).json({
    msg: "Password reset successfully",
    user,
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const user = await User.findById(userId).select("-password -wishlist  -resetPasswordOtp -resetPasswordExpires");
  if (!user) {
    return res.status(404).json({ msg: "No user found" });
  }
  return res.status(200).json({
    msg: "User profile fetched successfully",
    user,
  });
});


// Delivery Address
// Add Delivery address
const addDeliveryAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    addressType,
    fullName,
    email,
    mobileNo,
    addressLine1,
    addressLine2,
    landmark,
    city,
    pinCode,
    state,
    country,
    note,
  } = req.body;


  const user = await User.findById(userId).select("deliveryAddress");

  if (!user) {
    return res.status(404).json({
      success: false,
      msg: "User not found" });
    }

    // Check if an address with the same type already exists and return an error
    const existingAddress = user.deliveryAddress.find(
        (addr) => addr && addr.addressType && addr.addressType.toLowerCase() === addressType.toLowerCase()
      );

      if (existingAddress) {
          return res.status(409).json({
              success: false,
              field: "addressType",
              msg: `An address with type '${addressType}' already exists.`,
            });
  }

  const newAddress = {
    addressType,
    fullName,
    email,
    mobileNo,
    addressLine1,
    addressLine2,
    landmark,
    city,
    pinCode,
    state,
    country,
    note
  };

  user.deliveryAddress.push(newAddress);

  await user.save();

  return res.status(200).json({
    success: true,
    msg: "Delivery Address added successfully",
    updatedAddress: newAddress,
    addressList: user.deliveryAddress,
  });

});

// Delete Delivery address
const deleteDeliveryAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { addressId } = req.query;

  if (!addressId) {
    return res.status(400).json({ success: false, field: "addressId", msg: "Address ID is required." });
  }

  const user = await User.findById(userId).select("deliveryAddress");

  if (!user) {
    return res.status(404).json({ success: false, msg: "User not found." });
  }

  // Check if the address exists before trying to remove it
  const addressExists = user.deliveryAddress.some(addr => addr._id.toString() === addressId);

  if (!addressExists) {
    return res.status(404).json({ success: false, msg: "Address not found." });
  }

  // Use pull to remove the sub-document from the array
  user.deliveryAddress.pull({ _id: addressId });

  await user.save();

  return res.status(200).json({
    success: true,
    msg: "Delivery Address deleted successfully.",
    addressList: user.deliveryAddress,
  });

});

// Get a single delivery address
const getDeliveryAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { addressId } = req.query;

  if (!addressId) {
    return res.status(400).json({ success: false, field: "addressId", msg: "Delivery Address ID is required." });
  }

  const user = await User.findById(userId).select("deliveryAddress");

  if (!user) {
    return res.status(404).json({ success: false, msg: "User not found." });
  }

  const address = user.deliveryAddress.find(addr => addr._id.toString() === addressId);

  if (!address) {
    return res.status(404).json({ success: false, msg: "Address not found." });
  }

  return res.status(200).json({
    success: true,
    msg: "Delivery Address fetched successfully.",
    address: address,
  });
});

// Get all delivery addresses
const getDeliveryAddressList = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select("deliveryAddress");

  if (!user) {
    return res.status(404).json({ success: false, msg: "User not found." });
  }

  return res.status(200).json({
    success: true,
    msg: "Delivery Address list fetched successfully.",
    addressList: user.deliveryAddress,
  });
});

// Update delivery address
const updateDeliveryAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { addressId, ...updateData } = req.body;

  if (!addressId) {
    return res.status(400).json({ success: false, field: "addressId", msg: "Address ID is required in the request body." });
  }

  const user = await User.findById(userId).select("deliveryAddress");

  if (!user) {
    return res.status(404).json({ success: false, msg: "User not found." });
  }

  const addressToUpdate = user.deliveryAddress.id(addressId);

  if (!addressToUpdate) {
    return res.status(404).json({ success: false, field: "addressId", msg: "Address not found." });
  }

  // If addressType is being updated, check for uniqueness among other addresses
  if (updateData.addressType && updateData.addressType.toLowerCase() !== addressToUpdate.addressType.toLowerCase()) {
    const existingAddress = user.deliveryAddress.find(
      (addr) => addr.addressType.toLowerCase() === updateData.addressType.toLowerCase()
    );
    if (existingAddress) {
      return res.status(409).json({
        success: false,
        field: "addressType",
        msg: `An address with type '${updateData.addressType}' already exists.`,
      });
    }
  }

  // Update the fields of the address sub-document
  Object.assign(addressToUpdate, updateData);

  await user.save();

  return res.status(200).json({
    success: true,
    msg: "Delivery Address updated successfully.",
    updatedAddress: addressToUpdate,
    addressList: user.deliveryAddress,
  });
});




export {
  login,
  logoutUser,
  register,
  getAllUsers,
  updateUser,
  deleteUser,
  sendOtp,
  verifyOtp,
  forgotPassword,
  getProfile,


  addDeliveryAddress,
  getDeliveryAddressList,
  getDeliveryAddress,
  updateDeliveryAddress,
  deleteDeliveryAddress,


};




/**


  addDeliveryAddress()           - Add Delivery address                   DONE
  getDeliveryAddressList()       - Get all delivery addresses             DONE
  getDeliveryAddress()           - Get a single delivery address          DONE
  updateDeliveryAddress()        - Update delivery address                DONE
  deleteDeliveryAddress()        - Delete Delivery address                DONE


*/