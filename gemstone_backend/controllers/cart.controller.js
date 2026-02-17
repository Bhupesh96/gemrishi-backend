import asyncHandler from "../utils/asyncHandler.js";
import { Product } from "../models/product.model.js";
import { Jewelry } from "../models/jewelry.model.js";
import { MetalRates } from "../models/metalRates.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";

// ==============================================================================
// 1. HELPER: Get Cart Owner (User or Guest)
// ==============================================================================
// This function determines if the request comes from a logged-in user or a guest.
// If it's a guest without a session, it creates a temporary user in the database.
// At the top of cart.controller.js
const getCartOwner = async (req, res) => {
  let user;

  // 1. If Logged In
  if (req.user && req.user._id) {
    user = await User.findById(req.user._id).select("cart");
  }
  // 2. If Guest
  else {
    let guestId = req.cookies?.guestId;

    if (!guestId) {
      guestId = new mongoose.Types.ObjectId();

      // --- FIX IS HERE ---
      // On localhost, secure must be FALSE. On live server (https), it must be TRUE.
      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("guestId", guestId, {
        httpOnly: true,
        // If on localhost (dev), secure must be false
        secure: isProduction,
        // "Lax" is better for localhost; "None" requires secure: true
        sameSite: isProduction ? "None" : "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    user = await User.findById(guestId).select("cart");

    if (!user) {
      user = await User.create({
        _id: guestId,
        name: "Guest User",
        email: `guest_${guestId}@temp.com`,
        password: `guest_${guestId}`,
        isGuest: true,
        cart: [],
      });
    }
  }
  return user;
};
// ==============================================================================
// 2. HELPER: Parse Customization JSON
// ==============================================================================
// Handles parsing of "loose" JSON strings that might come from frontend forms
function parseLooseObjectString(str) {
  try {
    if (!str || typeof str !== "string") return str;
    let s = str.trim();
    try {
      return JSON.parse(s);
    } catch (_) {}

    // Fix trailing commas
    s = s.replace(/,\s*(?=[}\]])/g, "");
    // Quote unquoted keys
    s = s.replace(/([{,]\s*)([A-Za-z0-9_@$]+)\s*:/g, '$1"$2":');
    // Convert single quotes to double quotes
    s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, g1) => {
      return `"${g1.replace(/"/g, '\\"')}"`;
    });
    return JSON.parse(s);
  } catch (err) {
    throw new Error("Invalid customization format");
  }
}

// ==============================================================================
// 3. HELPER: Recompute Price (Dynamic Pricing)
// ==============================================================================
// Calculates the latest price of a cart item based on current Metal Rates
function recomputeCartItemPrice({ cartItem, latestRates }) {
  const { itemType, item, customization = {} } = cartItem;
  const round2 = (n) =>
    Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  const normalizeMetal = (val) => {
    if (!val) return "";
    const s = String(val).trim().toLowerCase();
    if (["panchdhatu", "pachadhatu", "panchadhatu"].includes(s))
      return "panchadhatu";
    if (s.startsWith("gold")) return "gold";
    return s;
  };

  let unitPrice = 0;

  // --- Price Logic for Gemstones (Product) ---
  if (itemType === "Product") {
    unitPrice = Number(item.price || 0);

    // Add Certificate Price
    if (customization.certificate?.price) {
      unitPrice += Number(customization.certificate.price);
    }

    // Add Jewelry Mounting Price (if customized with jewelry)
    if (customization.jewelryId && customization.jewelryId._id) {
      const attachedJewelry = customization.jewelryId;
      let jewelryComponentPrice = Number(attachedJewelry.jewelryPrice || 0);

      const baseMetal = normalizeMetal(attachedJewelry.metal);
      const metalWeight = Number(attachedJewelry.jewelryMetalWeight || 0);

      if (baseMetal === "gold") {
        const karat = String(
          customization.goldKarat?.karatType || "",
        ).toLowerCase();
        const rate = Number(latestRates?.gold?.[karat]?.withGSTRate || 0);
        if (rate) jewelryComponentPrice += metalWeight * rate;
      } else {
        const rate = Number(latestRates?.[baseMetal]?.withGSTRate || 0);
        if (rate) jewelryComponentPrice += metalWeight * rate;
      }

      if (customization.diamondSubstitute?.price) {
        jewelryComponentPrice += Number(customization.diamondSubstitute.price);
      }

      unitPrice += jewelryComponentPrice;
    }
  }
  // --- Price Logic for Jewelry ---
  else if (itemType === "Jewelry") {
    const jewelry = item;
    unitPrice = Number(jewelry.jewelryPrice || 0);

    if (customization.gemstoneWeight?.price)
      unitPrice += Number(customization.gemstoneWeight.price);
    if (customization.certificate?.price)
      unitPrice += Number(customization.certificate.price);

    const baseMetal = normalizeMetal(jewelry.metal);
    const metalWeight = Number(jewelry.jewelryMetalWeight || 0);

    if (baseMetal === "gold") {
      const karat = String(
        customization.goldKarat?.karatType || "",
      ).toLowerCase();
      const rate = Number(latestRates?.gold?.[karat]?.withGSTRate || 0);
      if (rate) unitPrice += metalWeight * rate;
    } else {
      const rate = Number(latestRates?.[baseMetal]?.withGSTRate || 0);
      if (rate) unitPrice += metalWeight * rate;
    }

    if (customization.diamondSubstitute?.price) {
      unitPrice += Number(customization.diamondSubstitute.price);
    }
  }

  return round2(unitPrice);
}

