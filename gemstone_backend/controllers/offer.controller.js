import asyncHandler from "../utils/asyncHandler.js";
import fetch from "node-fetch";
import mongoose from "mongoose";


import { Product } from "../models/product.model.js";
import { SubCategory } from "../models/subcategory.model.js";
import { MetalRates } from "../models/metalRates.model.js";

import { User } from "../models/user.model.js";
import { Offer } from "../models/offer.model.js";
import { Jewelry } from "../models/jewelry.model.js";
// import { SubCategory } from "../models/subcategory.model.js";



const createOfferTemp = asyncHandler(async (req, res) => {
	const { productId } = req.params;
	const { name, description, percent, amount, expiryDate } = req.body;
	const product = await Product.findById(productId);
	if (!product) {
		return res.status(404).json({ msg: "No prod found" });
	}

	const expireBy = Math.floor(new Date(expiryDate).getTime() / 1000);

	const basicAuth = Buffer.from(
		process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
	).toString("base64");

	const response = await fetch("https://api.razorpay.com/v1/offers", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${basicAuth}`,
		},
		body: JSON.stringify({
			name,
			description,
			percent,
			amount,
			offer_type: "discount",
			type: "instant",
			payment_method: "card",
			currency: "INR",
			expire_by: expireBy,
		}),
	});

	const data = await response.json();

	if (!response || !data.id) {
		return res.status(400).json({ msg: "offer failed", error: data });
	}

	product.offerId = data.id;
	await product.save();

	return res.status(200).json({
		msg: "Offer applied to product",
	});
});


const createOfferJ = asyncHandler(async (req, res) => {
	const { jewelryId } = req.params;
	const { name, description, percent, amount, expiryDate } = req.body;
	const product = await Jewelry.findById(jewelryId);
	if (!product) {
		return res.status(404).json({ msg: "No prod found" });
	}

	const expireBy = Math.floor(new Date(expiryDate).getTime() / 1000);

	const basicAuth = Buffer.from(
		process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
	).toString("base64");

	const response = await fetch("https://api.razorpay.com/v1/offers", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${basicAuth}`,
		},
		body: JSON.stringify({
			name,
			description,
			percent,
			amount,
			offer_type: "discount",
			type: "instant",
			payment_method: "card",
			currency: "INR",
			expire_by: expireBy,
		}),
	});

	const data = await response.json();

	if (!response || !data.id) {
		return res.status(400).json({ msg: "offer failed", error: data });
	}

	product.offerId = data.id;
	await product.save();

	return res.status(200).json({
		msg: "Offer applied to product",
	});
});

export const removeOffer = asyncHandler(async (req, res) => {
	const { productId } = req.params;
	const product = await Product.findById(productId);
	if (!product) {
		return res.status(404).json({ msg: "No Product foudn" });
	}
	product.offerId = undefined;
	await product.save();
	return res.status(200).json({ msg: "Product offer id deleted" });
});




// creaete offer
const createOffer = asyncHandler(async (req, res) => {
	try {
		const {
			name,
			description,
			isActive,
			expiryDate,
			offerType,
			promoCode,
			productType,
			isSubCategory,
			subCategoryTypeId,
			isJewelryType,
			isJewelryMetal,
			jewelryType,
			jewelryMetal,
			discountValue,
			discountType,
			itemAmount,
			minItemAmount,
			maxItemAmount,
			totalAmount,
			minTotalAmount,
			maxTotalAmount,
		} = req.body;

		// --- Basic Validation ---
		if (
			!name ||
			!description ||
			!expiryDate ||
			!offerType ||
			!productType ||
			!discountValue ||
			!discountType
		) {
			return res.status(400).json({
				success: false,
				message: 'Missing required fields.',
			});
		}

		// --- Enum Validation ---
		const offerTypeEnum = ["unioffer", "promocode"];
		if (!offerTypeEnum.includes(offerType)) {
			return res.status(400).json({
				success: false,
				message: `Invalid offerType. Must be one of: ${offerTypeEnum.join(', ')}`,
			});
		}

		const productTypeEnum = ["Product", "Jewelry"];
		if (!productTypeEnum.includes(productType)) {
			return res.status(400).json({
				success: false,
				message: `Invalid productType. Must be one of: ${productTypeEnum.join(', ')}`,
			});
		}

		const discountTypeEnum = ["percent", "flat"];
		if (!discountTypeEnum.includes(discountType)) {
			return res.status(400).json({
				success: false,
				message: `Invalid discountType. Must be one of: ${discountTypeEnum.join(', ')}`,
			});
		}

		// --- Boolean Validation and Coercion ---
		const booleanFields = { isActive, isSubCategory, isJewelryType, isJewelryMetal, itemAmount, totalAmount };
		for (const [key, value] of Object.entries(booleanFields)) {
			if (value !== undefined && value !== null && !['true', 'false', true, false].includes(value)) {
				return res.status(400).json({
					success: false,
					message: `Invalid value for ${key}. It must be a boolean (true or false).`
				});
			}
		}

		if (offerType === 'promocode' && !promoCode) {
			return res.status(400).json({
				success: false,
				message: 'Promo code is required for offer type "promocode".',
			});
		}

		// --- Uniqueness Validations ---
		const existingOfferByName = await Offer.findOne({ name });
		if (existingOfferByName) {
			return res.status(409).json({ // 409 Conflict
				success: false,
				message: 'An offer with this name already exists. Please use a different name.',
			});
		}

		if (offerType === 'promocode') {
			const existingPromoCode = await Offer.findOne({ promoCode: promoCode.toLowerCase() });
			if (existingPromoCode) {
				return res.status(409).json({ // 409 Conflict
					success: false,
					message: 'This promo code is already in use. Please choose a different one.',
				});
			}
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0); // Set to the beginning of today

		const offerExpiryDate = new Date(expiryDate);

		if (isNaN(offerExpiryDate.getTime()) || offerExpiryDate < today) {
			return res.status(400).json({
				success: false,
				message: 'Expiry date must be a valid date and cannot be in the past.',
			});
		}


		// --- Conditional Validation ---
		if (productType === 'Product' && isSubCategory == true) {
			if (!subCategoryTypeId) {
				return res.status(400).json({
					success: false,
					message: 'subCategoryTypeId is required for this offer type.',
				});
			}

			const subCategoryExists = await SubCategory.findById(subCategoryTypeId);
			if (!subCategoryExists) {
				return res.status(404).json({
					success: false,
					message: 'SubCategory with the provided ID does not exist.',
				});
			}
		}

		if (productType === 'Jewelry') {
			const jewelryTypeEnum = ["Ring", "Pendant", "Bracelet", "Brooch", "Necklace", "Earrings"];
			const jewelryMetalEnum = ["gold", "silver", "platinum", "panchdhatu", ""];

			if (isJewelryType == 'true' && !jewelryType) {
				return res.status(400).json({
					success: false,
					message: 'jewelryType is required when isJewelryType is true.',
				});
			}
			if (isJewelryType == 'true' && !jewelryTypeEnum.includes(jewelryType)) {
				return res.status(400).json({
					success: false,
					message: `Invalid jewelryType. Must be one of: ${jewelryTypeEnum.join(', ')}`,
				});
			}

			if (isJewelryMetal == 'true' && !jewelryMetal) {
				return res.status(400).json({
					success: false,
					message: 'jewelryMetal is required when isJewelryMetal is true.',
				});
			}
			if (isJewelryMetal == 'true' && !jewelryMetalEnum.includes(jewelryMetal)) {
				return res.status(400).json({
					success: false,
					message: `Invalid jewelryMetal. Must be one of: ${jewelryMetalEnum.join(', ')}`,
				});
			}
		}

		if (itemAmount == 'true') {
			if (!minItemAmount || !maxItemAmount) {
				return res.status(400).json({
					success: false,
					message: 'minItemAmount and maxItemAmount are required when itemAmount is true.',
				});
			}

			if (minItemAmount > maxItemAmount) {
				return res.status(400).json({
					success: false,
					message: 'minItemAmount cannot be greater than maxItemAmount.',
				});
			}

			if (Number(minItemAmount) === Number(maxItemAmount)) {
				return res.status(400).json({
					success: false,
					message: 'minItemAmount and maxItemAmount cannot be equal.',
				});
			}
		}

		if (totalAmount == 'true') {
			if (!minTotalAmount || !maxTotalAmount) {
				return res.status(400).json({
					success: false,
					message: 'minTotalAmount and maxTotalAmount are required when totalAmount is true.',
				});
			}

			if (minTotalAmount > maxTotalAmount) {
				return res.status(400).json({
					success: false,
					message: 'minTotalAmount cannot be greater than maxTotalAmount.',
				});
			}

			if (Number(minTotalAmount) === Number(maxTotalAmount)) {
				return res.status(400).json({
					success: false,
					message: 'minTotalAmount and maxTotalAmount cannot be equal.',
				});
			}
		}


		const offerData = {
			name,
			description,
			isActive,
			expiryDate,
			offerType,
			promoCode: offerType === 'promocode' ? promoCode : undefined,
			productType,
			isSubCategory: isSubCategory,
			subCategoryTypeId: isSubCategory == true || isSubCategory == 'true' ? subCategoryTypeId : undefined,
			isJewelryType: isJewelryType,
			jewelryType: isJewelryType == true || isJewelryType == 'true' ? jewelryType : undefined,
			isJewelryMetal: isJewelryMetal,
			jewelryMetal: isJewelryMetal == true || isJewelryMetal == 'true' ? jewelryMetal : undefined,
			discountValue,
			discountType,
			itemAmount,
			minItemAmount: itemAmount == true || itemAmount == 'true' ? minItemAmount : undefined,
			maxItemAmount: itemAmount == true || itemAmount == 'true' ? maxItemAmount : undefined,
			totalAmount,
			minTotalAmount: totalAmount == true || totalAmount == 'true' ? minTotalAmount : undefined,
			maxTotalAmount: totalAmount == true || totalAmount == 'true' ? maxTotalAmount : undefined,
		};

		const newOffer = await Offer.create(offerData);

		return res.status(201).json({
			success: true,
			message: 'Offer created successfully.',
			data: newOffer,
		});
	} catch (error) {
		console.error(`Error creating offer: ${error.message}`);
		// This will catch other potential duplicate key errors if added in the future
		if (error.code === 11000) {
			return res.status(409).json({
				success: false,
				message: `Duplicate key error: An offer with this ${Object.keys(error.keyValue)[0]} already exists.`,
			});
		}
		return res.status(500).json({
			success: false,
			message: 'An unexpected error occurred while creating the offer.',
			error: error.message,
		});
	}
});

