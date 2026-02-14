import mongoose from 'mongoose';
import crypto from 'crypto';
import { url } from 'inspector';
import appendDomainPlugin from "../plugins/appendDomain.js";

const originCountryMapSchema = new mongoose.Schema(
	{
		countryName: {
			type: String,
			required: [true, 'countryName is required'],
			trim: true,
			unique: true,
		},

		countryCode: {
			type: String,
			required: [true, 'countryCode is required'],
			trim: true,
			unique: true,
		},

		image: {
			fileName: String,
			url: String,
		},

		description: {
			type: String,
			required: [true, 'description is required'],
			trim: true,
		},

	},
	{
		timestamps: true, // adds createdAt and updatedAt fields automatically
	}
);

originCountryMapSchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const originCountryMap = mongoose.model('originCountryMap', originCountryMapSchema);	// multiple images originCountryMap

