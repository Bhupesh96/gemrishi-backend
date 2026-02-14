
import asyncHandler from "../utils/asyncHandler.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { Product } from "../models/product.model.js";
import { Jewelry } from "../models/jewelry.model.js";
import { MetalRates } from "../models/metalRates.model.js";
import { User } from "../models/user.model.js";


// Helper function to convert the string of JSON into JSON Object
function parseLooseObjectString(str) {
    try {
        if (!str || typeof str !== "string") return str;
        let s = str.trim();

        // Quick try if it's already valid JSON
        try { return JSON.parse(s); } catch (_) { }

        // Remove trailing commas before } or ]
        s = s.replace(/,\s*(?=[}\]])/g, "");

        // Quote unquoted object keys: {key: => {"key":
        s = s.replace(/([{,]\s*)([A-Za-z0-9_@$]+)\s*:/g, '$1"$2":');

        // Convert single-quoted string values to double-quoted JSON strings
        s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, g1) => {
            return `"${g1.replace(/"/g, '\\"')}"`;
        });

        return JSON.parse(s);
    } catch (err) {
        // parsing failed
        throw new Error("Invalid loose-object string");
    }
}

// Helper to recompute a single cart line's unit price using latest metal rates + customization
function recomputeCartItemPrice({ cartItem, latestRates }) {
    const { itemType, item, customization = {} } = cartItem;

    // Helper for rounding to 2 decimal places
    const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

    // Helper to normalize metal names for lookup
    const normalizeMetal = (val) => {
        if (!val) return "";
        const s = String(val).trim().toLowerCase();
        if (["panchdhatu", "pachadhatu", "panchadhatu"].includes(s)) return "panchadhatu";
        if (s.startsWith("gold")) return "gold"; // gold, gold24k, gold22k, gold18k -> gold
        return s; // silver, platinum, etc.
    };

    let unitPrice = 0;

    if (itemType === "Product") {
        unitPrice = Number(item.price || 0);

        // Add certificate price for the gemstone
        if (customization.certificate?.price) {
            unitPrice += Number(customization.certificate.price);
        }

        // If the product (gemstone) is mounted on jewelry
        if (customization.jewelryId && customization.jewelryId._id) {
            const attachedJewelry = customization.jewelryId;
            let jewelryComponentPrice = Number(attachedJewelry.jewelryPrice || 0);

            // Add metal cost for the attached jewelry from latest rates
            const baseMetal = normalizeMetal(attachedJewelry.metal);
            const metalWeight = Number(attachedJewelry.jewelryMetalWeight || 0);

            if (baseMetal === "gold") {
                const karat = String(customization.goldKarat?.karatType || "").toLowerCase();
                if (!["gold24k", "gold22k", "gold18k"].includes(karat)) {
                    throw new Error("Gold jewelry requires goldKarat.karatType in customization.");
                }
                const rate = Number(latestRates?.gold?.[karat]?.withGSTRate || 0);
                if (!rate) throw new Error(`Latest metal rate missing for ${karat}.`);
                jewelryComponentPrice += metalWeight * rate;
            } else {
                const rate = Number(latestRates?.[baseMetal]?.withGSTRate || 0);
                if (!rate) throw new Error(`Latest metal rate missing for ${baseMetal}.`);
                jewelryComponentPrice += metalWeight * rate;
            }

            // Add diamond substitute price for the attached jewelry
            if (customization.diamondSubstitute?.price) {
                jewelryComponentPrice += Number(customization.diamondSubstitute.price);
            }

            unitPrice += jewelryComponentPrice;
        }
    } else if (itemType === "Jewelry") {
        const jewelry = item;
        unitPrice = Number(jewelry.jewelryPrice || 0);

        // Add gemstone weight price for standalone jewelry
        if (customization.gemstoneWeight?.price) {
            unitPrice += Number(customization.gemstoneWeight.price);
        }
        // Add certificate price for standalone jewelry
        if (customization.certificate?.price) {
            unitPrice += Number(customization.certificate.price);
        }

        // Add metal cost for standalone jewelry from latest rates
        const baseMetal = normalizeMetal(jewelry.metal);
        const metalWeight = Number(jewelry.jewelryMetalWeight || 0);

        if (baseMetal === "gold") {
            const karat = String(customization.goldKarat?.karatType || "").toLowerCase();
            if (!["gold24k", "gold22k", "gold18k"].includes(karat)) {
                throw new Error("Gold jewelry requires goldKarat.karatType in customization.");
            }
            const rate = Number(latestRates?.gold?.[karat]?.withGSTRate || 0);
            if (!rate) throw new Error(`Latest metal rate missing for ${karat}.`);
            unitPrice += metalWeight * rate;
        } else {
            const rate = Number(latestRates?.[baseMetal]?.withGSTRate || 0);
            if (!rate) throw new Error(`Latest metal rate missing for ${baseMetal}.`);
            unitPrice += metalWeight * rate;
        }

        // Add diamond substitute price for standalone jewelry
        if (customization.diamondSubstitute?.price) {
            unitPrice += Number(customization.diamondSubstitute.price);
        }
    } else {
        throw new Error(`Unknown itemType: ${itemType}`);
    }

    return round2(unitPrice);
}