// Update an offer
const updateOffer = asyncHandler(async (req, res) => {
	try {
		const { offerId } = req.params;
		const updateData = req.body;

		const offer = await Offer.findById(offerId);
		if (!offer) {
			return res.status(404).json({
				success: false,
				message: 'Offer not found.',
			});
		}

		// --- Uniqueness Validations ---
		if (updateData.name && updateData.name != offer.name) {
			const existingOfferByName = await Offer.findOne({ name: updateData.name, _id: { $ne: offerId } });
			if (existingOfferByName) {
				return res.status(409).json({
					success: false,
					message: 'An offer with this name already exists. Please use a different name.',
				});
			}
		}

		const offerType = updateData.offerType || offer.offerType;
		if (offerType == 'promocode' && updateData.promoCode && updateData.promoCode.toLowerCase() != offer.promoCode) {
			const existingPromoCode = await Offer.findOne({ promoCode: updateData.promoCode.toLowerCase(), _id: { $ne: offerId } });
			if (existingPromoCode) {
				return res.status(409).json({
					success: false,
					message: 'This promo code is already in use. Please choose a different one.',
				});
			}
		}

		// --- Enum Validation ---
		if (updateData.offerType) {
			const offerTypeEnum = ["unioffer", "promocode"];
			if (!offerTypeEnum.includes(updateData.offerType)) {
				return res.status(400).json({ success: false, message: `Invalid offerType. Must be one of: ${offerTypeEnum.join(', ')}` });
			}
		}
		if (updateData.productType) {
			const productTypeEnum = ["Product", "Jewelry"];
			if (!productTypeEnum.includes(updateData.productType)) {
				return res.status(400).json({ success: false, message: `Invalid productType. Must be one of: ${productTypeEnum.join(', ')}` });
			}
		}
		if (updateData.discountType) {
			const discountTypeEnum = ["percent", "flat"];
			if (!discountTypeEnum.includes(updateData.discountType)) {
				return res.status(400).json({ success: false, message: `Invalid discountType. Must be one of: ${discountTypeEnum.join(', ')}` });
			}
		}

		// --- Date Validation ---
		if (updateData.expiryDate) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const offerExpiryDate = new Date(updateData.expiryDate);
			if (isNaN(offerExpiryDate.getTime()) || offerExpiryDate < today) {
				return res.status(400).json({
					success: false,
					message: 'Expiry date must be a valid date and cannot be in the past.',
				});
			}
		}

		// --- Conditional Validation ---
		const productType = updateData.productType || offer.productType;
		const isSubCategory = updateData.isSubCategory != undefined ? (String(updateData.isSubCategory) == 'true') : offer.isSubCategory;

		if (productType == 'Product' && isSubCategory) {
			const subCategoryTypeId = updateData.subCategoryTypeId || offer.subCategoryTypeId;
			if (!subCategoryTypeId) {
				return res.status(400).json({ success: false, message: 'subCategoryTypeId is required for this offer type.' });
			}
			const subCategoryExists = await SubCategory.findById(subCategoryTypeId);
			if (!subCategoryExists) {
				return res.status(404).json({ success: false, message: 'SubCategory with the provided ID does not exist.' });
			}
		}

		if (productType == 'Jewelry') {
			const isJewelryType = updateData.isJewelryType != undefined ? (String(updateData.isJewelryType) == 'true') : offer.isJewelryType;
			const isJewelryMetal = updateData.isJewelryMetal != undefined ? (String(updateData.isJewelryMetal) == 'true') : offer.isJewelryMetal;
			const jewelryType = updateData.jewelryType || offer.jewelryType;
			const jewelryMetal = updateData.jewelryMetal || offer.jewelryMetal;

			if (isJewelryType && !jewelryType) {
				return res.status(400).json({ success: false, message: 'jewelryType is required when isJewelryType is true.' });
			}
			if (isJewelryMetal && !jewelryMetal) {
				return res.status(400).json({ success: false, message: 'jewelryMetal is required when isJewelryMetal is true.' });
			}
		}

		const itemAmount = updateData.itemAmount != undefined ? (String(updateData.itemAmount) == 'true') : offer.itemAmount;
		if (itemAmount) {
			const minItemAmount = updateData.minItemAmount != undefined ? updateData.minItemAmount : offer.minItemAmount;
			const maxItemAmount = updateData.maxItemAmount != undefined ? updateData.maxItemAmount : offer.maxItemAmount;
			if (minItemAmount == undefined || maxItemAmount == undefined) {
				return res.status(400).json({ success: false, message: 'minItemAmount and maxItemAmount are required when itemAmount is true.' });
			}
			if (Number(minItemAmount) > Number(maxItemAmount)) {
				return res.status(400).json({ success: false, message: 'minItemAmount cannot be greater than maxItemAmount.' });
			}
			if (Number(minItemAmount) == Number(maxItemAmount)) {
				return res.status(400).json({ success: false, message: 'minItemAmount and maxItemAmount cannot be equal.' });
			}
		}

		const totalAmount = updateData.totalAmount != undefined ? (String(updateData.totalAmount) == 'true') : offer.totalAmount;
		if (totalAmount) {
			const minTotalAmount = updateData.minTotalAmount != undefined ? updateData.minTotalAmount : offer.minTotalAmount;
			const maxTotalAmount = updateData.maxTotalAmount != undefined ? updateData.maxTotalAmount : offer.maxTotalAmount;
			if (minTotalAmount == undefined || maxTotalAmount == undefined) {
				return res.status(400).json({ success: false, message: 'minTotalAmount and maxTotalAmount are required when totalAmount is true.' });
			}
			if (Number(minTotalAmount) > Number(maxTotalAmount)) {
				return res.status(400).json({ success: false, message: 'minTotalAmount cannot be greater than maxTotalAmount.' });
			}
			if (Number(minTotalAmount) == Number(maxTotalAmount)) {
				return res.status(400).json({ success: false, message: 'minTotalAmount and maxTotalAmount cannot be equal.' });
			}
		}

		// --- Update Fields ---
		const fieldsToUpdate = [
			'name', 'description', 'isActive', 'expiryDate', 'offerType', 'promoCode',
			'productType', 'isSubCategory', 'subCategoryTypeId', 'isJewelryType',
			'jewelryType', 'isJewelryMetal', 'jewelryMetal', 'discountValue',
			'discountType', 'itemAmount', 'minItemAmount', 'maxItemAmount',
			'totalAmount', 'minTotalAmount', 'maxTotalAmount'
		];

		fieldsToUpdate.forEach(field => {
			if (updateData[field] != undefined) {
				if (['isActive', 'isSubCategory', 'isJewelryType', 'isJewelryMetal', 'itemAmount', 'totalAmount'].includes(field)) {
					offer[field] = String(updateData[field]) == ('true' || true);
				} else {
					offer[field] = updateData[field];
				}
			}
		});

		console.log(offer);

		// --- Reset conditional fields if their condition becomes false ---
		if (updateData.offerType && updateData.offerType != 'promocode') {
			offer.promoCode = undefined;
		}
		if (updateData.productType && updateData.productType != 'Product') {
			offer.isSubCategory = undefined;
			offer.subCategoryTypeId = undefined;
		}
		if (updateData.productType && updateData.productType != 'Jewelry') {
			offer.isJewelryType = undefined;
			offer.jewelryType = undefined;
			offer.isJewelryMetal = undefined;
			offer.jewelryMetal = undefined;
		}
		if (updateData.itemAmount != undefined && String(updateData.itemAmount) == 'false') {
			offer.minItemAmount = undefined;
			offer.maxItemAmount = undefined;
		}
		if (updateData.totalAmount != undefined && String(updateData.totalAmount) == 'false') {
			offer.minTotalAmount = undefined;
			offer.maxTotalAmount = undefined;
		}

		console.log(offer);

		const updatedOffer = await offer.save();

		return res.status(200).json({
			success: true,
			message: 'Offer updated successfully.',
			data: updatedOffer,
		});

	} catch (error) {
		console.error(`Error updating offer: ${error.message}`);
		if (error.code == 11000) {
			return res.status(409).json({
				success: false,
				message: `Duplicate key error: An offer with this ${Object.keys(error.keyValue)[0]} already exists.`,
			});
		}
		return res.status(500).json({
			success: false,
			message: 'An unexpected error occurred while updating the offer.',
			error: error.message,
		});
	}
});

