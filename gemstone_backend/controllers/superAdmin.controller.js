import asyncHandler from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


import { SuperAdmin } from '../models/superAdmin.model.js';
import { sendEmail } from '../utils/sendEmails.js';
import  uploadPath  from '../utils/uploadPaths.js';			// <-- Import the uploadPath object for file uploads

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
		Object.values(req.files).forEach(fileArr => {
			fileArr.forEach(file => {
				const filePath = path.join(__dirname, uploadPath, file.filename);
				if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
			});
		});
	}
}


// Generate JWT Token
const generateToken = (id) => {
	return jwt.sign({ id }, process.env.JWT_SECRET, {
		expiresIn: '365d', // ENHANCED: Extended token expiration for a year
	});
};




// Register SuperAdmin (Only once)
const registerSuperAdmin = asyncHandler(async (req, res) => {
	const { fullName, email, phoneNumber, password, superAdminSecretPassword } = req.body;

	const superAdminUploadPath = uploadPath.superAdminUpload;
	if (!fullName || !email || !phoneNumber || !password) {
		deleteUploadedFiles(req, superAdminUploadPath); // Clean up uploaded files if SuperAdmin not found
		return res.status(400).json({ message: 'All fields are required.' });
	}

	const existing = await SuperAdmin.findOne();
	if (existing) {
		deleteUploadedFiles(req, superAdminUploadPath); // Clean up uploaded files if SuperAdmin not found
		return res.status(403).json({ message: 'SuperAdmin already exists.' });
	}

	if (superAdminSecretPassword !== process.env.SUPER_ADMIN_SECRET) {
		deleteUploadedFiles(req, superAdminUploadPath); // Clean up uploaded files if SuperAdmin not found
		return res.status(401).json({ message: 'Invalid SuperAdmin secret password.' });
	}

	const hashedPassword = await bcrypt.hash(password, 10);

	const avtarURLPath = superAdminUploadPath.replace("../", "/");
	const superAdmin = await SuperAdmin.create({
		fullName,
		email,
		phoneNumber,
		password: hashedPassword,
		avatar: {
			fileName: req.file ? req.file.filename : null, // ENHANCED: Handle avatar upload
			url: req.file ? `${avtarURLPath}${req.file.filename}` : null, // ENHANCED: Generate URL for avatar
		},
	});

	res.status(201).json({
		message: 'SuperAdmin registered successfully.',
		// token: generateToken(superAdmin._id), // ENHANCED: JWT Token generation for SuperAdmin
		superAdmin: {
			_id: superAdmin._id,
			fullName: superAdmin.fullName,
			email: superAdmin.email,
			phoneNumber: superAdmin.phoneNumber,
			avatar: superAdmin.avatar,
		},
	});
});


// Login
const loginSuperAdmin = asyncHandler(async (req, res) => {
	const email = req.body?.email;
	const password = req.body?.password;
	// console.log(email);
	// console.log(password);

	const superAdmin = await SuperAdmin.findOne({ email });
	if (!superAdmin) {
		return res.status(404).json({ message: 'Invalid credentials.' });
	}

	const isMatch = await bcrypt.compare(password, superAdmin.password);
	if (!isMatch) {
		return res.status(401).json({ message: 'Invalid credentials.' });
	}

	res.status(200).json({
		message: 'Login successful.',
		token: generateToken(superAdmin._id), // ENHANCED: Added token generation during login
		superAdmin: {
			id: superAdmin._id,
			fullName: superAdmin.fullName,
			email: superAdmin.email,
			phoneNumber: superAdmin.phoneNumber,
		},
	});
});

// Logout (Client side should remove token)
const logoutSuperAdmin = asyncHandler(async (req, res) => {
	res.status(200).json({ message: 'Logout successful.' });
});

// Get Profile
const getSuperAdminProfile = asyncHandler(async (req, res) => {
	const superAdmin = await SuperAdmin.findById(req.user.id).select('-password');
	if (!superAdmin) {
		return res.status(404).json({ message: 'SuperAdmin not found.' });
	}
	res.status(200).json(superAdmin);
});

// Update Profile
const updateSuperAdminProfile = asyncHandler(async (req, res) => {
	const { fullName, phoneNumber, email } = req.body;
	const superAdmin = await SuperAdmin.findById(req.user.id);

	const superAdminUploadPath = uploadPath.superAdminUpload;
	if (!superAdmin) {
		deleteUploadedFiles(req, superAdminUploadPath); // Clean up uploaded files if SuperAdmin not found
		return res.status(404).json({ message: 'SuperAdmin not found.' });
	}

	// Check if a file is uploaded (avatar)
	let avatarFileName;
	let avatarURL;
	if (req.file) {
		// Delete old image if it exists
		// const uploadPath = "../public/uploads/superAdmin/";
		const uploadPath = superAdminUploadPath;
		const avtarURLPath = uploadPath.replace("../", "/");
		if (superAdmin.avatar.fileName || superAdmin.avatar.url) {
			const oldPath = path.join(__dirname, uploadPath, superAdmin.avatar.fileName);
			if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
		}
		const filesUploadPath = process.env.FILES_UPLOAD_PATH;
		avatarURL = req.file ? `${avtarURLPath}${req.file.filename}` : null;
		// avatarURL = req.file ? `/public/uploads/superAdmin/${req.file.filename}` : null;
		avatarFileName = req.file ? req.file.filename : null;
	} else {
		// Keep existing avatar if not updated
		avatarFileName = superAdmin.avatar.fileName;
		avatarURL = superAdmin.avatar.url;
	}

	// Update fields
	superAdmin.fullName = fullName || superAdmin.fullName;
	superAdmin.phoneNumber = phoneNumber || superAdmin.phoneNumber;
	superAdmin.email = email || superAdmin.email;
	superAdmin.avatar.fileName = avatarFileName;
	superAdmin.avatar.url = avatarURL;

	await superAdmin.save();

	res.status(200).json({
		message: 'Profile updated successfully.',
		superAdmin: {
			_id: superAdmin._id,
			fullName: superAdmin.fullName,
			email: superAdmin.email,
			phoneNumber: superAdmin.phoneNumber,
			avatar: superAdmin.avatar,
		},
	});
});

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
	registerSuperAdmin,
	loginSuperAdmin,
	logoutSuperAdmin,
	getSuperAdminProfile,
	updateSuperAdminProfile,
	// changeSuperAdminPassword,
	// forgotSuperAdminPassword,
	// resetSuperAdminPassword,

};




/**

	-- super admin controllers

	registerSuperAdmin()		- Registers a new SuperAdmin if one does not already exist. 	DONE
	loginSuperAdmin()			- Super Admin Login. 											DONE
	logoutSuperAdmin()			- Logs out the SuperAdmin (client-side token removal).			DONE
	getSuperAdminProfile()		- Retrieves the SuperAdmin's profile information.				DONE
	updateSuperAdminProfile()	- Updates the SuperAdmin's profile information.					DONE

	createAdmin()				- Creates a new Admin user.										DONE
	getAllAdmins()				- Retrieves all Admin users.									DONE




 */