// Add item to cart
const addItemInCart = async (req, res) => {
	try {
		const { itemId, quantity = 1, customization } = req.body;
		const userId = req.user._id;

		if (!itemId || !customization || !quantity || quantity <= 0) {
			return res.status(400).json({ success: false, message: "Please Enter all the required fields. fields: itemId, quantity, customization" });
		}

		let item;
		let itemType;

		// Automatically detect item type
		item = await Product.findById(itemId).select("-wishlistedBy -reviewRating");
		if (item) {
			itemType = "Product";
		} else {
			item = await Jewelry.findById(itemId).select("-wishlistedBy -reviewRating");
			if (item) {
				itemType = "Jewelry";
			}
		}

		if (!item) {
			return res.status(404).json({ success: false, field: 'itemId', message: "Item not found. Please enter the Valid itemId" });
		}

		if (item.stock < quantity) {
			return res.status(400).json({ success: false, field: 'quantity', message: `Insufficient stock for ${item.name || item.jewelryName}`, quantity, s:item.stock });
		}

		const user = await User.findById(userId).select("cart");
		if (!user) {
			return res.status(404).json({ success: false, field: 'User', message: "User Not Found. Invalid Request Please Login Again" });
		}

		const cartItem = user.cart.find(
			(cartEntry) => cartEntry.item.toString() === itemId && cartEntry.itemType === itemType
		);


		// if itemType is Product (Gemstone)
		if (itemType === "Product") {
			console.log(customization);
			if (cartItem) {
				// Item already in cart, check stock before updating quantity
				const newQuantity = cartItem.quantity + Number(quantity);
				if (item.stock < newQuantity) {
					return res.status(400).json({ success: false, field: 'newQuantity', message: `Cannot add more quantity. Only ${item.stock} of ${item.name || item.jewelryName} available in stock.` });
				}
				return res.status(400).json({ success: false, message: `Item ${item.name || item.jewelryName} Already in Cart.`});
			}

			// Convert the string of JSON into JSON Object
			let custom_data_json = null;
			try {
				custom_data_json = parseLooseObjectString(customization);
			} catch (err) {
				console.warn("Failed to parse customization string:", err.message);
				custom_data_json = null;
				return res.status(400).json({ success: false, field: 'customization', message: `Failed to parse customization string` });
			}

			// Check for the certificate (Validation)
			// serach for the certificate
			const item_certificate_obj = item.certificate.find(item => item.certificateType === custom_data_json.certificate.certificateType);
			if (!item_certificate_obj) {
				return res.status(400).json({
					success: false,
					field: 'customization.certificate.certificateType',
					message: `Certificate Type '${custom_data_json.certificate.certificateType}' is not available for ${item.name || item.jewelryName}`
				});
			}

			if (item_certificate_obj.price !== custom_data_json.certificate.price) {
				return res.status(400).json({
					success: false,
					field: 'customization.certificate.certificatePrice',
					message: `Certificate Price '${custom_data_json.certificate.price}' does not match with avialable price '${item_certificate_obj.price}' for ${item.name || item.jewelryName}`
				});
			}

			// Calculate total price
			let totalPrice = 0;

			// add certificate price
			totalPrice = item.price + item_certificate_obj.price;

			// customization object after validation
			let product_customization = {
				certificate: {
					certificateType: item_certificate_obj.certificateType,
					price: item_certificate_obj.price,
				},
			};

			// add gemstone weight price
			if (custom_data_json.jewelryId) {

				const jewelry = await Jewelry.findById(custom_data_json.jewelryId).select("-wishlistedBy -reviewRating -reviewRating");
				if (!jewelry) {
					return res.status(404).json({
						success: false,
						field: 'customization.jewelryId',
						message: `Jewelry not found: ${custom_data_json.jewelryId}`,
					});
				}

				// --- Start: Jewelry Price Calculation and Validation ---
				let jewelryPrice = jewelry.jewelryPrice; // Start with base jewelry price

				const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 });
				if (!latestMetalRates) {
					return res.status(503).json({ success: false, message: "Metal rates are currently unavailable. Please try again later." });
				}

				// Jewelry Metal Price Calculation
				if (jewelry.metal === "gold") {
					if (custom_data_json.goldKarat) {
						const { karatType, price } = custom_data_json.goldKarat;
						const validKarats = ["gold24k", "gold22k", "gold18k"];
						if (!karatType || !validKarats.includes(karatType)) {
							return res.status(400).json({ success: false, message: `Invalid gold karat type provided. Must be one of: ${validKarats.join(', ')}` });
						}

						const metalPricePerGram = latestMetalRates.gold[karatType]?.withGSTRate;
						if (typeof metalPricePerGram !== 'number') {
							return res.status(400).json({ success: false, message: `Rate for ${karatType} is not available.` });
						}

						const calculatedPrice = metalPricePerGram * jewelry.jewelryMetalWeight;
						if (Math.abs(calculatedPrice - price) > 0.01) {
							return res.status(400).json({ success: false, message: `Price mismatch for ${karatType}. Expected around ${calculatedPrice.toFixed(2)} but got ${price}.` });
						}

						jewelryPrice += calculatedPrice;
						product_customization.goldKarat = { karatType, price: calculatedPrice };
					} else {
						return res.status(400).json({ success: false, message: "Gold karat selection is required for gold jewelry." });
					}
				} else {
					const metalInfo = latestMetalRates[jewelry.metal];
					if (!metalInfo || typeof metalInfo.withGSTRate !== 'number') {
						return res.status(400).json({ success: false, message: `Rates for metal '${jewelry.metal}' are not available.` });
					}
					const metalPrice = metalInfo.withGSTRate * jewelry.jewelryMetalWeight;
					jewelryPrice += metalPrice;
				}

				totalPrice += jewelryPrice;
				// --- End: Jewelry Price Calculation and Validation ---

				// --- Start: Jewelry Size System Validation ---
				if (custom_data_json.sizeSystem) {
					const { sizeType, sizeNumber } = custom_data_json.sizeSystem;
					const availableSizeType = jewelry.sizeSystem.find(s => s.sizeType === sizeType);

					if (!availableSizeType) {
						return res.status(400).json({ success: false, message: `Size type '${sizeType}' is not available for this jewelry.` });
					}

					if (!availableSizeType.sizeNumbers.includes(sizeNumber)) {
						return res.status(400).json({ success: false, message: `Size number '${sizeNumber}' is not available for the size type '${sizeType}'.` });
					}

					product_customization.sizeSystem = { sizeType, sizeNumber };
				}
				// --- End: Jewelry Size System Validation ---

				product_customization.jewelryId = jewelry._id;
				// product_customization.sizeSystem = {
				// 	sizeType: custom_data_json.sizeSystem.sizeType,
				// 	sizeNumber: custom_data_json.sizeSystem.sizeNumber
				// };

				// Note: 'quality' seems to be part of jewelry, but it's not being validated here.
				// If quality has a price, it should be validated and added to totalPrice as well.
				// For now, assuming it's descriptive or its price is included elsewhere.


				// Validate and add diamond substitute
				// if (jewelry.isDiamondSubstitute && custom_data_json.isDiamondSubstitute && custom_data_json.diamondSubstitute) {
				if (jewelry.isDiamondSubstitute && custom_data_json.diamondSubstitute) {
					// console.log(custom_data_json.diamondSubstitute, jewelry.isDiamondSubstitute);
					const selectedSubstitute = jewelry.diamondSubstitute.find(d => d.name === custom_data_json.diamondSubstitute.name);
					if (!selectedSubstitute) {
						return res.status(400).json({ success: false, message: `Diamond substitute '${custom_data_json.diamondSubstitute.name}' is not available.` });
					}
					if (selectedSubstitute.price !== custom_data_json.diamondSubstitute.price) {
						return res.status(400).json({ success: false, message: `Price mismatch for diamond substitute '${custom_data_json.diamondSubstitute.name}'.` });
					}
					totalPrice += selectedSubstitute.price;
					product_customization.isDiamondSubstitute = true;
					product_customization.diamondSubstitute = selectedSubstitute;
				}


			}

			user.cart.push({
				itemType,
				item: itemId,
				quantity,
				totalPrice,
				// customization: { certificate: { certificateType: item_certificate_obj.certificateType, price: item_certificate_obj.price,},},
				// customization: { certificate: item_certificate_obj},
				customization: product_customization,

			});


			await user.save();

			return res.status(200).json({
				success: true,
				message: "Item added to cart successfully.",
				cart: user.cart,
			});
		}

		// if itemType is Jewelry
		if (itemType === "Jewelry") {
			console.log(customization);
			if (cartItem) {
				// Item already in cart, check stock before updating quantity
				const newQuantity = cartItem.quantity + Number(quantity);
				if (item.stock < newQuantity) {
					return res.status(400).json({ success: false, field: 'newQuantity', message: `Cannot add more quantity. Only ${item.stock} of ${item.name || item.jewelryName} available in stock.` });
				}
				// return res.status(400).json({ success: false, message: `Item ${item.name || item.jewelryName} Already in Cart.`});
			}

			// Convert the string of JSON into JSON Object
			let custom_data_json = null;
			try {
				custom_data_json = parseLooseObjectString(customization);
			} catch (err) {
				console.warn("Failed to parse customization string:", err.message);
				return res.status(400).json({ success: false, field: 'customization', message: `Failed to parse customization string` });
			}

			let totalPrice = item.jewelryPrice;
			const jewelry_customization = {};

			// Validate and add gemstoneWeight
			if (custom_data_json.gemstoneWeight) {
				const selectedWeight = item.gemstoneWeight.find(w => w.weight === custom_data_json.gemstoneWeight.weight);
				if (!selectedWeight) {
					return res.status(400).json({ success: false, message: `Gemstone weight ${custom_data_json.gemstoneWeight.weight} is not available for this jewelry.` });
				}
				if (selectedWeight.price !== custom_data_json.gemstoneWeight.price) {
					return res.status(400).json({ success: false, message: `Price mismatch for gemstone weight ${custom_data_json.gemstoneWeight.weight}.` });
				}
				totalPrice += selectedWeight.price;
				jewelry_customization.gemstoneWeight = selectedWeight;
			}

			// Validate and add certificate
			if (custom_data_json.certificate) {
				const selectedCert = item.certificate.find(c => c.certificateType === custom_data_json.certificate.certificateType);
				if (!selectedCert) {
					return res.status(400).json({ success: false, message: `Certificate type '${custom_data_json.certificate.certificateType}' is not available for this jewelry.` });
				}
				if (selectedCert.price !== custom_data_json.certificate.price) {
					return res.status(400).json({ success: false, message: `Price mismatch for certificate '${custom_data_json.certificate.certificateType}'.` });
				}
				totalPrice += selectedCert.price;
				jewelry_customization.certificate = selectedCert;
			}

			// Validate and add purity of gold if item.metal is gold
			const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 });
			if (!latestMetalRates) {
				return res.status(503).json({ success: false, message: "Metal rates are currently unavailable. Please try again later." });
			}

			if (item.metal === "gold") {
				if (custom_data_json.goldKarat) {
					const { karatType, price } = custom_data_json.goldKarat;
					const validKarats = ["gold24k", "gold22k", "gold18k"];
					if (!karatType || !validKarats.includes(karatType)) {
						return res.status(400).json({ success: false, message: `Invalid gold karat type provided. Must be one of: ${validKarats.join(', ')}` });
					}

					const metalPricePerGram = latestMetalRates.gold[karatType]?.withGSTRate;
					if (typeof metalPricePerGram !== 'number') {
						return res.status(400).json({ success: false, message: `Rate for ${karatType} is not available.` });
					}

					const calculatedPrice = metalPricePerGram * item.jewelryMetalWeight;
					// Optional: Add a tolerance for minor floating point differences
					if (Math.abs(calculatedPrice - price) > 0.01) {
						return res.status(400).json({ success: false, message: `Price mismatch for ${karatType}. Expected around ${calculatedPrice.toFixed(2)} but got ${price}.` });
					}

					totalPrice += calculatedPrice;
					jewelry_customization.goldKarat = { karatType, price: calculatedPrice };
				} else {
					return res.status(400).json({ success: false, message: "Gold karat selection is required for gold jewelry." });
				}
			} else {
				// For other metals like silver, platinum, panchadhatu
				const metalInfo = latestMetalRates[item.metal];
				if (!metalInfo || typeof metalInfo.withGSTRate !== 'number') {
					return res.status(400).json({ success: false, message: `Rates for metal '${item.metal}' are not available.` });
				}
				const metalPrice = metalInfo.withGSTRate * item.jewelryMetalWeight;
				totalPrice += metalPrice;
			}


			// Validate and add diamond substitute
			// if (item.isDiamondSubstitute && custom_data_json.isDiamondSubstitute && custom_data_json.diamondSubstitute) {
			if (item.isDiamondSubstitute && custom_data_json.diamondSubstitute) {
				// console.log(custom_data_json.diamondSubstitute, item.isDiamondSubstitute);
				const selectedSubstitute = item.diamondSubstitute.find(d => d.name === custom_data_json.diamondSubstitute.name);
				if (!selectedSubstitute) {
					return res.status(400).json({ success: false, message: `Diamond substitute '${custom_data_json.diamondSubstitute.name}' is not available.` });
				}
				if (selectedSubstitute.price !== custom_data_json.diamondSubstitute.price) {
					return res.status(400).json({ success: false, message: `Price mismatch for diamond substitute '${custom_data_json.diamondSubstitute.name}'.` });
				}
				totalPrice += selectedSubstitute.price;
				jewelry_customization.isDiamondSubstitute = true;
				jewelry_customization.diamondSubstitute = selectedSubstitute;
			}

			// Add size system
			if (custom_data_json.sizeSystem) {
				jewelry_customization.sizeSystem = {
					sizeType: custom_data_json.sizeSystem.sizeType,
					sizeNumber: custom_data_json.sizeSystem.sizeNumber
				};
			}

			user.cart.push({
				itemType,
				item: itemId,
				quantity,
				totalPrice,
				customization: jewelry_customization,
			});

			await user.save();

			return res.status(200).json({
				success: true,
				message: "Jewelry added to cart successfully.",
				cart: user.cart,
			});
		}

	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, message: "Server Error." });
	}
}