// Delete offer
const deleteOffer = asyncHandler(async (req, res) => {
	const { offerId } = req.params;

	if (!offerId) {
		return res.status(400).json({ success: false, message: 'Offer ID is required.' });
	}

	if (!mongoose.Types.ObjectId.isValid(offerId)) {
		return res.status(400).json({ success: false, message: 'Invalid Offer ID format.' });
	}

	const deletedOffer = await Offer.findByIdAndDelete(offerId);

	if (!deletedOffer) {
		return res.status(404).json({ success: false, message: 'Offer not found.' });
	}

	return res.status(200).json({
		success: true,
		message: 'Offer deleted successfully.',
	});
});


// Get single offer details for Admin
const getOfferDetailsAdmin = asyncHandler(async (req, res) => {
	const { offerId } = req.query;

	if (!offerId) {
		return res.status(400).json({ success: false, message: 'Offer ID is required as a query parameter.' });
	}

	if (!mongoose.Types.ObjectId.isValid(offerId)) {
		return res.status(400).json({ success: false, message: 'Invalid Offer ID format.' });
	}

	const offer = await Offer.findById(offerId);

	if (!offer) {
		return res.status(404).json({ success: false, message: 'Offer not found.' });
	}

	return res.status(200).json({
		success: true,
		message: 'Offer details fetched successfully.',
		data: offer,
	});
});

