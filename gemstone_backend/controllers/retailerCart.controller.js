import asyncHandler from "../utils/asyncHandler.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { Product } from "../models/product.model.js";
import { Jewelry } from "../models/jewelry.model.js";
import { Retailer } from "../models/retailer.model.js";

// Helper function to convert the string of JSON into JSON Object
function parseLooseObjectString(str) {
  try {
    if (!str || typeof str !== "string") return str;
    const trimmed = str.trim();

    // Quick try if it's already valid JSON
    try {
      return JSON.parse(trimmed);
    } catch (_) {}

    // Quote unquoted object keys: {key: => {"key":
    const withQuotedKeys = trimmed.replace(
      /([{,]\s*)([A-Za-z0-9_@$]+)\s*:/g,
      '$1"$2":',
    );

    // Convert single-quoted string values to double-quoted JSON strings
    const withDoubleQuotes = withQuotedKeys.replace(/'([^']*)'/g, (_m, g1) => {
      return `"${g1.replace(/"/g, '\\"')}"`;
    });

    return JSON.parse(withDoubleQuotes);
  } catch (err) {
    // parsing failed
    throw new Error("Invalid loose-object string");
  }
}

// Add item to cart
const addItemInCart = async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const retailerUserId = req.user._id || req.user.id;

    if (!itemId || !quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request." });
    }

    const customization =
      typeof req.body.customization === "string"
        ? JSON.parse(req.body.customization)
        : req.body.customization || null;

    let item;
    let itemType;

    // Detect item type
    item = await Product.findById(itemId).select("stock name certificate");
    if (item) {
      itemType = "Product";
    } else {
      item = await Jewelry.findById(itemId).select("stock jewelryName");
      if (item) itemType = "Jewelry";
    }

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found." });
    }

    if (item.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${item.name || item.jewelryName}`,
      });
    }

    const retailerUser = await Retailer.findById(retailerUserId).select("cart");
    if (!retailerUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Convert customization string to object
    let custom_data_json = null;
    try {
      custom_data_json = customization
        ? parseLooseObjectString(customization)
        : null;
    } catch (err) {
      return res
        .status(400)
        .json({ success: false, message: "Failed to parse customization" });
    }

    // ✅ Validate new item customization before adding
    if (custom_data_json?.certificate) {
      const selectedCert = item.certificate.find(
        (c) =>
          c.certificateType === custom_data_json.certificate.certificateType,
      );

      if (!selectedCert) {
        return res.status(400).json({
          success: false,
          message: `Invalid certificate type for ${item.name}.`,
        });
      }

      if (selectedCert.price !== custom_data_json.certificate.price) {
        return res.status(400).json({
          success: false,
          message: `Certificate price mismatch for ${item.name}.`,
        });
      }
    }

    // ✅ Validate existing cart items (stock + certificate)
    const productsInCart = await Product.find({
      _id: { $in: retailerUser.cart.map((c) => c.item) },
    });

    for (const cart of retailerUser.cart) {
      const prod = productsInCart.find(
        (p) => p._id.toString() === cart.item.toString(),
      );

      if (!prod) {
        return res.status(404).json({
          success: false,
          message: `Product not found for cart item.`,
        });
      }

      if (prod.stock < cart.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${prod.name}.`,
        });
      }

      if (cart.customization?.certificate) {
        const selectedCert = prod.certificate.find(
          (c) =>
            c.certificateType ===
            cart.customization.certificate.certificateType,
        );

        if (!selectedCert) {
          return res.status(400).json({
            success: false,
            message: `Invalid certificate type for ${prod.name}.`,
          });
        }

        if (selectedCert.price !== cart.customization.certificate.price) {
          return res.status(400).json({
            success: false,
            message: `Certificate price mismatch for ${prod.name}.`,
          });
        }
      }
    }

    // ✅ Add or update item in cart
    const cartItem = retailerUser.cart.find(
      (c) => c.item.toString() === itemId && c.itemType === itemType,
    );

    if (cartItem) {
      const newQuantity = cartItem.quantity + Number(quantity);
      if (item.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${item.stock} available.`,
        });
      }
      cartItem.quantity = newQuantity;
    } else {
      retailerUser.cart.push({
        itemType,
        item: itemId,
        quantity,
        customization: custom_data_json,
      });
    }

    await retailerUser.save();

    return res.status(200).json({
      success: true,
      message: "Item added to cart successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Remove item from cart
const removeItemFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    const retailerUserId = req.user._id;

    if (!itemId) {
      return res
        .status(400)
        .json({ success: false, message: "Item ID is required." });
    }

    const retailerUser = await Retailer.findById(retailerUserId).select("cart");

    if (!retailerUser) {
      return res
        .status(404)
        .json({ success: false, message: "Retailer not found." });
    }

    const cartItemIndex = retailerUser.cart.findIndex(
      (cartItem) => cartItem.item.toString() === itemId,
    );

    if (cartItemIndex > -1) {
      const cartItem = retailerUser.cart[cartItemIndex];
      if (cartItem.quantity > 1) {
        // If quantity is more than 1, decrement it
        cartItem.quantity -= 1;
      } else {
        // If quantity is 1, remove the item from the cart
        retailerUser.cart.splice(cartItemIndex, 1);
      }
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart." });
    }

    await retailerUser.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully.",
      // cart: retailerUser.cart,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Get all the list of cart items
const getAllCartList = async (req, res) => {
  try {
    const retailerUserId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const retailerUser = await Retailer.findById(retailerUserId)
      .select("cart")
      .populate({
        path: "cart.item",
        select: "name jewelryName price sellPrice images stock", // Select fields you need
      });

    if (!retailerUser) {
      return res
        .status(404)
        .json({ success: false, message: "Retailer not found." });
    }

    const totalItems = retailerUser.cart.length;
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

    const paginatedCart = retailerUser.cart.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      message: "Cart items fetched successfully.",
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      cart: paginatedCart,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export { addItemInCart, removeItemFromCart, getAllCartList };

/**


	addItemInCart()			- add item to the cart					DONE
	removeItemFromCart()	- remove item from the cart				DONE
	getAllCartList()		- get all the list of cart items		DONE




*/
