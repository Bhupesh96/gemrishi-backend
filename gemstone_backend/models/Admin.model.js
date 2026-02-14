import mongoose from 'mongoose';
import crypto from 'crypto';
import { url } from 'inspector';
import appendDomainPlugin from "../plugins/appendDomain.js";

const adminSchema = new mongoose.Schema(
	{
		fullName: {
			type: String,
			required: [true, 'Full name is required'],
			trim: true,
		},

		email: {
			type: String,
			unique: true,
			required: [true, 'Email is required'],
			trim: true,
		},

		address: {
			type: String,
			required: false,
			trim: true,
		},

		phoneNumber: {
			type: String,
			required: false,
			trim: true,
		},

		password: {
			type: String,
			required: [true, 'Password is required'],
			minlength: [6, 'Password must be at least 6 characters'],
		},

		avatar: {
			fileName: String,
			url: String,
		},

		lastLogin: {
			type: Date,
		},

		resetPasswordToken: {
			type: String,
		},

		resetPasswordExpires: {
			type: Date,
		},
	},
	{
		timestamps: true, // adds createdAt and updatedAt fields automatically
	}
);

// 🔐 Generate password reset token
adminSchema.methods.generateResetToken = function () {
	const resetToken = crypto.randomBytes(32).toString('hex');
	this.resetPasswordToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');
	this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 mins
	return resetToken;
};

adminSchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const Admin = mongoose.model('Admin', adminSchema);
