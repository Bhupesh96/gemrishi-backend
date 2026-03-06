import asyncHandler from "../utils/asyncHandler.js";
import { Product } from "../models/product.model.js";
import { Jewelry } from "../models/jewelry.model.js";
import { MetalRates } from "../models/metalRates.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";

// ==============================================================================
// 1. HELPER: Get Cart Owner (User or Guest)
// ==============================================================================
const getCartOwner = async (req, res) => {
  let user;

  if (req.user && req.user._id) {
    user = await User.findById(req.user._id).select("cart");
  } else {
    let guestId = req.cookies?.guestId;

    if (!guestId) {
      guestId = new mongoose.Types.ObjectId();
      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("guestId", guestId, {
        httpOnly: true,
        secure: isProduction,
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
function parseLooseObjectString(str) {
  try {
    if (!str || typeof str !== "string") return str;
    let s = str.trim();
    try {
      return JSON.parse(s);
    } catch (_) {}

    s = s.replace(/,\s*(?=[}\]])/g, "");
    s = s.replace(/([{,]\s*)([A-Za-z0-9_@$]+)\s*:/g, '$1"$2":');
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
function recomputeCartItemPrice({ cartItem, latestRates }) {
  // ✅ ADDED: Pull quantity from cartItem to multiply later
  const { itemType, item, customization = {}, quantity = 1 } = cartItem;
  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  // ✅ FIXED: If product was deleted from DB but is still in cart, return 0 safely instead of crashing
  if (!item) return 0;

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

    if (customization.certificate?.price) {
      unitPrice += Number(customization.certificate.price);
    }

    if (customization.jewelryId && customization.jewelryId._id) {
      const attachedJewelry = customization.jewelryId;
      let jewelryComponentPrice = Number(attachedJewelry.jewelryPrice || 0);

      const baseMetal = normalizeMetal(attachedJewelry.metal);
      const metalWeight = Number(attachedJewelry.jewelryMetalWeight || 0);

      if (baseMetal === "gold") {
        const karat = String(customization.goldKarat?.karatType || "").toLowerCase();
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
      const karat = String(customization.goldKarat?.karatType || "").toLowerCase();
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

  // ✅ FIXED: Multiply the computed unit price by the quantity before returning
  return round2(unitPrice * quantity);
}

// ==============================================================================
// 4. CONTROLLER: Add Item to Cart
// ==============================================================================
const addItemInCart = async (req, res) => {
  try {
    const { itemId, quantity = 1, customization } = req.body;

    const user = await getCartOwner(req, res);

    if (!user) {
      return res.status(500).json({ success: false, message: "Failed to initialize cart session." });
    }

    if (!itemId || !customization || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Please Enter all required fields." });
    }

    let item;
    let itemType;

    item = await Product.findById(itemId).select("-wishlistedBy -reviewRating");
    if (item) {
      itemType = "Product";
    } else {
      item = await Jewelry.findById(itemId).select("-wishlistedBy -reviewRating");
      if (item) itemType = "Jewelry";
    }

    if (!item) {
      return res.status(404).json({ success: false, field: "itemId", message: "Item not found." });
    }

    if (item.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${item.name || item.jewelryName}`,
      });
    }

    const cartItem = user.cart.find(
        (cartEntry) => cartEntry.item.toString() === itemId && cartEntry.itemType === itemType
    );

    // --- GEMSTONE LOGIC (Product) ---
    if (itemType === "Product") {
      if (cartItem) {
        return res.status(400).json({ success: false, message: `Item Already in Cart.` });
      }

      let custom_data_json = null;
      try {
        custom_data_json = parseLooseObjectString(customization);
      } catch (err) {
        return res.status(400).json({ success: false, message: `Failed to parse customization` });
      }

      const item_certificate_obj = item.certificate.find(
          (c) => c.certificateType === custom_data_json.certificate.certificateType
      );
      if (!item_certificate_obj) {
        return res.status(400).json({ success: false, message: `Certificate Type not available` });
      }

      // ✅ FIXED: Safely calculate unit price to prevent NaN
      let unitPrice = Number(item.price || 0) + Number(item_certificate_obj.price || 0);

      let product_customization = {
        certificate: {
          certificateType: item_certificate_obj.certificateType,
          price: Number(item_certificate_obj.price || 0),
        },
      };

      if (custom_data_json.jewelryId) {
        const jewelry = await Jewelry.findById(custom_data_json.jewelryId);
        if (!jewelry) return res.status(404).json({ success: false, message: `Jewelry not found` });

        let jewelryPrice = Number(jewelry.jewelryPrice || 0);
        const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 });

        if (jewelry.metal === "gold") {
          if (custom_data_json.goldKarat) {
            const { karatType } = custom_data_json.goldKarat;
            const metalPricePerGram = latestMetalRates.gold[karatType]?.withGSTRate || 0;
            const calculatedPrice = metalPricePerGram * (jewelry.jewelryMetalWeight || 0);
            jewelryPrice += calculatedPrice;
            product_customization.goldKarat = { karatType, price: calculatedPrice };
          }
        } else {
          const metalInfo = latestMetalRates[jewelry.metal];
          const metalPrice = (metalInfo?.withGSTRate || 0) * (jewelry.jewelryMetalWeight || 0);
          jewelryPrice += metalPrice;
        }
        unitPrice += jewelryPrice;

        if (jewelry.isDiamondSubstitute && custom_data_json.diamondSubstitute) {
          const selectedSubstitute = jewelry.diamondSubstitute.find(
              (d) => d.name === custom_data_json.diamondSubstitute.name
          );
          if (selectedSubstitute) {
            unitPrice += Number(selectedSubstitute.price || 0);
            product_customization.isDiamondSubstitute = true;
            product_customization.diamondSubstitute = selectedSubstitute;
          }
        }

        if (custom_data_json.sizeSystem) {
          const { sizeType, sizeNumber } = custom_data_json.sizeSystem;
          product_customization.sizeSystem = { sizeType, sizeNumber };
        }
        product_customization.jewelryId = jewelry._id;
      }

      // ✅ FIXED: Apply quantity multiplier before saving to DB
      const finalTotalPrice = unitPrice * quantity;

      user.cart.push({
        itemType,
        item: itemId,
        quantity,
        totalPrice: finalTotalPrice,
        customization: product_customization,
      });

      await user.save();
      return res.status(200).json({ success: true, message: "Item added to cart", cart: user.cart });
    }

    // --- JEWELRY LOGIC ---
    if (itemType === "Jewelry") {
      let custom_data_json = null;
      try {
        custom_data_json = parseLooseObjectString(customization);
      } catch (err) {
        return res.status(400).json({ success: false, message: `Failed to parse customization` });
      }

      // ✅ FIXED: Safely calculate unit price
      let unitPrice = Number(item.jewelryPrice || 0);
      const jewelry_customization = {};
      const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 });

      if (custom_data_json.gemstoneWeight) {
        const selectedWeight = item.gemstoneWeight.find(
            (w) => w.weight === custom_data_json.gemstoneWeight.weight
        );
        if (selectedWeight) {
          unitPrice += Number(selectedWeight.price || 0);
          jewelry_customization.gemstoneWeight = selectedWeight;
        }
      }

      if (custom_data_json.certificate) {
        const selectedCert = item.certificate.find(
            (c) => c.certificateType === custom_data_json.certificate.certificateType
        );
        if (selectedCert) {
          unitPrice += Number(selectedCert.price || 0);
          jewelry_customization.certificate = selectedCert;
        }
      }

      if (item.metal === "gold") {
        if (custom_data_json.goldKarat) {
          const { karatType } = custom_data_json.goldKarat;
          const metalPricePerGram = latestMetalRates.gold[karatType]?.withGSTRate || 0;
          const calculatedPrice = metalPricePerGram * (item.jewelryMetalWeight || 0);
          unitPrice += calculatedPrice;
          jewelry_customization.goldKarat = { karatType, price: calculatedPrice };
        }
      } else {
        const metalInfo = latestMetalRates[item.metal];
        const metalPrice = (metalInfo?.withGSTRate || 0) * (item.jewelryMetalWeight || 0);
        unitPrice += metalPrice;
      }

      if (item.isDiamondSubstitute && custom_data_json.diamondSubstitute) {
        const selectedSubstitute = item.diamondSubstitute.find(
            (d) => d.name === custom_data_json.diamondSubstitute.name
        );
        if (selectedSubstitute) {
          unitPrice += Number(selectedSubstitute.price || 0);
          jewelry_customization.isDiamondSubstitute = true;
          jewelry_customization.diamondSubstitute = selectedSubstitute;
        }
      }

      if (custom_data_json.sizeSystem) {
        jewelry_customization.sizeSystem = custom_data_json.sizeSystem;
      }

      // ✅ FIXED: Apply quantity multiplier before saving to DB
      const finalTotalPrice = unitPrice * quantity;

      user.cart.push({
        itemType,
        item: itemId,
        quantity,
        totalPrice: finalTotalPrice,
        customization: jewelry_customization,
      });

      await user.save();
      return res.status(200).json({ success: true, message: "Jewelry added to cart", cart: user.cart });
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
    const user = await getCartOwner(req, res);

    if (!cartItemId) return res.status(400).json({ success: false, message: "Item ID is required." });
    if (!user) return res.status(404).json({ success: false, message: "User/Cart not found." });

    await User.updateOne({ _id: user._id }, { $pull: { cart: { _id: cartItemId } } });
    const updatedUser = await User.findById(user._id).select("cart");

    return res.status(200).json({ success: true, message: "Item removed successfully.", cart: updatedUser.cart });
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
    const userOwner = await getCartOwner(req, res);

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
      return res.status(200).json({ success: true, message: "Your cart is empty.", totalItems: 0, cart: [] });
    }

    const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 }).lean();

    if (latestMetalRates) {
      user.cart.forEach((cartItem) => {
        try {
          // ✅ FIXED: newTotalPrice now includes the quantity multiplier applied inside the helper
          const newTotalPrice = recomputeCartItemPrice({
            cartItem,
            latestRates: latestMetalRates,
          });
          cartItem.totalPrice = newTotalPrice;
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