// Get all offers with pagination
const getAllOffers = asyncHandler(async (req, res) => {
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;
	const { search } = req.query;

	// Base query for public offers: active and not expired
	const query = {
		isActive: true,
		expiryDate: { $gte: new Date() } // Only fetch offers that have not expired
	};

	// If a search term is provided, add search conditions to the query
	if (search) {
		const searchRegex = new RegExp(search, 'i'); // 'i' for case-insensitive
		query.$and = [
			{
				$or: [
					{ name: { $regex: searchRegex } },
					{ description: { $regex: searchRegex } },
				]
			}
		];
	}

	const offersPromise = Offer.find(query)
		.sort({ createdAt: -1 }) // Sort by most recent
		.skip(skip)
		.limit(limit)
		.lean();

	const totalOffersPromise = Offer.countDocuments(query);

	const [offers, totalOffers] = await Promise.all([offersPromise, totalOffersPromise]);

	if (totalOffers === 0) {
		return res.status(200).json({
			success: true,
			message: search ? `No offers found matching your search for "${search}".` : 'No offers found.',
			data: [],
			pagination: {
				totalItems: 0,
				totalPages: 0,
				currentPage: 1,
				limit,
			},
		});
	}

	return res.status(200).json({
		success: true,
		message: 'Offers fetched successfully.',
		data: offers,
		pagination: {
			totalItems: totalOffers,
			totalPages: Math.ceil(totalOffers / limit),
			currentPage: page,
			limit,
		},
	});
});

// Get all offers for Admin with pagination
const getAllOffersAdmin = asyncHandler(async (req, res) => {
	const page = parseInt(req.query.page, 10) || 1;
	const limit = parseInt(req.query.limit, 10) || 10;
	const skip = (page - 1) * limit;
	const { search } = req.query;

	// Base query for admin (fetches all offers)
	const query = {};

	// If a search term is provided, add search conditions to the query
	if (search) {
		const searchRegex = new RegExp(search, 'i'); // 'i' for case-insensitive
		query.$or = [
			{ name: { $regex: searchRegex } },
			{ description: { $regex: searchRegex } },
			{ promoCode: { $regex: searchRegex } },
		];
	}
	const offersPromise = Offer.find(query)
		.sort({ createdAt: -1 }) // Sort by most recent
		.skip(skip)
		.limit(limit)
		.lean();

	const totalOffersPromise = Offer.countDocuments(query);

	const [offers, totalOffers] = await Promise.all([offersPromise, totalOffersPromise]);

	if (totalOffers === 0) {
		return res.status(200).json({
			success: true,
			message: search ? `No offers found matching your search for "${search}".` : 'No offers found.',
			data: [],
			pagination: {
				totalItems: 0,
				totalPages: 0,
				currentPage: 1,
				limit,
			},
		});
	}

	return res.status(200).json({
		success: true,
		message: 'All offers fetched successfully for admin.',
		data: offers,
		pagination: {
			totalItems: totalOffers,
			totalPages: Math.ceil(totalOffers / limit),
			currentPage: page,
			limit,
		},
	});
});

// Get single public offer details
const getOfferDetails = asyncHandler(async (req, res) => {
	const { offerId } = req.query;

	if (!offerId) {
		return res.status(400).json({ success: false, message: 'Offer ID is required as a query parameter.' });
	}

	if (!mongoose.Types.ObjectId.isValid(offerId)) {
		return res.status(400).json({ success: false, message: 'Invalid Offer ID format.' });
	}

	// Find an offer that is active and has not expired
	const offer = await Offer.findOne({
		_id: offerId,
		isActive: true,
		expiryDate: { $gte: new Date() }
	});

	if (!offer) {
		return res.status(404).json({ success: false, message: 'Offer not found or has expired.' });
	}

	return res.status(200).json({
		success: true,
		message: 'Offer details fetched successfully.',
		data: offer,
	});
});

// not relevant
const applyPromoCode = asyncHandler(async (req, res) => {
	const { promoCode } = req.body;
	const userId = req.user._id;

	if (!promoCode) {
		return res.status(400).json({ success: false, message: 'Promo code is required.' });
	}

	// 1. Find the offer by promo code, ensuring it's active and not expired.
	const offer = await Offer.findOne({
		promoCode: promoCode.toLowerCase(),
		isActive: true,
		expiryDate: { $gte: new Date() }
	});

	if (!offer || offer.offerType !== 'promocode') {
		return res.status(404).json({ success: false, message: 'Invalid or expired promo code.' });
	}

	// 2. Get the user's cart and populate necessary item details for validation.
	const user = await User.findById(userId)
		.populate([
			{
				path: 'cart.item',
				select: 'subCategory jewelryType metal price', // Select fields needed for validation
				populate: {
					path: 'subCategory', // Nested populate for Product's subCategory
					select: '-products' // Exclude the 'products' field
				}
			},
			{
				path: 'cart.customization.jewelryId', // Populate the jewelry part of a customization
				select: 'jewelryType metal jewelryPrice jewelryMetalWeight'
			}
		]);

	if (!user || user.cart.length === 0) {
		return res.status(400).json({ success: false, message: 'Your cart is empty. Add items to apply a promo code.' });
	}

	// 3. Validate the offer against the cart contents.
	let applicableItemsValue = 0;
	let cartTotalValue = 0;

	// First, find which items in the cart are eligible for the offer.
	let applicableItems = [];
	user.cart.forEach(cartItem => {
		cartTotalValue += cartItem.totalPrice * cartItem.quantity;

		// Scenario 1: Offer is for 'Product' and cart item is a 'Product'
		if (offer.productType === 'Product' && cartItem.itemType === 'Product') {
			let isApplicable = true;
			// Check if the offer is for a specific subcategory and if the item matches.
			if (offer.isSubCategory && (!cartItem.item.subCategory || cartItem.item.subCategory._id.toString() !== offer.subCategoryTypeId.toString())) {
				isApplicable = false;
			}
			if (isApplicable) {
				// If the item is a gemstone without attached jewelry, the discount applies only to the gemstone's base price.
				const discountableValue = cartItem.item.price * cartItem.quantity;
				applicableItemsValue += discountableValue;

				// Add the item to the list with its discountable value for reference
				applicableItems.push({ ...cartItem.toObject(), discountableValue });
				console.log("1 discountableValue", discountableValue, "discountableValue", discountableValue);

			}
		}

		// Scenario 2: Offer is for 'Jewelry' and cart item is a standalone 'Jewelry'
		if (offer.productType === 'Jewelry' && cartItem.itemType === 'Jewelry') {
			let isApplicable = true;
			if (offer.isJewelryType && cartItem.item.jewelryType !== offer.jewelryType) {
				isApplicable = false;
			}
			if (offer.isJewelryMetal && cartItem.item.metal !== offer.jewelryMetal) {
				isApplicable = false;
			}
			if (isApplicable) {
				applicableItems.push(cartItem);
				applicableItemsValue += cartItem.totalPrice * cartItem.quantity;
				console.log("discountableValue", discountableValue, discountableValue);
			}
		}

		// Scenario 3: Offer is for 'Jewelry' and cart item is a 'Product' with attached jewelry
		if (offer.productType === 'Jewelry' && cartItem.itemType === 'Product' && cartItem.customization?.jewelryId) {
			const attachedJewelry = cartItem.customization.jewelryId; // This is now populated
			let isApplicable = true;

			if (offer.isJewelryType && attachedJewelry.jewelryType !== offer.jewelryType) {
				isApplicable = false;
			}
			if (offer.isJewelryMetal && attachedJewelry.metal !== offer.jewelryMetal) {
				isApplicable = false;
			}

			if (isApplicable) {
				// IMPORTANT: Only add the value of the jewelry part to the discountable amount
				const jewelryValue = attachedJewelry.jewelryPrice + (cartItem.customization.goldKarat?.price || 0);
				applicableItems.push(cartItem); // Still add the whole cart item to the list of affected items
				applicableItemsValue += jewelryValue * cartItem.quantity;
				console.log("discountableValue", discountableValue, discountableValue);

			}
		}
	});


	if (applicableItems.length === 0) {
		return res.status(400).json({ success: false, message: 'This promo code is not applicable to any items in your cart.' });
	}

	// 4. Check amount-based conditions (e.g., "on orders over $100").
	if (offer.totalAmount) {
		if (cartTotalValue < offer.minTotalAmount || cartTotalValue > offer.maxTotalAmount) {
			return res.status(400).json({ success: false, message: `This promo code is only valid for orders between ${offer.minTotalAmount} and ${offer.maxTotalAmount}.` });
		}
	}

	if (offer.itemAmount) {
		if (applicableItemsValue < offer.minItemAmount || applicableItemsValue > offer.maxItemAmount) {
			return res.status(400).json({ success: false, message: `This promo code requires the total value of applicable items to be between ${offer.minItemAmount} and ${offer.maxItemAmount}.` });
		}
	}

	// 5. Calculate the discount.
	let discountAmount = 0;
	if (offer.discountType === 'percent') {
		discountAmount = (applicableItemsValue * offer.discountValue) / 100;
		console.log("total discountAmount", discountAmount);
	} else if (offer.discountType === 'flat') {
		discountAmount = offer.discountValue;
	}

	// Ensure flat discount doesn't exceed the value of applicable items.
	if (discountAmount > applicableItemsValue) {
		discountAmount = applicableItemsValue;
	}

	return res.status(200).json({
		success: true,
		message: 'Promo code applied successfully!',
		data: {
			// offerDetails: offer,
			applicableItems: applicableItems,
			discountAmount: parseFloat(discountAmount.toFixed(2)),
			cartTotal: cartTotalValue,
			newTotal: parseFloat((cartTotalValue - discountAmount).toFixed(2)),
		}
	});
});