// Remove item from cart
const removeItemFromCart = async (req, res) => {
	try {

		const cartItemId = req.query.cartItemId;
		const userId = req.user._id;

		if (!cartItemId) {
			return res.status(400).json({ success: false, message: "Item ID is required." });
		}

		const user = await User.findById(userId).select("cart");

		if (!user) {
			return res.status(404).json({ success: false, message: "User not found." });
		}

		const checkCartItem = await User.exists(
            { _id: userId, "cart._id": cartItemId },
			// { cart: { $elemMatch: { _id: cartItemId } } }
        );

		if (!checkCartItem) {
            return res.status(404).json({ success: false, message: "Item in cart not found." });
        }

		// Perform atomic update without loading full cart array
        const result = await User.updateOne(
			{ _id: userId, "cart._id": cartItemId },
            { $pull: { cart: { _id: cartItemId } } }
        );

		const userCart = await User.findById(userId).select("cart");

		return res.status(200).json({
			success: true,
			message: "Item from Cart removed successfully.",
			result,
			cart: userCart.cart,
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, message: "Server error." });
	}
};

// Get all the list of cart items
const getAllCartList = async (req, res) => {
	try {
		const userId = req.user._id;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const user = await User.findById(userId)
		.select("cart")
		.populate({
			path: "cart.item cart.customization.jewelryId",
			// Select all fields necessary for price recalculation and display
			select: "name price certificate subCategory sellPrice images stock slug sku " +
					"jewelryName jewelryPrice jewelryMetalWeight metal gemstoneWeight isDiamondSubstitute diamondSubstitute sizeSystem",
		});

		const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 }).lean();
		if (!latestMetalRates) {
			return res.status(503).json({ success: false, message: "Metal rates are currently unavailable. Please try again later." });
		}

		if (!user) {
			return res.status(404).json({ success: false, message: "User not found." });
		}

		const totalItems = user.cart.length;
		if (totalItems === 0) {
			return res.status(200).json({
				success: true,
				message: "Your cart is empty.",
				totalItems: 0,
				totalPages: 0,
				currentPage: 1,
				cart: [],
			});
		}

		// Recompute prices for ALL items in the cart and update the user object
		user.cart.forEach(cartItem => {
			try {
				const newUnitPrice = recomputeCartItemPrice({ cartItem, latestRates: latestMetalRates });
				// Update the totalPrice on the cart item directly.
				// Note: This assumes totalPrice is the total for the line (unit price * quantity).
				// If totalPrice is meant to be the unit price, this should be `cartItem.totalPrice = newUnitPrice;`
				cartItem.totalPrice = newUnitPrice; // Assuming totalPrice is per unit. Adjust if it's for the line total.
			} catch (error) {
				console.error(`Error recomputing price for cart item ${cartItem._id}: ${error.message}`);
				// Optionally, you can return the original item or mark it with an error
				return { ...cartItem.toObject(), priceError: error.message };
			}
		});
		return res.status(200).json({
			success: true,
			message: "Cart items fetched successfully.",
			totalItems,
			totalPages: Math.ceil(totalItems / limit),
			currentPage: page,
			cart: user.cart.slice(skip, skip + limit), // Paginate the updated cart
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ success: false, message: "Server error." });
	}
};



export {
	addItemInCart,
	removeItemFromCart,
	getAllCartList,
}


/**


	addItemInCart()			- add item to the cart					DONE
	removeItemFromCart()	- remove item from the cart				DONE
	getAllCartList()		- get all the list of cart items		DONE


	slug to add in getAllCartList() controller response



*/