// ==============================================================================
// 4. CONTROLLER: Add Item to Cart
// ==============================================================================
const addItemInCart = async (req, res) => {
  try {
    const { itemId, quantity = 1, customization } = req.body;

    // 1. Get the Owner (User or Guest)
    const user = await getCartOwner(req, res);

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "Failed to initialize cart session.",
      });
    }

    if (!itemId || !customization || !quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Please Enter all required fields." });
    }

    let item;
    let itemType;

    // Determine if Item is Product (Gemstone) or Jewelry
    item = await Product.findById(itemId).select("-wishlistedBy -reviewRating");
    if (item) {
      itemType = "Product";
    } else {
      item = await Jewelry.findById(itemId).select(
        "-wishlistedBy -reviewRating",
      );
      if (item) itemType = "Jewelry";
    }

    if (!item) {
      return res
        .status(404)
        .json({ success: false, field: "itemId", message: "Item not found." });
    }

    if (item.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${item.name || item.jewelryName}`,
      });
    }

    // Check if item already exists in cart
    const cartItem = user.cart.find(
      (cartEntry) =>
        cartEntry.item.toString() === itemId && cartEntry.itemType === itemType,
    );

    // --- GEMSTONE LOGIC (Product) ---
    if (itemType === "Product") {
      if (cartItem) {
        // For now, we block duplicate adds with different customizations could be tricky
        return res
          .status(400)
          .json({ success: false, message: `Item Already in Cart.` });
      }

      let custom_data_json = null;
      try {
        custom_data_json = parseLooseObjectString(customization);
      } catch (err) {
        return res
          .status(400)
          .json({ success: false, message: `Failed to parse customization` });
      }

      // Certificate Validation
      const item_certificate_obj = item.certificate.find(
        (c) =>
          c.certificateType === custom_data_json.certificate.certificateType,
      );
      if (!item_certificate_obj) {
        return res
          .status(400)
          .json({ success: false, message: `Certificate Type not available` });
      }

      let totalPrice = item.price + item_certificate_obj.price;
      let product_customization = {
        certificate: {
          certificateType: item_certificate_obj.certificateType,
          price: item_certificate_obj.price,
        },
      };

      // Jewelry Mounting Logic
      if (custom_data_json.jewelryId) {
        const jewelry = await Jewelry.findById(custom_data_json.jewelryId);
        if (!jewelry)
          return res
            .status(404)
            .json({ success: false, message: `Jewelry not found` });

        let jewelryPrice = jewelry.jewelryPrice;
        const latestMetalRates = await MetalRates.findOne().sort({
          createdAt: -1,
        });

        // Metal Calculation
        if (jewelry.metal === "gold") {
          if (custom_data_json.goldKarat) {
            const { karatType } = custom_data_json.goldKarat;
            const metalPricePerGram =
              latestMetalRates.gold[karatType]?.withGSTRate;
            const calculatedPrice =
              metalPricePerGram * jewelry.jewelryMetalWeight;
            jewelryPrice += calculatedPrice;
            product_customization.goldKarat = {
              karatType,
              price: calculatedPrice,
            };
          }
        } else {
          const metalInfo = latestMetalRates[jewelry.metal];
          const metalPrice = metalInfo.withGSTRate * jewelry.jewelryMetalWeight;
          jewelryPrice += metalPrice;
        }
        totalPrice += jewelryPrice;

        // Diamond Substitute
        if (jewelry.isDiamondSubstitute && custom_data_json.diamondSubstitute) {
          const selectedSubstitute = jewelry.diamondSubstitute.find(
            (d) => d.name === custom_data_json.diamondSubstitute.name,
          );
          if (selectedSubstitute) {
            totalPrice += selectedSubstitute.price;
            product_customization.isDiamondSubstitute = true;
            product_customization.diamondSubstitute = selectedSubstitute;
          }
        }

        // Size
        if (custom_data_json.sizeSystem) {
          const { sizeType, sizeNumber } = custom_data_json.sizeSystem;
          product_customization.sizeSystem = { sizeType, sizeNumber };
        }
        product_customization.jewelryId = jewelry._id;
      }

      user.cart.push({
        itemType,
        item: itemId,
        quantity,
        totalPrice,
        customization: product_customization,
      });

      await user.save();
      return res.status(200).json({
        success: true,
        message: "Item added to cart",
        cart: user.cart,
      });
    }

    // --- JEWELRY LOGIC ---
    if (itemType === "Jewelry") {
      // (Similar duplicate check logic if needed, skipped for brevity)

      let custom_data_json = null;
      try {
        custom_data_json = parseLooseObjectString(customization);
      } catch (err) {
        return res
          .status(400)
          .json({ success: false, message: `Failed to parse customization` });
      }

      let totalPrice = item.jewelryPrice;
      const jewelry_customization = {};
      const latestMetalRates = await MetalRates.findOne().sort({
        createdAt: -1,
      });

      // 1. Gemstone Weight
      if (custom_data_json.gemstoneWeight) {
        const selectedWeight = item.gemstoneWeight.find(
          (w) => w.weight === custom_data_json.gemstoneWeight.weight,
        );
        if (selectedWeight) {
          totalPrice += selectedWeight.price;
          jewelry_customization.gemstoneWeight = selectedWeight;
        }
      }

      // 2. Certificate
      if (custom_data_json.certificate) {
        const selectedCert = item.certificate.find(
          (c) =>
            c.certificateType === custom_data_json.certificate.certificateType,
        );
        if (selectedCert) {
          totalPrice += selectedCert.price;
          jewelry_customization.certificate = selectedCert;
        }
      }

      // 3. Metal Rates
      if (item.metal === "gold") {
        if (custom_data_json.goldKarat) {
          const { karatType } = custom_data_json.goldKarat;
          const metalPricePerGram =
            latestMetalRates.gold[karatType]?.withGSTRate;
          const calculatedPrice = metalPricePerGram * item.jewelryMetalWeight;
          totalPrice += calculatedPrice;
          jewelry_customization.goldKarat = {
            karatType,
            price: calculatedPrice,
          };
        }
      } else {
        const metalInfo = latestMetalRates[item.metal];
        const metalPrice = metalInfo.withGSTRate * item.jewelryMetalWeight;
        totalPrice += metalPrice;
      }

      // 4. Diamond Substitute
      if (item.isDiamondSubstitute && custom_data_json.diamondSubstitute) {
        const selectedSubstitute = item.diamondSubstitute.find(
          (d) => d.name === custom_data_json.diamondSubstitute.name,
        );
        if (selectedSubstitute) {
          totalPrice += selectedSubstitute.price;
          jewelry_customization.isDiamondSubstitute = true;
          jewelry_customization.diamondSubstitute = selectedSubstitute;
        }
      }

      // 5. Size
      if (custom_data_json.sizeSystem) {
        jewelry_customization.sizeSystem = custom_data_json.sizeSystem;
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
        message: "Jewelry added to cart",
        cart: user.cart,
      });
    }
  } catch (error) {
    console.error("Add Cart Error:", error);
    return res.status(500).json({ success: false, message: "Server Error." });
  }
};

// ==============================================================================
// 5. CONTROLLER: Remove Item from Cart
// ==============================================================================
const removeItemFromCart = async (req, res) => {
  try {
    const cartItemId = req.query.cartItemId;

    // Use helper to get user (Guest or Logged In)
    const user = await getCartOwner(req, res);

    if (!cartItemId)
      return res
        .status(400)
        .json({ success: false, message: "Item ID is required." });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User/Cart not found." });

    // Update using specific ID
    await User.updateOne(
      { _id: user._id },
      { $pull: { cart: { _id: cartItemId } } },
    );

    const updatedUser = await User.findById(user._id).select("cart");

    return res.status(200).json({
      success: true,
      message: "Item removed successfully.",
      cart: updatedUser.cart,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ==============================================================================
// 6. CONTROLLER: Get All Cart Items
// ==============================================================================
const getAllCartList = async (req, res) => {
  try {
    // Use helper logic to determine User
    const userOwner = await getCartOwner(req, res);

    // If no user/guest found (rare, but possible if cookies cleared)
    if (!userOwner) {
      return res.status(200).json({ success: true, cart: [], totalItems: 0 });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findById(userOwner._id).select("cart").populate({
      path: "cart.item cart.customization.jewelryId",
      select:
        "name price certificate subCategory sellPrice images stock slug sku jewelryName jewelryPrice jewelryMetalWeight metal gemstoneWeight isDiamondSubstitute diamondSubstitute sizeSystem",
    });

    if (!user) {
      return res.status(200).json({ success: true, cart: [], totalItems: 0 });
    }

    const totalItems = user.cart.length;
    if (totalItems === 0) {
      return res.status(200).json({
        success: true,
        message: "Your cart is empty.",
        totalItems: 0,
        cart: [],
      });
    }

    // Recompute prices dynamically based on latest rates
    const latestMetalRates = await MetalRates.findOne()
      .sort({ createdAt: -1 })
      .lean();

    if (latestMetalRates) {
      user.cart.forEach((cartItem) => {
        try {
          const newUnitPrice = recomputeCartItemPrice({
            cartItem,
            latestRates: latestMetalRates,
          });
          cartItem.totalPrice = newUnitPrice;
        } catch (error) {
          console.error("Price recalc error", error.message);
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart items fetched successfully.",
      totalItems: user.cart.length,
      totalPages: Math.ceil(user.cart.length / limit),
      currentPage: page,
      cart: user.cart.slice(skip, skip + limit),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export { addItemInCart, removeItemFromCart, getAllCartList };