// Apply Promo Code (final implementation)
const applyPromoCode2 = asyncHandler(async (req, res) => {
	const { promoCode } = req.body;
	const userId = req.user && req.user._id;

	if (!promoCode) {
		return res.status(400).json({ success: false, message: 'Promo code is required.' });
	}

	if (!userId) {
		return res.status(401).json({ success: false, message: 'Unauthorized.' });
	}

	// 1. Find the offer by promo code, ensuring it's active and not expired.
	const offer = await Offer.findOne({
		promoCode: promoCode.toLowerCase(),
		isActive: true,
		expiryDate: { $gte: new Date() }
	});

	if (!offer || offer.offerType !== 'promocode') {
		return res.status(404).json({ success: false, message: 'Invalid or expired promo code.' });
	}

	// 2. Get the user's cart and populate necessary item details for validation.
	const user = await User.findById(userId)
		.populate([
			{
				path: 'cart.item',
				select: 'subCategory price sellPrice jewelryType metal jewelryPrice',
				populate: {
					path: 'subCategory',
					select: '-products'
				}
			},
			{
				path: 'cart.customization.jewelryId',
				select: 'jewelryPrice jewelryType metal jewelryMetalWeight'
			}
		]);

	if (!user || !user.cart || user.cart.length === 0) {
		return res.status(400).json({ success: false, message: 'Your cart is empty. Add items to apply a promo code.' });
	}

	// Helper to sum relevant customization prices
	const customizationExtraPrice = (customization = {}) => {
		let sum = 0;
		if (customization.certificate && customization.certificate.price) sum += Number(customization.certificate.price);
		if (customization.gemstoneWeight && customization.gemstoneWeight.price) sum += Number(customization.gemstoneWeight.price);
		if (customization.goldKarat && customization.goldKarat.price) sum += Number(customization.goldKarat.price);
		if (customization.diamondSubstitute && customization.diamondSubstitute.price) sum += Number(customization.diamondSubstitute.price);
		if (customization.sizeSystem && customization.sizeSystem.price) sum += Number(customization.sizeSystem.price);
		return sum;
	};

	const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 });
	if (!latestMetalRates) {
		return res.status(503).json({ success: false, message: "Metal rates are currently unavailable. Please try again later." });
	}

	// 3. Validate the offer against the cart contents.
	let applicableItemsValue = 0;
	let cartTotalValue = 0;
	let discountAmount = 0;
	const applicableItems = [];


	let temp_count = 0;
	user.cart.forEach(cartItem => {
		temp_count += 1;
		const qty = Number(cartItem.quantity) || 1;
		const itemTotalPrice = Number(cartItem.totalPrice) || 0;
		cartTotalValue += itemTotalPrice * qty;

		let itemDiscount = 0;

		// Ensure we have the populated item when needed
		const populatedItem = cartItem.item && cartItem.item.toObject ? cartItem.item.toObject() : cartItem.item;

		// checking for the offer
		// Scenario 1: Offer is for 'Product' and cart item is a 'Product'
		if (offer.productType === 'Product' && cartItem.itemType === 'Product' && !cartItem.customization.jewelryId) {
			let isApplicable = false;

			// Check if the offer is for a specific subcategory and if the item matches.
			if (offer.isSubCategory == true && cartItem.item.subCategory) {
				if (offer.subCategoryTypeId && offer.subCategoryTypeId.toString() == cartItem.item.subCategory._id.toString()) {
					isApplicable = true;
					// If the item is a gemstone without attached jewelry, the discount applies only to the gemstone's base price.

					if (offer.itemAmount && offer.itemAmount == true) {
						console.log(itemTotalPrice < offer.maxItemAmount);
						if (itemTotalPrice > offer.minItemAmount && itemTotalPrice < offer.maxItemAmount) {
							//Calculate the discount.
							if (offer.discountType === 'percent') {
								itemDiscount = (cartItem.item.price * offer.discountValue) / 100;
								console.log("total itemDiscount", itemDiscount);
							} else if (offer.discountType === 'flat') {
								itemDiscount = offer.discountValue;
							}
						}
					} else {
						//Calculate the discount.
						if (offer.discountType === 'percent') {
							itemDiscount += (cartItem.item.price * offer.discountValue) / 100;
							console.log("isSubCategory only total itemDiscount", itemDiscount);
						} else if (offer.discountType === 'flat') {
							itemDiscount = offer.discountValue;
						}
					}

				}
			}

			if (offer.itemAmount && offer.itemAmount == true && offer.isSubCategory == false) {
				if (itemTotalPrice > offer.minItemAmount && itemTotalPrice < offer.maxItemAmount) {
					isApplicable = true;
					//Calculate the discount.
					if (offer.discountType === 'percent') {
						itemDiscount = (cartItem.item.price * offer.discountValue) / 100;
						console.log("total itemDiscount", itemDiscount);
					} else if (offer.discountType === 'flat') {
						itemDiscount = offer.discountValue;
					}
				}
			}

			// Calculate the discountable value of the item
			const discountableValue = itemTotalPrice - itemDiscount;
			applicableItemsValue += discountableValue;

			if (isApplicable) {
				applicableItems.push({
					item: populatedItem,
					qty,
					discount: itemDiscount,
					totalPrice: itemTotalPrice,
					discountableValue: discountableValue
				});
				console.log("temp_count", temp_count);
				console.log("discountAmount", discountAmount);
				console.log(populatedItem);
			}

		}

		// Scenario 1: Offer is for 'Product' and cart item is a 'Product'
		if (offer.productType === 'Product' && cartItem.itemType === 'Product' && cartItem.customization.jewelryId) {
			let isApplicable = false;

			// Check if the offer is for a specific subcategory and if the item matches.
			if (offer.isSubCategory == true && cartItem.item.subCategory) {
				if (offer.subCategoryTypeId && offer.subCategoryTypeId.toString() == cartItem.item.subCategory._id.toString()) {
					isApplicable = true;
					// If the item is a gemstone without attached jewelry, the discount applies only to the gemstone's base price.

					if (offer.itemAmount && offer.itemAmount == true) {
						console.log(itemTotalPrice < offer.maxItemAmount);
						if (itemTotalPrice > offer.minItemAmount && itemTotalPrice < offer.maxItemAmount) {
							//Calculate the discount.
							if (offer.discountType === 'percent') {
								itemDiscount = (cartItem.item.price * offer.discountValue) / 100;
								console.log("total itemDiscount", itemDiscount);
							} else if (offer.discountType === 'flat') {
								itemDiscount = offer.discountValue;
							}
						}
					} else {
						//Calculate the discount.
						if (offer.discountType === 'percent') {
							itemDiscount += (cartItem.item.price * offer.discountValue) / 100;
							console.log("isSubCategory only total itemDiscount", itemDiscount);
						} else if (offer.discountType === 'flat') {
							itemDiscount = offer.discountValue;
						}
					}

				}
			}

			if (offer.itemAmount && offer.itemAmount == true && offer.isSubCategory == false) {
				if (itemTotalPrice > offer.minItemAmount && itemTotalPrice < offer.maxItemAmount) {
					isApplicable = true;
					//Calculate the discount.
					if (offer.discountType === 'percent') {
						itemDiscount = (cartItem.item.price * offer.discountValue) / 100;
						console.log("total itemDiscount", itemDiscount);
					} else if (offer.discountType === 'flat') {
						itemDiscount = offer.discountValue;
					}
				}
			}

			// Calculate the discountable value of the item
			const discountableValue = itemTotalPrice - itemDiscount;
			applicableItemsValue += discountableValue;

			if (isApplicable) {
				applicableItems.push({
					item: populatedItem,
					qty,
					discount: itemDiscount,
					totalPrice: itemTotalPrice,
					discountableValue: discountableValue
				});
				console.log("temp_count", temp_count);
				console.log("discountAmount", discountAmount);
				console.log(populatedItem);
			}

		}


		// Scenario 2: Offer is for 'Jewelry' and cart item is a 'Jewelry'
		if (offer.productType == 'Jewelry' && cartItem.itemType == 'Jewelry' && offer.productType == 'Product') {
			let isApplicable = false;

			if (offer.isJewelryMetal && offer.isJewelryMetal == true && (!offer.isJewelryType || offer.isJewelryType == false)) {
				if (offer.isJewelryMetal && cartItem.item.metal == offer.jewelryMetal) {
					isApplicable = true;
					// calculate the metal rates then calculate the discount
					// --- Start: Jewelry Price Calculation and Validation ---
					let jewelryPrice = cartItem.item.jewelryPrice; // Start with base jewelry price

					// const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 });
					// if (!latestMetalRates) {
					// 	return res.status(503).json({ success: false, message: "Metal rates are currently unavailable. Please try again later." });
					// }

					// Jewelry Metal Price Calculation
					if (cartItem.item.metal === "gold") {
						if (cartItem.item.customization.goldKarat) {
							const { karatType, price } = cartItem.item.customization.goldKarat;
							const validKarats = ["gold24k", "gold22k", "gold18k"];
							if (!karatType || !validKarats.includes(karatType)) {
								return res.status(400).json({ success: false, message: `Invalid gold karat type provided. Must be one of: ${validKarats.join(', ')}` });
							}

							const metalPricePerGram = latestMetalRates.gold[karatType]?.withGSTRate;
							if (typeof metalPricePerGram !== 'number') {
								return res.status(400).json({ success: false, message: `Rate for ${karatType} is not available.` });
							}

							const calculatedPrice = metalPricePerGram * cartItem.item.jewelryMetalWeight;
							if (Math.abs(calculatedPrice - price) > 0.01) {
								return res.status(400).json({ success: false, message: `Price mismatch for ${karatType}. Expected around ${calculatedPrice.toFixed(2)} but got ${price}.` });
							}

							jewelryPrice += calculatedPrice;
							product_customization.goldKarat = { karatType, price: calculatedPrice };
						} else {
							return res.status(400).json({ success: false, message: "Gold karat selection is required for gold jewelry." });
						}
					} else {
						const metalInfo = latestMetalRates[cartItem.item.metal];
						if (!metalInfo || typeof metalInfo.withGSTRate !== 'number') {
							return res.status(400).json({ success: false, message: `Rates for metal '${cartItem.item.metal}' are not available.` });
						}
						const metalPrice = metalInfo.withGSTRate * items.jewelryMetalWeight;
						jewelryPrice += metalPrice;
					}

					//Calculate the discount.
					if (offer.discountType === 'percent') {
						itemDiscount = (jewelryPrice * offer.discountValue) / 100;
						console.log("total itemDiscount", itemDiscount);
					} else if (offer.discountType === 'flat') {
						itemDiscount = offer.discountValue;
					}
				}
			}

			if (offer.isJewelryType && cartItem.item.jewelryType == offer.jewelryType) {
				isApplicable = true;
			}

			// Check if the offer is for isItemAmount
			if (offer.itemAmount && offer.itemAmount == true) {
				console.log(itemTotalPrice < offer.maxItemAmount);
				if (itemTotalPrice > offer.minItemAmount && itemTotalPrice < offer.maxItemAmount) {
					//Calculate the discount.
					if (offer.discountType === 'percent') {
						itemDiscount = (cartItem.item.price * offer.discountValue) / 100;
						console.log("total itemDiscount", itemDiscount);
					} else if (offer.discountType === 'flat') {
						itemDiscount = offer.discountValue;
					}
				}
			} else {
				//Calculate the discount.
				if (offer.discountType === 'percent') {
					itemDiscount += (cartItem.item.price * offer.discountValue) / 100;
					console.log("isSubCategory only total itemDiscount", itemDiscount);
				} else if (offer.discountType === 'flat') {
					itemDiscount = offer.discountValue;
				}
			}
		}





		// console.log("temp_count", temp_count);
		// console.log(populatedItem);

	});











	return res.status(200).json({
		success: true,
		message: 'Promo code applied successfully!',
		data: {
			offer: {
				id: offer._id,
				name: offer.name,
				promoCode: offer.promoCode,
			},
			applicableItems,
			// discountAmount: parseFloat(discountAmount.toFixed(2)),
			// cartTotal: parseFloat(cartTotalValue.toFixed(2)),
			// newTotal: parseFloat(newTotal.toFixed(2)),
		}
	});
});





