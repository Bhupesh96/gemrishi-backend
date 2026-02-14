import mongoose from 'mongoose';
import appendDomainPlugin from "../plugins/appendDomain.js";

const bannerSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, 'name is required'],
			trim: true,
		},

		// bannerType: {
		// 	type: String,
		// 	unique: true,
		// 	enum: ['appBanner1', 'appBanner2'],
		// },

		// pramotionId: {
		// 	type: mongoose.Schema.Types.ObjectId,
		// 	ref: 'Offer',
		// },

		image: {
			fileName: String,
			url: String,
		},

		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{
		timestamps: true, // adds createdAt and updatedAt fields automatically
	}
);

bannerSchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const Banner = mongoose.model('Banner', bannerSchema);	// multiple images banner

