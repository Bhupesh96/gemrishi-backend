import mongoose from 'mongoose';

const contactUsSchema = new mongoose.Schema(
	{

		name: {
			type: String,
			required: [true, 'Name is Required'],
			trim: true,
		},

		email: {
			type: String,
			required: [true, 'Email is Required'],
			trim: true,
		},

		gemstoneHelp: {
			type: String,
			required: [true, 'Gemstone Help is Required'],
			trim: true,
		},

		message: {
			type: String,
		},

	},
	{
		timestamps: true, // adds createdAt and updatedAt fields automatically
	}
);

export const contactUs = mongoose.model('contactUs', contactUsSchema);