// new apply promocode controller

// ---------- helpers ----------
function round2(n) {
	return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeMetal(val) {
	if (!val) return "";
	const s = String(val).trim().toLowerCase();
	if (["panchdhatu", "pachadhatu", "panchadhatu"].includes(s)) return "panchadhatu";
	if (s.startsWith("gold")) return "gold";
	return s; // silver, platinum, etc.
}

// recompute unit price using latest metal rates + customization
function computeUnitPrice({
	cartItem,
	latestRates,
}) {
	const { itemType, item, customization = {} } = cartItem;

	if (itemType === "Product") {
		// Base gemstone price + certificate
		// You already validated these when adding to cart.
		let unit = Number(item.price || 0);

		if (customization.certificate?.price) {
			unit += Number(customization.certificate.price);
		}

		// If mounted on jewelry (ring/pendant/etc.)
		if (customization.jewelryId && customization.jewelryId._id) {
			const j = customization.jewelryId;

			// start with jewelry making price
			let jewelryPrice = Number(j.jewelryPrice || 0);

			// add metal cost from latest rates
			const baseMetal = normalizeMetal(j.metal);
			const w = Number(j.jewelryMetalWeight || 0);

			if (baseMetal === "gold") {
				const karat = String(customization.goldKarat?.karatType || "").toLowerCase();
				if (!["gold24k", "gold22k", "gold18k"].includes(karat)) {
					throw new Error("Gold jewelry requires goldKarat.karatType in customization.");
				}
				const rate = Number(latestRates?.gold?.[karat]?.withGSTRate || 0);
				if (!rate) throw new Error(`Latest metal rate missing for ${karat}.`);
				jewelryPrice += w * rate;
			} else {
				const rate = Number(latestRates?.[baseMetal]?.withGSTRate || 0);
				if (!rate) throw new Error(`Latest metal rate missing for ${baseMetal}.`);
				jewelryPrice += w * rate;
			}

			// optional size system — no price impact here (as per your add flow)
			// diamond substitute
			if (customization.diamondSubstitute?.price) {
				jewelryPrice += Number(customization.diamondSubstitute.price);
			}

			unit += jewelryPrice;
		}

		return round2(unit);
	}

	if (itemType === "Jewelry") {
		// Base jewelry making price + (gemstoneWeight? + certificate?) + latest metal cost
		const j = item;
		let unit = Number(j.jewelryPrice || 0);

		if (customization.gemstoneWeight?.price) {
			unit += Number(customization.gemstoneWeight.price);
		}
		if (customization.certificate?.price) {
			unit += Number(customization.certificate.price);
		}

		// metal add-on via latest rates
		const baseMetal = normalizeMetal(j.metal);
		const w = Number(j.jewelryMetalWeight || 0);

		if (baseMetal === "gold") {
			const karat = String(customization.goldKarat?.karatType || "").toLowerCase();
			if (!["gold24k", "gold22k", "gold18k"].includes(karat)) {
				throw new Error("Gold jewelry requires goldKarat.karatType in customization.");
			}
			const rate = Number(latestRates?.gold?.[karat]?.withGSTRate || 0);
			if (!rate) throw new Error(`Latest metal rate missing for ${karat}.`);
			unit += w * rate;
		} else {
			const rate = Number(latestRates?.[baseMetal]?.withGSTRate || 0);
			if (!rate) throw new Error(`Latest metal rate missing for ${baseMetal}.`);
			unit += w * rate;
		}

		// diamond substitute
		if (customization.diamondSubstitute?.price) {
			unit += Number(customization.diamondSubstitute.price);
		}

		return round2(unit);
	}

	throw new Error(`Unknown itemType: ${itemType}`);
}

function summarizeOffer(offer) {
	return {
		id: String(offer._id),
		name: offer.name,
		offerType: offer.offerType,
		promoCode: offer.offerType === "promocode" ? offer.promoCode : undefined,
		productType: offer.productType,
		isSubCategory: offer.isSubCategory,
		subCategoryTypeId: offer.subCategoryTypeId,
		isJewelryType: offer.isJewelryType,
		jewelryType: offer.jewelryType,
		isJewelryMetal: offer.isJewelryMetal,
		jewelryMetal: offer.jewelryMetal,
		discountType: offer.discountType,
		discountValue: offer.discountValue,
		itemAmount: offer.itemAmount,
		minItemAmount: offer.minItemAmount,
		maxItemAmount: offer.maxItemAmount,
		totalAmount: offer.totalAmount,
		minTotalAmount: offer.minTotalAmount,
		maxTotalAmount: offer.maxTotalAmount,
		expiryDate: offer.expiryDate,
	};
}



// ---------- controller ----------
const applyOfferToCart = asyncHandler(async (req, res) => {
	const userId = req.user?._id;
	if (!userId) {
		return res.status(401).json({ success: false, message: "Unauthorized." });
	}

	const promoCodeRaw = (req.body.promoCode || "").trim().toLowerCase();
	const offerIdRaw = (req.query.offerId || req.body.offerId || "").trim();

	// Load offer
	let offerQuery = { isActive: true, expiryDate: { $gte: new Date() } };
	if (promoCodeRaw) {
		offerQuery.offerType = "promocode";
		offerQuery.promoCode = promoCodeRaw;
	} else if (offerIdRaw) {
		if (!mongoose.Types.ObjectId.isValid(offerIdRaw)) {
			return res.status(400).json({ success: false, message: "Invalid offerId." });
		}
		offerQuery._id = offerIdRaw;
	} else {
		return res.status(400).json({
			success: false,
			message: "Provide either promoCode in body or offerId in query/body.",
		});
	}

	const offer = await Offer.findOne(offerQuery).lean();
	if (!offer) {
		return res.status(404).json({
			success: false,
			message: "Offer not found, inactive, or expired.",
		});
	}

	// Latest metal rates
	const latestRates = await MetalRates.findOne().sort({ createdAt: -1 }).lean();
	if (!latestRates) {
		return res.status(503).json({ success: false, message: "Metal rates unavailable." });
	}

	// Load user cart with enough data to recompute price
	const user = await User.findById(userId)
		.select("cart")
		.populate({
			path: "cart.item cart.customization.jewelryId",
			select:
				// Product: price, certificate, subCategory, slug, sku
				// Jewelry: jewelryPrice, jewelryMetalWeight, metal, certificate, gemstoneWeight, jewelryType, slug, sku
				"name price subCategory slug sku " +
				"jewelryName jewelryPrice jewelryMetalWeight metal certificate gemstoneWeight jewelryType",
		})
		.lean();

	if (!user) {
		return res.status(404).json({ success: false, message: "User not found." });
	}

	const cart = user.cart || [];

	// First recompute unit prices + subtotal
	const recomputed = [];
	let subTotal = 0;
	const priceErrors = [];

	for (const ci of cart) {
		try {
			const newUnit = computeUnitPrice({ cartItem: ci, latestRates });
			const oldUnit = Number(ci.totalPrice || 0);
			const repriced = Math.abs(newUnit - oldUnit) > 0.005;

			recomputed.push({
				...ci,
				_computedUnitPrice: newUnit,
				_oldUnitPrice: oldUnit,
				_repriced: repriced,
			});
			subTotal += newUnit * Number(ci.quantity || 0);
		} catch (err) {
			priceErrors.push({ cartItemId: ci._id, reason: err.message });
		}
	}

	// If any lines failed to price, we can still proceed for the rest
	// Check totalAmount constraint on recomputed subtotal
	if (offer.totalAmount) {
		const minOk =
			offer.minTotalAmount == null || Number(subTotal) >= Number(offer.minTotalAmount);
		const maxOk =
			offer.maxTotalAmount == null || Number(subTotal) <= Number(offer.maxTotalAmount);
		if (!minOk || !maxOk) {
			return res.status(200).json({
				success: true,
				message:
					"Cart total does not satisfy offer total amount constraints. No discount applied.",
				offer: summarizeOffer(offer),
				cartSummary: {
					subTotal: round2(subTotal),
					totalDiscount: 0,
					finalTotal: round2(subTotal),
				},
				appliedItems: [],
				skipped: [
					...recomputed.map(ci => ({
						cartItemId: ci._id,
						reason: "Cart total outside allowed range for this offer.",
					})),
					...priceErrors,
				],
				repricedLines: recomputed
					.filter(ci => ci._repriced)
					.map(ci => ({
						cartItemId: ci._id,
						oldUnitPrice: round2(ci._oldUnitPrice),
						newUnitPrice: round2(ci._computedUnitPrice),
					})),
			});
		}
	}

	const appliedItems = [];
	const skipped = [...priceErrors];
	let totalDiscount = 0;

	for (const ci of recomputed) {
		// skip lines that failed pricing earlier
		if (ci._computedUnitPrice == null) continue;

		const itemType = ci.itemType; // "Product" | "Jewelry"
		const quantity = Number(ci.quantity || 0);
		const unitPrice = Number(ci._computedUnitPrice || 0);
		const linePrice = unitPrice * quantity;

		if (!quantity || unitPrice <= 0 || linePrice <= 0) {
			skipped.push({ cartItemId: ci._id, reason: "Zero quantity or price." });
			continue;
		}

		// productType match
		if (itemType !== offer.productType) {
			skipped.push({ cartItemId: ci._id, reason: "Item type not targeted by offer." });
			continue;
		}

		// scope constraints
		let eligible = true;
		let displayName = "";
		let sku = "";
		let slug = "";
		let itemId = "";

		if (itemType === "Product") {
			const product = ci.item;
			if (!product || !product._id) {
				skipped.push({ cartItemId: ci._id, reason: "Product not found." });
				continue;
			}
			itemId = String(product._id);
			displayName = product.name || "Product";
			sku = product.sku || "";
			slug = product.slug || "";

			if (offer.isSubCategory) {
				const prodSubCat = product.subCategory?.toString();
				const offerSubCat = offer.subCategoryTypeId?.toString();
				if (!offerSubCat || !prodSubCat || prodSubCat !== offerSubCat) {
					eligible = false;
				}
			}
		} else {
			const jewelry = ci.item;
			if (!jewelry || !jewelry._id) {
				skipped.push({ cartItemId: ci._id, reason: "Jewelry not found." });
				continue;
			}
			itemId = String(jewelry._id);
			displayName = jewelry.jewelryName || "Jewelry";
			sku = jewelry.sku || "";
			slug = jewelry.slug || "";

			if (offer.isJewelryType) {
				if (!offer.jewelryType || jewelry.jewelryType !== offer.jewelryType) {
					eligible = false;
				}
			}
			if (offer.isJewelryMetal) {
				const offerMetal = normalizeMetal(offer.jewelryMetal);
				const itemMetal = normalizeMetal(jewelry.metal);
				if (!offerMetal || itemMetal !== offerMetal) {
					eligible = false;
				}
			}
		}

		if (!eligible) {
			skipped.push({ cartItemId: ci._id, reason: "Item does not satisfy offer scoping." });
			continue;
		}

		// itemAmount constraint (per-unit)
		if (offer.itemAmount) {
			const minOk =
				offer.minItemAmount == null || unitPrice >= Number(offer.minItemAmount);
			const maxOk =
				offer.maxItemAmount == null || unitPrice <= Number(offer.maxItemAmount);
			if (!minOk || !maxOk) {
				skipped.push({
					cartItemId: ci._id,
					reason: "Unit price outside allowed item amount range.",
				});
				continue;
			}
		}

		// discount math
		let discount = 0;
		if (offer.discountType === "percent") {
			discount = (linePrice * Number(offer.discountValue)) / 100;
		} else if (offer.discountType === "flat") {
			// flat per unit
			discount = Number(offer.discountValue) * quantity;
		}
		if (discount > linePrice) discount = linePrice;

		const discountedLinePrice = Math.max(0, linePrice - discount);
		totalDiscount += discount;

		appliedItems.push({
			cartItemId: ci._id,
			itemType,
			itemId,
			name: displayName,
			sku,
			slug,
			unitPrice: round2(unitPrice),
			quantity,
			linePrice: round2(linePrice),
			discountType: offer.discountType,
			discountValue: Number(offer.discountValue),
			discount: round2(discount),
			discountedLinePrice: round2(discountedLinePrice),
			repriced: !!ci._repriced,
			oldUnitPrice: ci._repriced ? round2(ci._oldUnitPrice) : undefined,
		});
	}

	const finalTotal = Math.max(0, subTotal - totalDiscount);

	return res.status(200).json({
		success: true,
		message:
			appliedItems.length > 0
				? "Offer applied to eligible cart items (using latest metal rates)."
				: "No cart items eligible for this offer.",
		offer: summarizeOffer(offer),
		cartSummary: {
			subTotal: round2(subTotal),
			totalDiscount: round2(totalDiscount),
			finalTotal: round2(finalTotal),
		},
		appliedItems,
		skipped,
		repricedLines: recomputed
			.filter(ci => ci._repriced)
			.map(ci => ({
				cartItemId: ci._id,
				oldUnitPrice: round2(ci._oldUnitPrice),
				newUnitPrice: round2(ci._computedUnitPrice),
			})),
	});
});







export {
	createOffer,
	updateOffer,
	deleteOffer,
	getOfferDetailsAdmin,
	getAllOffers,
	getAllOffersAdmin,
	getOfferDetails,
	applyPromoCode,
	applyPromoCode2,
	applyOfferToCart,
}
