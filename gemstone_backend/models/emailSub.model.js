import mongoose from 'mongoose';

const emailSubSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: [true, 'Email is Required'],
			trim: true,
		},

		isActive: {
			type: Boolean,
			default: true,
		},

		unsubReason: {
			type: String,
			trim: true,
		},
	},
	{
		timestamps: true, // adds createdAt and updatedAt fields automatically
	}
);

export const emailSub = mongoose.model('emailSub', emailSubSchema);

