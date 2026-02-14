import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { Jewelry } from "../models/jewelry.model.js";
import { MetalRates } from "../models/metalRates.model.js";
import mongoose from "mongoose";


// Add the item to the wishlist
const addToWishlist = async (req, res) => {
	try {
		const userId = req.user._id; // Assuming userId is available from auth middleware
		const { itemType, itemId } = req.body;

		if (!["Product", "Jewelry"].includes(itemType)) {
			return res.status(400).json({ success: false, message: "Invalid item type." });
		}

		// Check if item exists
		let itemExists = false;
		if (itemType === "Product") {
			itemExists = await Product.exists({ _id: itemId });
		} else if (itemType === "Jewelry") {
			itemExists = await Jewelry.exists({ _id: itemId });
		}
		if (!itemExists) {
			return res.status(404).json({ success: false, message: "Item not found." });
		}

		const userExists = await User.exists({ _id: userId });
		if (!userExists) {
			return res.status(404).json({ success: false, message: "User not found." });
		}

		// Check if already in wishlist
		const exists = await User.exists({
			_id: userId,
			"wishlist.itemType": itemType,
			"wishlist.item": itemId
		});
		if (exists) {
			return res.status(400).json({ success: false, message: "Item already in wishlist." });
		}

		const updateStatus = await User.updateOne(
			{ _id: userId },
			{ $push: { wishlist: { itemType, item: itemId } } }
		);

		return res.status(200).json({ success: true, message: "Added to wishlist.", updateStatus: updateStatus });

	} catch (err) {
		return res.status(500).json({ success: false, message: "Server error.", error: err.message });
	}
};

// Get all the list of wishlist items
const getAllWishlist = async (req, res) => {
	try {
		const userId = req.user._id || req.user.id; // Assuming userId is available from auth middleware
		// console.log(userId);

		const userExists = await User.exists({ _id: userId });
		if (!userExists) {
			return res.status(404).json({ success: false, message: "User not found." });
		}
		const list = await User.findById(userId)
		.select("wishlist")
		.populate({
			path: "wishlist.item",
			select: "name slug price sellPrice images jewelryPrice jewelryName jewelryType isAvailable jewelryMetalWeight metal",
		});
		// Fetch the most recent metal rates
		const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 }).lean();

		return res.status(200).json({ success: true, message: "Wishlist List Fetched Successfully.", wishlist: list.wishlist , metalRates: latestMetalRates,});
	} catch (err) {
		return res.status(500).json({ success: false, message: "Server error.", error: err.message });
	}
};


// Remove item from wishlist
const removeFromWishlist = async (req, res) => {
	try {
		const userId = req.user._id; // Assuming userId is available from auth middleware
		const itemId = req.query.itemId;

		const userExists = await User.exists({ _id: userId });
		if (!userExists) {
			return res.status(404).json({ success: false, message: "User not found." });
		}

		const exists = await User.exists({
			_id: userId,
			"wishlist.item": itemId
		});
		if (!exists) {
			return res.status(404).json({ success: false, message: "Item not found in wishlist." });
		}

		const itemDoc = await User.findOne(
			{ _id: userId, "wishlist.item": itemId },
			{ "wishlist.$": 1 }
		);

		if (!itemDoc || !itemDoc.wishlist || itemDoc.wishlist.length === 0) {
			return res.status(404).json({ success: false, message: "Item not found in wishlist." });
		}

		const itemType = itemDoc.wishlist[0].itemType;

		const result = await User.updateOne(
			{ _id: userId },
			{ $pull: { wishlist: { item: itemId } } }
		);

		if (result.modifiedCount === 0) {
			return res.status(404).json({ success: false, message: "Item not found in wishlist." });
		}

		return res.status(200).json({ success: true, message: "Removed from wishlist.", upodateStatus: result });
	} catch (err) {
		return res.status(500).json({ success: false, message: "Server error.", error: err.message });
	}
};



export {
	addToWishlist,
	getAllWishlist,
	removeFromWishlist,
}



/**


	addToWishlist()			- add item (Product or Jewelry) to wishlist  		DONE
	getAllWishlist()		- get all the list of wishlist items 				DONE
	removeFromWishlist()	- remove item from wishlist 						DONE

 */
