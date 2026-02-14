import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "name is required"],
			trim: true,
			unique: true,
		},
		description: {
			type: String,
			required: [true, "description is required"],
			trim: true,
		},
		isActive: {
			type: Boolean,
			default: false,
		},
		expiryDate: {
			type: Date,
			required: [true, "expiryDate is required"],
		},
		offerType: {
			type: String,
			enum: ["unioffer", "promocode"],
			required: [true, "offerType is required"],
		},
		promoCode: {
			type: String,
			trim: true,
			lowercase: true,
			// Promo code is required if offerType is 'promocode'
			required: function () {
				return this.offerType === "promocode";
			},
		},
		productType: {
			type: String,
			enum: ["Product", "Jewelry"],
			required: [true, "productType is required"],
		},
		// Fields for 'Product' type
		isSubCategory: {
			type: Boolean,
			default: false,
		},
		subCategoryTypeId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "SubCategory",
		},
		// Fields for 'Jewelry' type
		isJewelryType: {
			type: Boolean,
			default: false,
		},
		jewelryType: {
			type: String,
			enum: ["Ring", "Pendant", "Bracelet", "Brooch", "Necklace", ""],
		},
		isJewelryMetal: {
			type: Boolean,
			default: false,
		},
		jewelryMetal: {
			type: String,
			enum: ["gold", "silver", "platinum", "panchdhatu", ""],
		},
		// Discount details
		discountValue: {
			type: Number,
			required: [true, "discountValue is required"],
			min: [0, "Discount value cannot be negative"],
		},
		discountType: {
			type: String,
			enum: ["percent", "flat"],
			required: [true, "discountType is required"],
		},
		itemAmount: {
			type: Boolean,
			default: false,
		},
		minItemAmount: {
			type: Number,
			min: [0, "Minimum item amount cannot be negative"],
		},
		maxItemAmount: {
			type: Number,
			min: [0, "Maximum item amount cannot be negative"],
		},
		totalAmount: {
			type: Boolean,
			default: false,
		},
		minTotalAmount: {
			type: Number,
			min: [0, "Minimum total amount cannot be negative"],
		},
		maxTotalAmount: {
			type: Number,
			min: [0, "Maximum total amount cannot be negative"],
		},
	},
	{
		timestamps: true, // adds createdAt and updatedAt fields automatically
	}
);

offerSchema.index({ promoCode: 1 }, { unique: true, sparse: true });

export const Offer = mongoose.model('Offer', offerSchema);
