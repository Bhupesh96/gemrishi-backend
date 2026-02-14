import { Jewelry } from "../models/jewelry.model.js";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { Retailer } from "../models/retailer.model.js";
import { User } from "../models/user.model.js";
import { generateOrderId } from "../utils/generateOrderId.js";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmails.js";
import { Offer } from "../models/offer.model.js";
import { RetailerStock } from "../models/retailerStock.model.js";
import { MetalRates } from "../models/metalRates.model.js";
import mongoose from "mongoose";

dotenv.config();

export const createProductOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { totalAmount, items, address, paymentMethod } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ msg: "Items array is required" });
  }

  let calculatedTotal = 0;

  // Validate stock for all items
  for (const item of items) {
    const { productId, jewelryId, quantity, itemTotal } = item;

    if (productId) {
      const product = await Product.findById(productId);
      const jewelry = await Jewelry.findById(jewelryId);
      if (!product) {
        return res.status(404).json({ msg: "Product not found:" });
      }

      if (product.stock < quantity) {
        return res
          .status(400)
          .json({ msg: `Insufficient stock for ${product.name}` });
      }
      const basePrice = product.price;
      const certPrices = product.certificate.map((cert) => cert.price);
      const jewelryPrice =
        jewelry && typeof jewelry.price === "number" ? jewelry.price : null;
      const qualityPrices =
        jewelry && Array.isArray(jewelry.quality)
          ? jewelry.quality.map((qual) => qual.price)
          : [];

      let validTotals = new Set();

      if (jewelry) {
        // must include jewelry combinations only
        if (typeof jewelryPrice === "number") {
          validTotals.add(basePrice * quantity + jewelryPrice * quantity);

          certPrices.forEach((cert) => {
            validTotals.add(
              (basePrice + cert) * quantity + jewelryPrice * quantity
            );
            qualityPrices.forEach((ql) => {
              validTotals.add(
                (basePrice + cert + ql) * quantity + jewelryPrice * quantity
              );
            });
          });

          qualityPrices.forEach((ql) => {
            validTotals.add(
              (basePrice + ql) * quantity + jewelryPrice * quantity
            );
          });
        }
      } else {
        // combos without jewelry
        validTotals.add(basePrice * quantity);
        certPrices.forEach((cert) =>
          validTotals.add((basePrice + cert) * quantity)
        );
      }

      const itemValidTotals = Array.from(validTotals);
      console.log({
        basePrice,
        certPrices,
        jewelryPrice,
        qualityPrices,
        quantity,
        itemTotal,
        validTotals: Array.from(validTotals),
      });

      if (!itemValidTotals.includes(itemTotal)) {
        return res
          .status(400)
          .json({ msg: `Amount mismatch for product ${productId}` });
      }

      calculatedTotal = calculatedTotal + itemTotal;
    } else if (jewelryId) {
      // Jewelry-only logic
      const jewelry = await Jewelry.findById(jewelryId);
      if (!jewelry) {
        return res.status(404).json({ msg: `Jewelry not found: ${jewelryId}` });
      }
      if (jewelry.stock < quantity) {
        return res
          .status(400)
          .json({ msg: `Insufficient stock for ${jewelry.jewelryName}` });
      }

      const basePrice = jewelry.price || 0;
      const qualityPrices = Array.isArray(jewelry.quality)
        ? jewelry.quality.map((q) => q.price)
        : [];
      const weightPrices = Array.isArray(jewelry.gemstoneWeight)
        ? jewelry.gemstoneWeight.map((w) => w.price)
        : [];
      const certPrices = Array.isArray(jewelry.certificate)
        ? jewelry.certificate.map((c) => c.price)
        : [];

      let validTotals = new Set();

      // base + weight + quality
      weightPrices.forEach((weight) => {
        qualityPrices.forEach((qual) => {
          validTotals.add((basePrice + weight + qual) * quantity);
        });
      });

      // base + weight + quality + certificate
      weightPrices.forEach((weight) => {
        qualityPrices.forEach((qual) => {
          certPrices.forEach((cert) => {
            validTotals.add((basePrice + weight + qual + cert) * quantity);
          });
        });
      });

      const itemValidTotals = Array.from(validTotals);
      console.log("valid totals from jewel", itemValidTotals);

      if (!itemValidTotals.includes(itemTotal)) {
        return res
          .status(400)
          .json({ msg: `Amount mismatch for jewelry ${jewelryId}` });
      }

      calculatedTotal += itemTotal;
    }
  }

  if (calculatedTotal !== totalAmount) {
    return res.status(400).json({ msg: "Final total is mismatched" });
  }
  let razorpayOrderId = null;
  let data = null;

  // if (paymentMethod !== "cod") {
  //   const orderPayload = {
  //     amount: totalAmount * 100,
  //     currency: "INR",
  //     receipt: "receipt_" + Date.now(),
  //   };

  //   const basicAuth = Buffer.from(
  //     process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
  //   ).toString("base64");

  //   const response = await fetch("https://api.razorpay.com/v1/orders", {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Basic ${basicAuth}`,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify(orderPayload),
  //   });

  //   data = await response.json();

  //   if (!response.ok || !data.id) {
  //     return res.status(500).json({ msg: "Failed to create Razorpay order" });
  //   }

  //   razorpayOrderId = data.id;
  // }

  // Reduce stock
  for (const item of items) {
    const { productId, quantity } = item;
    await Product.findByIdAndUpdate(productId, {
      $inc: { stock: -quantity },
    });
  }

  // Reduce stock
  for (const item of items) {
    const { jewelryId, quantity } = item;
    await Jewelry.findByIdAndUpdate(jewelryId, {
      $inc: { stock: -quantity },
    });
  }

  const order = new Order({
    userId: userId,
    orderId: generateOrderId(),
    totalAmount,
    items,
    razorpayOrderId,
    address,
    paymentMethod,
  });

  await order.save();

  return res.status(200).json({
    msg: "Order initiated successfully",
    order,
    data: paymentMethod === "COD" ? null : data,
  });
});

// export const createJewelryOrder = asyncHandler(async (req, res) => {
//   const { items, totalAmount, quantity, address } = req.body;
//   const userId = req.user._id || req.user.id;

//   for(const item of items){
//   const jewelry = await Jewelry.findById(jewelryId);
//   if (!jewelry) {
//     return res.status(404).json({ msg: "No jewelry found" });
//   }
//   if (jewelry.stock < quantity) {
//     return res.status(400).json({ msg: "Insufficient stock" });
//   }
// }

// const basePrice = jewelry.price;
// const qualityPrices = jewelry.quality.map((qual) => qual.price);
// const weightPrices = jewelry.gemstoneWeight.map((weight) => weight.price);
// const certPrices = jewelry.certificate.map((cert) => cert.price);

// let validTotals = new Set();

// weightPrices.forEach((weight) => {
//   qualityPrices.forEach((qual) => {
//     validTotals.add(basePrice + weight + qual);
//   });
// });

// weightPrices.forEach((weight) => {
//   qualityPrices.forEach((qual) => {
//     certPrices.forEach((cert) => {
//       validTotals.add(basePrice + weight + qual + cert);
//     });
//   });
// });

// if (!validTotals.has(totalAmount)) {
//   return res.status(400).json({ msg: "Total amount is mismatched" });
// }

//   const orderPayload = {
//     amount: totalAmount,
//     currency: "INR",
//     receipt: "receipt_" + Date.now(),
//   };

//   const basicAuth = Buffer.from(
//     process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
//   ).toString("base64");

//   const response = await fetch("https://api.razorpay.com/v1/orders", {
//     method: "POST",
//     headers: {
//       Authorization: `basic ${basicAuth}`,
//       "Content-type": "application/json",
//     },
//     body: JSON.stringify(orderPayload),
//   });

//   const data = await response.json();

//   if (!response || !data) {
//     return res.status(400).json({ msg: "Failed to order from razorpay" });
//   }

//   jewelry.stock = jewelry.stock - quantity;
//   await jewelry.save();

//   const order = new Order({
//     userId: userId,
//     jewelryId: jewelryId,
//     totalAmount,
//     razorpayOrderId: data.id,
//     address,
//     quantity,
//   });

//   await order.save();

//   return res.status(200).json({
//     msg: "Jewelry order initiated successfully",
//     order,
//   });
// });

export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const order = await Order.findOne({ razorpayOrderId }).populate(
    "userId retailerId"
  );
  if (!order) {
    return res.status(404).json({ msg: "Order not found" });
  }

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZOR_PAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (razorpaySignature !== generatedSignature) {
    return res.status(400).json({
      msg: "Invalid credentials",
    });
  }
  order.paymentStatus = "Completed";

  // ✅ Clear cart only after successful payment
  const retailer = await Retailer.findById(order.retailerId);
  if (retailer) {
    retailer.cart = [];
    await retailer.save();
  }

  const user = await User.findById(order.userId);
  if (user) {
    user.cart = [];
    await user.save();
  }

  for (const product of order.items) {
    await Product.findByIdAndUpdate(product.productId, {
      $inc: { orderCount: 1 },
    });
  }

  // Add retailer stock ONLY if the order belongs to a retailer
  if (order.retailerId) {
    for (const item of order.items) {
      await RetailerStock.create({
        retailerId: order.retailerId,
        productId: item.productId,
        certificate: item.customization?.certificate
          ? {
              certificateType: item.customization.certificate.certificateType,
              price: item.customization.certificate.price,
            }
          : null,
        quantity: item.quantity,
      });
    }
  }

  // for (const product of order.items) {
  //   const updated = await Product.findOneAndUpdate(
  //     {
  //       _id: product.productId,
  //       stock: { $gte: product.quantity || 1 },
  //     },
  //     {
  //       $inc: {
  //         stock: -(product.quantity || 1),
  //         orderCount: 1,
  //       },
  //     },
  //     { new: true }
  //   );

  //   if (!updated) {
  //     // stock was not enough → oversell prevented
  //     order.paymentStatus = "Pending Refund";
  //     order.orderStatus = "Failed";
  //     await order.save();

  //     return res.status(409).json({
  //       success: false,
  //       msg: `Payment received but ${product.productId} is out of stock. Refund will be issued.`,
  //     });
  //   }
  // }

  // for (const product of order.items) {
  //   await Product.findByIdAndUpdate(product.productId, {
  //     $inc: { orderCount: 1 },
  //   });
  // }

  // for (const jewelry of order.items) {
  //   await Jewelry.findByIdAndUpdate(jewelry.jewelryId, {
  //     $inc: { orderCount: 1 },
  //   });
  // }

  order.razorpayPaymentId = razorpayPaymentId;
  order.razorpaySignature = razorpaySignature;

  await order.save();

  // order confirmation email can be sent here
  await sendEmail({
    to: order?.userId?.email || order?.retailerId?.email,
    subject: `Order Confirmation - #${order.orderId}`,
    html: `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2C3E50;">Order Confirmation</h2>
      <p>Dear ${
        order?.userId?.fullName ||
        order?.retailerId?.fullName ||
        "Valued Customer"
      },</p>
      <p>Thank you for shopping with Gemrishi! We’re pleased to inform you that your order has been successfully placed.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 8px; font-weight: bold;">Order ID:</td>
          <td style="padding: 8px;">${order?.orderId}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Order Status:</td>
          <td style="padding: 8px;">${order?.orderStatus || "Processing"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Payment Status:</td>
          <td style="padding: 8px;">${order?.paymentStatus}</td>
        </tr>
      </table>

      <p>We’ll notify you once your order is packed and shipped. You can also track your order through your account on our website.</p>

      <p>If you have any questions or need assistance, please contact our support team at <a href="mailto:wecare@gemrishi.com">wecare@gemrishi.com</a>.</p>

      <p style="margin-top: 20px;">Thank you for choosing Gemrishi. We appreciate your business!</p>

      <p style="margin-top: 20px;"><strong>Team Gemrishi</strong></p>
    </div>
  `,
  });

  return res.status(200).json({
    msg: "Order Verified Sucessfully",
    order,
  });
});

export const getAllOrders2 = asyncHandler(async (req, res) => {
  let query = {
    $nor: [{ paymentMethod: "razorpay", paymentStatus: "Pending" }], // exclude both true
  };

  const orders = await Order.find(query)
    .populate("userId", "fullName email")
    .populate("retailerId", "fullName email")
    .populate("items.productId items.jewelryId")
    .sort({ createdAt: -1 }); // populate only needed fields

  return res.status(200).json({
    msg: "Orders fetched",
    orders,
  });
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const { search, orderStatus } = req.query;

  // base query
  let query = {
    $nor: [{ paymentMethod: "razorpay", paymentStatus: "Pending" }], // exclude both true
  };

  // Filter by orderStatus if provided
  if (
    orderStatus &&
    ["Pending", "InProgress", "Completed", "Cancelled"].includes(orderStatus)
  ) {
    query.orderStatus = orderStatus;
  }

  // search by orderId or user name
  if (search) {
    // if search is ObjectId-like, check for orderId match
    if (/^[0-9a-fA-F]{24}$/.test(search)) {
      query._id = search;
    } else {
      // search in user name → requires populate + aggregation OR lookup
      // here: first find userIds matching the name
      const users = await User.find({
        fullName: { $regex: search, $options: "i" },
      }).select("_id");

      if (users.length > 0) {
        query.userId = { $in: users.map((u) => u._id) };
      } else {
        query.userId = null; // no user match → will return empty
      }
    }
  }
  console.log("query", query);

  const totalOrders = await Order.countDocuments(query);

  const orders = await Order.find(query)
    .skip(skip)
    .limit(limit)
    .populate({
      path: "userId",
      select: "fullName email",
    })
    .populate({
      path: "items.productId", // full product document populated
    })
    .populate("retailerId")
    .sort({ createdAt: -1, _id: -1 }); // populate only needed fields

  return res.status(200).json({
    msg: "Orders fetched",
    orders,
    totalPage: Math.ceil(totalOrders / limit),
    currentPage: page,
    totalOrders,
  });
});

export const updateOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { paymentStatus, orderStatus } = req.body;
  const order = await Order.findById(orderId).populate("userId retailerId");
  if (!order) {
    return res.status(404).json({ msg: "No order found" });
  }

  // Only update if the field exists in the request
  if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
  if (orderStatus !== undefined) order.orderStatus = orderStatus;

  await order.save();

  await sendEmail({
    to: order?.userId?.email || order?.retailerId?.email,
    subject: `Your Order #${order.orderId} Update`,
    html: `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2C3E50;">Order Update Notification</h2>
      <p>Dear ${
        order?.userId?.fullName ||
        order?.retailerId?.fullName ||
        "Valued Customer"
      },</p>
      <p>We wanted to let you know that there has been an update regarding your order:</p>

      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 8px; font-weight: bold;">Order ID:</td>
          <td style="padding: 8px;">${order.orderId}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Payment Status:</td>
          <td style="padding: 8px;">${order.paymentStatus}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Order Status:</td>
          <td style="padding: 8px;">${order.orderStatus}</td>
        </tr>
      </table>

      <p>If you have any questions or need assistance, please contact our support team at <a href="mailto:wecare@gemrishi.com">wecare@gemrishi.com</a>.</p>

      <p style="margin-top: 20px;">Thank you for choosing Gemrishi. We appreciate your business!</p>

      <p style="margin-top: 20px;"><strong>Team Gemrishi</strong></p>
    </div>
  `,
  });

  return res.status(200).json({
    msg: "Order updated successfully",
    order,
  });
});

export const getOrdersByUser = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const orderStatus = req.query.orderStatus;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // ✅ Base query
  let query = {
    userId: userId,
    $nor: [{ paymentMethod: "razorpay", paymentStatus: "Pending" }], // exclude both true
  };

  // ✅ Optional filter
  if (orderStatus) {
    query.orderStatus = orderStatus;
  }

  // ✅ Count and fetch with pagination
  const totalOrders = await Order.countDocuments(query);

  const orders = await Order.find(query)
    .populate([
      {
        path: "items.productId",
        select: "-reviewRating -wishlistedBy",
      },
      {
        path: "items.jewelryId",
        select: "-reviewRating -wishlistedBy",
      },
      {
        path: "items.customization.jewelryId",
        select: "-reviewRating -wishlistedBy",
      },
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  if (!orders.length) {
    return res.status(404).json({ success: false, msg: "No orders found" });
  }

  return res.status(200).json({
    success: true,
    msg: "Orders found",
    totalListItems: totalOrders,
    page,
    totalPage: Math.ceil(totalOrders / limit),
    limit,
    orders,
  });
});

export const getSingleOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId;
  const order = await Order.findById(orderId).populate([
    {
      path: "userId",
      select:
        "-password -resetPasswordOtp -resetPasswordExpires -wishlist -cart",
    },
    {
      path: "retailerId",
      select: "-password -resetPasswordOtp -resetPasswordExpires -cart",
    },
    {
      path: "items.productId",
      select: "-wishlistedBy -reviewRating -orderCount",
    },
    {
      path: "items.jewelryId",
      select: "-reviewRating -orderCount",
    },
    {
      path: "items.customization.jewelryId",
      select: "-reviewRating -orderCount",
    },
  ]);

  if (!order) {
    return res.status(404).json({ msg: "No Order found" });
  }

  return res.status(200).json({
    msg: "Single Order fetched",
    order,
  });
});

export const getBestSellers = asyncHandler(async (req, res) => {
  const { limit = 5, type = "product" } = req.query;

  const bestSellers = await Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: type === "product" ? "$items.productId" : "$items.jewelryId",
        totalSold: { $sum: "$items.quantity" },
      },
    },
    { $match: { _id: { $ne: null } } },
    { $sort: { totalSold: -1 } },
    { $limit: Number(limit) },
    {
      $lookup: {
        from: type === "product" ? "products" : "jewelries",
        localField: "_id",
        foreignField: "_id",
        as: "itemDetails",
      },
    },
    { $unwind: "$itemDetails" },
  ]);
  const grouped = await Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: type === "product" ? "$items.productId" : "$items.jewelryId",
        totalSold: { $sum: "$items.quantity" },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: Number(limit) },
    { $match: { _id: { $ne: null } } },
  ]);

  return res.status(200).json({
    msg: "Best seller products",
    bestSellers,
  });
});

export const orderUsersForCSV = asyncHandler(async (req, res) => {
  const users = await Order.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$user.fullName" },
        email: { $first: "$user.email" },
        mobileNo: { $first: "$user.mobileNo" },
        address: { $first: { $arrayElemAt: ["$user.address", 0] } },
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: { $sum: "$items.itemTotal" } },
        lastOrder: { $max: "$createdAt" },
      },
    },
    {
      $sort: {
        totalSpent: -1,
      },
    },
  ]);
  return res.status(200).json({
    msg: "Users found",
    users,
  });
});

export const getAllOrderUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { search } = req.query;

  let matchStage = {};

  if (search) {
    matchStage = {
      $or: [
        { "user.fullName": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
      ],
    };
  }

  // First, get total unique users
  const totalUsersAgg = await Order.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: matchStage },
    {
      $group: {
        _id: "$userId",
      },
    },
    {
      $count: "total",
    },
  ]);

  const totalUsers = totalUsersAgg.length > 0 ? totalUsersAgg[0].total : 0;
  const totalPages = Math.ceil(totalUsers / limit);

  // Now, get paginated users
  const users = await Order.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: matchStage },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$user.fullName" },
        email: { $first: "$user.email" },
        mobileNo: { $first: "$user.mobileNo" },
        address: { $first: { $arrayElemAt: ["$user.address", 0] } },
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: { $sum: "$items.itemTotal" } },
        lastOrder: { $max: "$createdAt" },
      },
    },
    { $sort: { totalSpent: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  return res.status(200).json({
    msg: "Users found",
    users,
    currentPage: page,
    totalPages,
    limit,
    totalUsers,
  });
});

export const orderDashboard = asyncHandler(async (req, res) => {
  // need to display total users, revenue, avg order value
  const pipeLine = await Order.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $group: {
        _id: null,
        userCount: { $addToSet: "$userId" },
        revenue: { $sum: { $sum: "$items.itemTotal" } },
        orderCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        userCount: { $size: "$userCount" },
        orderCount: 1,
        revenue: 1,
        avgOrderValue: {
          $cond: [
            { $eq: ["$orderCount", 0] },
            0,
            { $divide: ["$revenue", "$orderCount"] },
          ],
        },
      },
    },
  ]);

  return res.status(200).json(pipeLine[0]);
});

// create order currently using
export const createProductOrder2 = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { address, paymentMethod, promoCode } = req.body; // Added promoCode
  console.log(address);

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      field: "paymentMethod",
      msg: "Payment method is required",
    });
  }

  if (!address) {
    return res
      .status(400)
      .json({ success: false, field: "address", msg: "Address is required" });
  }

  const user = await User.findById(userId)
    .populate({
      path: "cart.item",
      // Let Mongoose use refPath to populate dynamically for both Product and Jewelry
      // Nested populate for Product's subCategory (for offer validation)
      populate: { path: "subCategory" },
    })
    .populate({
      path: "cart.customization.jewelryId", // This might not be needed if cart.item is populated correctly
      model: "Jewelry",
    });

  if (!user || !user.cart || user.cart.length === 0) {
    return res.status(400).json({ success: false, msg: "Your cart is empty" });
  }

  let cartSubtotal = 0;
  const orderItems = [];

  for (const cartItem of user.cart) {
    // The totalPrice is already calculated and stored in the cart item
    const itemTotal = cartItem.totalPrice * cartItem.quantity;

    cartSubtotal += itemTotal;
    orderItems.push({
      productId: cartItem.itemType === "Product" ? cartItem.item._id : null,
      jewelryId: cartItem.itemType === "Jewelry" ? cartItem.item._id : null,
      quantity: cartItem.quantity,
      itemTotal: itemTotal,
      customization: cartItem.customization,
    });
  }

  let discountAmount = 0;
  let finalTotal = cartSubtotal;
  let appliedOffer = null;

  // --- Promo Code Logic --- not using right now
  // if (promoCode) {
  const promoCodeEnabled = false;
  if (promoCodeEnabled == false) {
    const offer = await Offer.findOne({
      promoCode: promoCode.toLowerCase(),
      isActive: true,
      expiryDate: { $gte: new Date() },
    });

    if (!offer || offer.offerType !== "promocode") {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired promo code." });
    }

    let applicableItemsValue = 0;
    const applicableItems = user.cart.filter((cartItem) => {
      if (cartItem.itemType !== offer.productType) {
        return false;
      }

      let isItemApplicable = true;

      if (offer.productType === "Product" && offer.isSubCategory) {
        if (
          !cartItem.item.subCategory ||
          cartItem.item.subCategory._id.toString() !==
            offer.subCategoryTypeId.toString()
        ) {
          isItemApplicable = false;
        }
      }

      if (offer.productType === "Jewelry") {
        if (
          offer.isJewelryType &&
          cartItem.item.jewelryType !== offer.jewelryType
        ) {
          isItemApplicable = false;
        }
        if (
          offer.isJewelryMetal &&
          cartItem.item.metal !== offer.jewelryMetal
        ) {
          isItemApplicable = false;
        }
      }

      if (isItemApplicable) {
        applicableItemsValue += cartItem.totalPrice * cartItem.quantity;
      }
      return isItemApplicable;
    });

    if (applicableItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "This promo code is not applicable to any items in your cart.",
      });
    }

    if (offer.totalAmount) {
      if (
        cartSubtotal < offer.minTotalAmount ||
        cartSubtotal > offer.maxTotalAmount
      ) {
        return res.status(400).json({
          success: false,
          message: `This promo code is only valid for orders between ${offer.minTotalAmount} and ${offer.maxTotalAmount}.`,
        });
      }
    }

    if (offer.itemAmount) {
      if (
        applicableItemsValue < offer.minItemAmount ||
        applicableItemsValue > offer.maxItemAmount
      ) {
        return res.status(400).json({
          success: false,
          message: `This promo code requires the total value of applicable items to be between ${offer.minItemAmount} and ${offer.maxItemAmount}.`,
        });
      }
    }

    if (offer.discountType === "percent") {
      discountAmount = (applicableItemsValue * offer.discountValue) / 100;
    } else if (offer.discountType === "flat") {
      discountAmount = offer.discountValue;
    }

    if (discountAmount > applicableItemsValue) {
      discountAmount = applicableItemsValue;
    }
    // Round discountAmount to 2 decimal places
    discountAmount = parseFloat(discountAmount.toFixed(2));

    finalTotal = cartSubtotal - discountAmount;
    appliedOffer = offer._id; // Store reference to the applied offer
  }

  // Round finalTotal and cartSubtotal to 2 decimal places for consistency
  finalTotal = parseFloat(finalTotal.toFixed(2));
  cartSubtotal = parseFloat(cartSubtotal.toFixed(2));
  // --- End of Promo Code Logic ---

  // return res.status(200).json({ success: true, msg: "Testing", finalTotal, discountAmount, appliedOffer, cartSubtotal, orderItems });

  let razorpayOrderId = null;
  let data = null;

  if (paymentMethod !== "cod") {
    const orderPayload = {
      amount: Math.round(finalTotal * 100), // Use finalTotal and round to avoid floating point issues
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const basicAuth = Buffer.from(
      process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
    ).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    data = await response.json();

    if (!response.ok || !data.id) {
      return res.status(500).json({ msg: "Failed to create Razorpay order" });
    }

    razorpayOrderId = data.id;
  }

  // for (const item of orderItems) {
  //   if (item.productId) {
  //     await Product.findByIdAndUpdate(item.productId, {
  //       $inc: { stock: -item.quantity },
  //     }, { new: true });
  //   }
  // if (item.jewelryId) {
  //   await Jewelry.findByIdAndUpdate(item.jewelryId, {
  //     $inc: { stock: -item.quantity },
  //   }, { new: true });
  // }
  // }

  const order = new Order({
    userId: userId,
    orderId: generateOrderId(),
    totalAmount: finalTotal,
    subTotal: cartSubtotal,
    discountAmount: discountAmount,
    offerId: appliedOffer,
    items: orderItems,
    razorpayOrderId,
    address,
    paymentMethod,
  });

  await order.save();

  if (paymentMethod == "cod") {
    user.cart = [];
    await user.save();
  }

  return res.status(200).json({
    msg: "Order initiated successfully",
    order,
    data: paymentMethod === "cod" ? null : data,
  });
});

// create order currently not using its old one but working for the gemstone only purchase
export const createProductOrder33333 = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { address, paymentMethod } = req.body;

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      field: "paymentMethod",
      msg: "Payment method is required",
    });
  }

  if (!address) {
    return res
      .status(400)
      .json({ success: false, field: "address", msg: "Address is required" });
  }

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, field: "User", msg: "User not found" });
  }

  const user = await User.findById(userId)
    .populate({
      path: "cart.item",
      model: "Product",
    })
    .populate({
      path: "cart.customization.jewelryId",
      model: "Jewelry",
    });

  if (!user || !user.cart || user.cart.length === 0) {
    return res.status(400).json({ msg: "Your cart is empty" });
  }

  let alltotal = 0;
  const orderItems = [];

  for (const cartItem of user.cart) {
    let itemTotal = 0;
    if (cartItem.item) {
      itemTotal = cartItem.item.price * cartItem.quantity;
    }

    if (cartItem.customization) {
      if (
        cartItem.customization.certificate &&
        cartItem.customization.certificate.price
      ) {
        itemTotal += cartItem.customization.certificate.price;
      }
      if (
        cartItem.customization.gemstoneWeight &&
        cartItem.customization.gemstoneWeight.price
      ) {
        itemTotal += cartItem.customization.gemstoneWeight.price;
      }
      if (
        cartItem.customization.quality &&
        cartItem.customization.quality.price
      ) {
        itemTotal += cartItem.customization.quality.price;
      }
      if (
        cartItem.customization.jewelryId &&
        cartItem.customization.jewelryId.price
      ) {
        itemTotal += cartItem.customization.jewelryId.price;
      }
    }

    alltotal += itemTotal;
    orderItems.push({
      productId: cartItem.item ? cartItem.item._id : null,
      jewelryId: cartItem.customization
        ? cartItem.customization.jewelryId
        : null,
      quantity: cartItem.quantity,
      itemTotal: itemTotal,
      customization: cartItem.customization,
    });
  }

  let razorpayOrderId = null;
  let data = null;

  console.log(alltotal);

  if (paymentMethod !== "cod") {
    const orderPayload = {
      amount: alltotal * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const basicAuth = Buffer.from(
      process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
    ).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    data = await response.json();

    if (!response.ok || !data.id) {
      return res.status(500).json({ msg: "Failed to create Razorpay order" });
    }

    razorpayOrderId = data.id;
  }

  for (const item of orderItems) {
    if (item.productId) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }
    // if (item.jewelryId) {
    // await Jewelry.findByIdAndUpdate(item.jewelryId, {
    //   $inc: { stock: -item.quantity },
    // });
    // }
  }

  const order = new Order({
    userId: userId,
    orderId: generateOrderId(),
    totalAmount: alltotal,
    items: orderItems,
    razorpayOrderId,
    address,
    paymentMethod,
  });

  await order.save();

  user.cart = [];
  await user.save();

  return res.status(200).json({
    msg: "Order initiated successfully",
    order,
    data: paymentMethod === "cod" ? null : data,
  });
});

export const cancelOrderByUser = asyncHandler(async (req, res) => {
  const { orderId, reason } = req.body;
  const userId = req.user._id;

  if (!orderId) {
    return res
      .status(400)
      .json({ success: false, msg: "Order ID and Item ID are required." });
  }

  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    userId: userId,
  });

  if (!order) {
    return res.status(404).json({ success: false, msg: "No order found" });
  }

  order.orderStatus = "Cancelled";
  order.cancelOrderReason = reason || "Cancelled by user";

  const updatedOrder = await order.save();

  return res.status(200).json({
    success: true,
    msg: "Order Cancelled successfully",
    updatedOrder,
  });
});

export const cancelOrderByUser2 = asyncHandler(async (req, res) => {
  const { orderId, itemId, reason } = req.body;
  const userId = req.user._id;

  if (!orderId || !itemId) {
    return res.status(400).json({
      success: false,
      msg: "Order ID and Item ID are required.",
    });
  }

  // Get order of this user
  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    userId,
  });

  if (!order) {
    return res.status(404).json({ success: false, msg: "No order found" });
  }

  // ❌ Cannot cancel after shipped or completed
  if (["Shipped", "Completed"].includes(order.orderStatus)) {
    return res.status(400).json({
      success: false,
      msg: "Order cannot be cancelled at this stage.",
    });
  }

  // Correct matching for product, jewelry, or customization
  const itemToCancel = order.items.find((item) => {
    const productId = item.productId?._id?.toString();
    const jewelryId = item.jewelryId?._id?.toString();
    const customJewelryId = item.customization?.jewelryId?._id?.toString();

    console.log("COMPARE IDs:", {
      productId,
      jewelryId,
      customJewelryId,
      incoming: itemId,
    });

    return (
      productId === itemId || jewelryId === itemId || customJewelryId === itemId
    );
  });

  if (!itemToCancel) {
    return res.status(404).json({
      success: false,
      msg: "Item not found in this order.",
    });
  }

  // Mark item as cancelled
  itemToCancel.cancelStatus = true;
  itemToCancel.cancelOrderReason = reason || "Cancelled by user";

  // Restore stock
  if (itemToCancel.productId?._id) {
    await Product.findByIdAndUpdate(itemToCancel.productId._id, {
      $inc: { stock: itemToCancel.quantity },
    });
  }

  if (itemToCancel.jewelryId?._id) {
    await Jewelry.findByIdAndUpdate(itemToCancel.jewelryId._id, {
      $inc: { stock: itemToCancel.quantity },
    });
  }

  // Check if all items are cancelled
  const allItemsCancelled = order.items.every(
    (item) => item.cancelStatus === true
  );

  if (allItemsCancelled) {
    order.orderStatus = "Cancelled";

    // Razorpay needs refund
    if (order.paymentMethod === "razorpay") {
      order.paymentStatus = "Pending Refund";
    }
  }

  // For partial cancel (some items cancelled)
  else {
    // If prepaid → mark refund pending for that item
    if (order.paymentMethod === "razorpay") {
      order.paymentStatus = "Pending Refund";
    }
  }

  const updatedOrder = await order.save();

  return res.status(200).json({
    success: true,
    msg: "Order cancelled successfully",
    updatedOrder,
  });
});

export const createProductRetailerOrder2 = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { address, paymentMethod } = req.body;

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      field: "paymentMethod",
      msg: "Payment method is required",
    });
  }

  if (!address) {
    return res
      .status(400)
      .json({ success: false, field: "address", msg: "Address is required" });
  }

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, field: "User", msg: "User not found" });
  }

  const user = await Retailer.findById(userId).populate({
    path: "cart.item",
    model: "Product",
  });

  if (!user || !user.cart || user.cart.length === 0) {
    return res.status(400).json({ msg: "Your cart is empty" });
  }

  let alltotal = 0;
  const orderItems = [];

  for (const cartItem of user.cart) {
    let itemTotal = 0;
    const product = await Product.findById(cartItem.item);
    if (!product) {
      return res.status(404).json({ msg: "Product not found in cart" });
    }

    if (product.stock < cartItem.quantity) {
      return res
        .status(400)
        .json({ msg: `Insufficient stock for ${product.name}` });
    }

    const productId = cartItem.item._id;
    const quantity = Number(cartItem.quantity);

    const updated = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: quantity } }, // condition
      { $inc: { stock: -quantity } }, // atomic decrement
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        msg: `Insufficient stock for ${cartItem.item.name}.`,
      });
    }

    if (product.price !== cartItem.item.price) {
      return res.status(400).json({
        msg: `Price of ${product.name} has changed. Please review your cart.`,
      });
    }

    if (product.stock <= 0) {
      return res
        .status(400)
        .json({ msg: `Product ${product.name} is out of stock.` });
    }

    const prodCertificates = product.certificate.map((cert) => ({
      type: cert.certificateType,
      price: cert.price,
    }));

    if (cartItem.customization?.certificate) {
      const { certificateType, price } = cartItem.customization.certificate;

      const isValid = prodCertificates.some(
        (cert) => cert.type === certificateType && cert.price === price
      );

      if (!isValid) {
        return res.status(400).json({
          msg: `Certificate option (${certificateType}) for ${product.name} is no longer valid. Please review your cart.`,
        });
      }
    }

    if (cartItem.item) {
      itemTotal = cartItem.item.price * cartItem.quantity;
    }

    if (cartItem.customization) {
      if (
        cartItem.customization.certificate &&
        cartItem.customization.certificate.price
      ) {
        itemTotal += cartItem.customization.certificate.price;
      }
    }

    alltotal += itemTotal;
    orderItems.push({
      productId: cartItem.item ? cartItem.item._id : null,
      // jewelryId: cartItem.customization
      //   ? cartItem.customization.jewelryId
      //   : null,
      quantity: cartItem.quantity,
      itemTotal: itemTotal,
      customization: cartItem.customization,
    });
  }

  let razorpayOrderId = null;
  let data = null;

  console.log(alltotal);

  if (paymentMethod !== "cod") {
    const orderPayload = {
      amount: alltotal * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const basicAuth = Buffer.from(
      process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
    ).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    data = await response.json();
    console.log("Razorpay response data:", data);

    if (!response.ok || !data.id) {
      return res.status(500).json({ msg: "Failed to create Razorpay order" });
    }

    razorpayOrderId = data.id;
  }

  if (paymentMethod === "cod") {
    user.cart = [];
    await user.save();
  }

  // for (const item of orderItems) {
  //   if (item.productId) {
  //     await Product.findByIdAndUpdate(item.productId, {
  //       $inc: { stock: -item.quantity },
  //     });
  //   }
  // }

  const order = new Order({
    retailerId: userId,
    orderId: generateOrderId(),
    totalAmount: alltotal,
    items: orderItems,
    razorpayOrderId,
    address,
    paymentMethod,
  });

  if (paymentMethod === "cod") {
    for (const item of orderItems) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity, orderCount: 1 },
        });
      }
    }

    // 🟢 mark payment completed for COD
    order.paymentStatus = "Pending";
    await order.save();
  }

  await order.save();

  console.log("orderItems", orderItems);

  // for (const item of orderItems) {
  //   if (item.productId) {
  //     await RetailerStock.create({
  //       retailerId: userId,
  //       productId: item.productId,
  //       certificate: item.customization?.certificate
  //         ? {
  //             certificateType: item.customization.certificate.certificateType,
  //             price: item.customization.certificate.price,
  //           }
  //         : null,
  //       quantity: item.quantity,
  //     });
  //   }
  // }

  // user.cart = [];
  // await user.save();

  return res.status(200).json({
    msg: "Order initiated successfully",
    order,
    data: paymentMethod === "cod" ? null : data,
  });
});

export const createProductRetailerOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { totalAmount, items, address, paymentMethod } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ msg: "Items array is required" });
  }

  let calculatedTotal = 0;

  // Validate stock for all items
  for (const item of items) {
    const { productId, jewelryId, quantity, itemTotal, customization } = item;

    if (productId) {
      const product = await Product.findById(productId);
      const jewelry = await Jewelry.findById(jewelryId);
      if (!product) {
        return res.status(404).json({ msg: "Product not found:" });
      }

      if (product.stock < quantity) {
        return res
          .status(400)
          .json({ msg: `Insufficient stock for ${product.name}` });
      }
      const basePrice = product.price;
      const certPrices = product.certificate.map((cert) => cert.price);
      const jewelryPrice =
        jewelry && typeof jewelry.price === "number" ? jewelry.price : null;
      const qualityPrices =
        jewelry && Array.isArray(jewelry.quality)
          ? jewelry.quality.map((qual) => qual.price)
          : [];

      let validTotals = new Set();

      if (jewelry) {
        // must include jewelry combinations only
        if (typeof jewelryPrice === "number") {
          validTotals.add(basePrice * quantity + jewelryPrice * quantity);

          certPrices.forEach((cert) => {
            validTotals.add(
              (basePrice + cert) * quantity + jewelryPrice * quantity
            );
            qualityPrices.forEach((ql) => {
              validTotals.add(
                (basePrice + cert + ql) * quantity + jewelryPrice * quantity
              );
            });
          });

          qualityPrices.forEach((ql) => {
            validTotals.add(
              (basePrice + ql) * quantity + jewelryPrice * quantity
            );
          });
        }
      } else {
        // combos without jewelry
        validTotals.add(basePrice * quantity);
        certPrices.forEach((cert) =>
          validTotals.add((basePrice + cert) * quantity)
        );
      }

      const itemValidTotals = Array.from(validTotals);
      console.log({
        basePrice,
        certPrices,
        jewelryPrice,
        qualityPrices,
        quantity,
        itemTotal,
        validTotals: Array.from(validTotals),
      });

      if (!itemValidTotals.includes(itemTotal)) {
        return res
          .status(400)
          .json({ msg: `Amount mismatch for product ${productId}` });
      }

      calculatedTotal = calculatedTotal + itemTotal;
    } else if (jewelryId) {
      // Jewelry-only logic
      const jewelry = await Jewelry.findById(jewelryId);
      if (!jewelry) {
        return res.status(404).json({ msg: `Jewelry not found: ${jewelryId}` });
      }
      if (jewelry.stock < quantity) {
        return res
          .status(400)
          .json({ msg: `Insufficient stock for ${jewelry.jewelryName}` });
      }

      const basePrice = jewelry.price || 0;
      const qualityPrices = Array.isArray(jewelry.quality)
        ? jewelry.quality.map((q) => q.price)
        : [];
      const weightPrices = Array.isArray(jewelry.gemstoneWeight)
        ? jewelry.gemstoneWeight.map((w) => w.price)
        : [];
      const certPrices = Array.isArray(jewelry.certificate)
        ? jewelry.certificate.map((c) => c.price)
        : [];

      let validTotals = new Set();

      // base + weight + quality
      weightPrices.forEach((weight) => {
        qualityPrices.forEach((qual) => {
          validTotals.add((basePrice + weight + qual) * quantity);
        });
      });

      // base + weight + quality + certificate
      weightPrices.forEach((weight) => {
        qualityPrices.forEach((qual) => {
          certPrices.forEach((cert) => {
            validTotals.add((basePrice + weight + qual + cert) * quantity);
          });
        });
      });

      const itemValidTotals = Array.from(validTotals);
      console.log("valid totals from jewel", itemValidTotals);

      if (!itemValidTotals.includes(itemTotal)) {
        return res
          .status(400)
          .json({ msg: `Amount mismatch for jewelry ${jewelryId}` });
      }

      calculatedTotal += itemTotal;
    }
  }

  if (calculatedTotal !== totalAmount) {
    return res.status(400).json({ msg: "Final total is mismatched" });
  }
  let razorpayOrderId = null;
  let data = null;

  if (paymentMethod !== "cod") {
    const orderPayload = {
      amount: totalAmount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const basicAuth = Buffer.from(
      process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
    ).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    data = await response.json();

    if (!response.ok || !data.id) {
      return res.status(500).json({ msg: "Failed to create Razorpay order" });
    }

    razorpayOrderId = data.id;
  }

  // Reduce stock
  for (const item of items) {
    const { productId, quantity } = item;
    await Product.findByIdAndUpdate(productId, {
      $inc: { stock: -quantity },
    });
  }

  // Reduce stock
  for (const item of items) {
    const { jewelryId, quantity } = item;
    await Jewelry.findByIdAndUpdate(jewelryId, {
      $inc: { stock: -quantity },
    });
  }

  const order = new Order({
    retailerId: userId,
    orderId: generateOrderId(),
    totalAmount,
    items,
    razorpayOrderId,
    address,
    paymentMethod,
  });

  await order.save();

  return res.status(200).json({
    msg: "Order initiated successfully",
    order,
    data: paymentMethod === "COD" ? null : data,
  });
});

// new createProductOrder3 controller

/* -------------------- helpers (same semantics as applyOfferToCart) -------------------- */
function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeMetal(val) {
  if (!val) return "";
  const s = String(val).trim().toLowerCase();
  if (["panchdhatu", "pachadhatu", "panchadhatu"].includes(s))
    return "panchadhatu";
  if (s.startsWith("gold")) return "gold"; // gold, gold24k, gold22k, gold18k -> gold
  return s; // silver, platinum, etc.
}

// recompute a single cart line's unit price using latest metal rates + customization
function computeUnitPrice({ cartItem, latestRates }) {
  const { itemType, item, customization = {} } = cartItem;

  if (itemType === "Product") {
    let unit = Number(item.price || 0);
    if (customization.certificate?.price)
      unit += Number(customization.certificate.price);

    if (customization.jewelryId && customization.jewelryId._id) {
      const j = customization.jewelryId;
      let jewelryPrice = Number(j.jewelryPrice || 0);
      const baseMetal = normalizeMetal(j.metal);
      const w = Number(j.jewelryMetalWeight || 0);

      if (baseMetal === "gold") {
        const karat = String(
          customization.goldKarat?.karatType || ""
        ).toLowerCase();
        if (!["gold24k", "gold22k", "gold18k"].includes(karat)) {
          throw new Error(
            "Gold jewelry requires goldKarat.karatType in customization."
          );
        }
        const rate = Number(latestRates?.gold?.[karat]?.withGSTRate || 0);
        if (!rate) throw new Error(`Latest metal rate missing for ${karat}.`);
        jewelryPrice += w * rate;
      } else {
        const rate = Number(latestRates?.[baseMetal]?.withGSTRate || 0);
        if (!rate)
          throw new Error(`Latest metal rate missing for ${baseMetal}.`);
        jewelryPrice += w * rate;
      }

      if (customization.diamondSubstitute?.price) {
        jewelryPrice += Number(customization.diamondSubstitute.price);
      }
      unit += jewelryPrice;
    }

    return round2(unit);
  }

  if (itemType === "Jewelry") {
    const j = item;
    let unit = Number(j.jewelryPrice || 0);

    if (customization.gemstoneWeight?.price)
      unit += Number(customization.gemstoneWeight.price);
    if (customization.certificate?.price)
      unit += Number(customization.certificate.price);

    const baseMetal = normalizeMetal(j.metal);
    const w = Number(j.jewelryMetalWeight || 0);

    if (baseMetal === "gold") {
      const karat = String(
        customization.goldKarat?.karatType || ""
      ).toLowerCase();
      if (!["gold24k", "gold22k", "gold18k"].includes(karat)) {
        throw new Error(
          "Gold jewelry requires goldKarat.karatType in customization."
        );
      }
      const rate = Number(latestRates?.gold?.[karat]?.withGSTRate || 0);
      if (!rate) throw new Error(`Latest metal rate missing for ${karat}.`);
      unit += w * rate;
    } else {
      const rate = Number(latestRates?.[baseMetal]?.withGSTRate || 0);
      if (!rate) throw new Error(`Latest metal rate missing for ${baseMetal}.`);
      unit += w * rate;
    }

    if (customization.diamondSubstitute?.price) {
      unit += Number(customization.diamondSubstitute.price);
    }

    return round2(unit);
  }

  throw new Error(`Unknown itemType: ${itemType}`);
}

/* -------------------- controller -------------------- */
export const createProductOrder3 = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { address, paymentMethod, promoCode } = req.body;

  // console.log(req.body);

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      field: "paymentMethod",
      msg: "Payment method is required",
    });
  }
  if (!address) {
    return res
      .status(400)
      .json({ success: false, field: "address", msg: "Address is required" });
  }

  // load user cart fully enough for repricing + eligibility
  const user = await User.findById(userId)
    .populate({
      path: "cart.item",
      populate: { path: "subCategory" }, // for Product subCategory offer checks
    })
    .populate({
      path: "cart.customization.jewelryId",
      model: "Jewelry",
      select:
        "jewelryName jewelryPrice jewelryMetalWeight metal certificate gemstoneWeight jewelryType slug sku",
    });

  if (!user || !user.cart || user.cart.length === 0) {
    return res.status(400).json({ success: false, msg: "Your cart is empty" });
  }

  // latest metal rates (required for repricing)
  const latestRates = await MetalRates.findOne().sort({ createdAt: -1 }).lean();
  if (!latestRates) {
    return res
      .status(503)
      .json({ success: false, msg: "Metal rates unavailable." });
  }

  // --- Stock Validation (Products only) ---
  for (const cartItem of user.cart) {
    // Skip jewelry items completely
    if (cartItem.itemType === "Jewelry") {
      continue;
    }

    // For Product, validate stock
    const productId = cartItem.item._id;
    const quantity = Number(cartItem.quantity);

    const updated = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        msg: `Insufficient stock for ${cartItem.item.name}.`,
      });
    }
  }

  // Recompute unit price for each line (do not persist to DB here; order uses recomputed values)
  const recomputed = [];
  let subTotal = 0;
  const priceErrors = [];
  for (const ci of user.cart) {
    try {
      const newUnit = computeUnitPrice({ cartItem: ci, latestRates });
      const lineTotal = newUnit * Number(ci.quantity || 0);
      recomputed.push({
        ...(ci.toObject?.() ? ci.toObject() : ci),
        _unit: newUnit,
        _line: lineTotal,
      });
      subTotal += lineTotal;
    } catch (err) {
      priceErrors.push({ cartItemId: ci._id, reason: err.message });
    }
  }
  subTotal = round2(subTotal);

  // Promo Code application (same rules as applyOfferToCart)
  let discountAmount = 0;
  let appliedOffer = null;

  if (promoCode) {
    const offer = await Offer.findOne({
      promoCode: String(promoCode || "")
        .trim()
        .toLowerCase(),
      isActive: true,
      expiryDate: { $gte: new Date() },
    }).lean();

    if (!offer || offer.offerType !== "promocode") {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired promo code." });
    }

    // totalAmount constraint on whole cart (recomputed subtotal)
    if (offer.totalAmount) {
      const minOk =
        offer.minTotalAmount == null ||
        Number(subTotal) >= Number(offer.minTotalAmount);
      const maxOk =
        offer.maxTotalAmount == null ||
        Number(subTotal) <= Number(offer.maxTotalAmount);
      if (!minOk || !maxOk) {
        return res.status(400).json({
          success: false,
          message: `This promo code is valid for orders between ${offer.minTotalAmount} and ${offer.maxTotalAmount}.`,
        });
      }
    }

    // Per-line eligibility & itemAmount (per-unit)
    let applicableLineTotal = 0;
    for (const ci of recomputed) {
      if (ci._unit == null) continue; // skip pricing failures
      const quantity = Number(ci.quantity || 0);
      const unit = Number(ci._unit || 0);
      const lineTotal = unit * quantity;

      // productType check
      if (ci.itemType !== offer.productType) continue;

      let eligible = true;
      if (ci.itemType === "Product") {
        const product = ci.item;
        if (!product || !product._id) continue;
        if (offer.isSubCategory) {
          const prodSubCat =
            product.subCategory?._id?.toString?.() ||
            product.subCategory?.toString?.();
          const offerSubCat = offer.subCategoryTypeId?.toString();
          if (!offerSubCat || !prodSubCat || prodSubCat !== offerSubCat) {
            eligible = false;
          }
        }
      } else {
        const jewelry = ci.item;
        if (!jewelry || !jewelry._id) continue;
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

      if (!eligible) continue;

      if (offer.itemAmount) {
        const minOk =
          offer.minItemAmount == null || unit >= Number(offer.minItemAmount);
        const maxOk =
          offer.maxItemAmount == null || unit <= Number(offer.maxItemAmount);
        if (!minOk || !maxOk) continue;
      }

      applicableLineTotal += lineTotal;
    }

    if (applicableLineTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: "This promo code is not applicable to any items in your cart.",
      });
    }

    // discount math (same as applyOfferToCart)
    if (offer.discountType === "percent") {
      discountAmount =
        (applicableLineTotal * Number(offer.discountValue)) / 100;
    } else if (offer.discountType === "flat") {
      // flat **per unit** across eligible lines (like applyOfferToCart)
      // If you want flat **per line**, change the accumulation approach.
      let unitsEligible = 0;
      for (const ci of recomputed) {
        if (ci._unit == null) continue;
        const quantity = Number(ci.quantity || 0);
        const unit = Number(ci._unit || 0);

        if (ci.itemType !== offer.productType) continue;

        let eligible = true;
        if (ci.itemType === "Product") {
          const product = ci.item;
          if (!product || !product._id) continue;
          if (offer.isSubCategory) {
            const prodSubCat =
              product.subCategory?._id?.toString?.() ||
              product.subCategory?.toString?.();
            const offerSubCat = offer.subCategoryTypeId?.toString();
            if (!offerSubCat || !prodSubCat || prodSubCat !== offerSubCat) {
              eligible = false;
            }
          }
        } else {
          const jewelry = ci.item;
          if (!jewelry || !jewelry._id) continue;
          if (offer.isJewelryType) {
            if (
              !offer.jewelryType ||
              jewelry.jewelryType !== offer.jewelryType
            ) {
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

        if (!eligible) continue;
        if (offer.itemAmount) {
          const minOk =
            offer.minItemAmount == null || unit >= Number(offer.minItemAmount);
          const maxOk =
            offer.maxItemAmount == null || unit <= Number(offer.maxItemAmount);
          if (!minOk || !maxOk) continue;
        }
        unitsEligible += quantity;
      }
      discountAmount = Number(offer.discountValue) * unitsEligible;
    }

    // cap discount to value of applicable items
    if (discountAmount > applicableLineTotal)
      discountAmount = applicableLineTotal;
    discountAmount = round2(discountAmount);
    appliedOffer = offer._id;
  }

  const finalTotal = round2(Math.max(0, subTotal - discountAmount));

  let partialPay = false;
  if (finalTotal > 20000 && paymentMethod === "cod") {
    partialPay = false;
    return res.status(400).json({
      success: false,
      msg: "Can not Order as Cash On Delivery When Total Amount is Greater than ₹20000",
    });
  }

  let onlinePayAmount = 0;
  let offlinePayAmount = 0;

  if (finalTotal > 20000 && paymentMethod !== "cod") {
    onlinePayAmount = finalTotal;
    offlinePayAmount = 0;
    partialPay = false;
  }

  // console.log("final",finalTotal)

  if (finalTotal < 20000 && finalTotal > 5000 && paymentMethod === "cod") {
    onlinePayAmount = (finalTotal * 10) / 100; // 10% of the amoount
    offlinePayAmount = (finalTotal * 90) / 100; // 90% of the amoount
    partialPay = true;
  }

  if (finalTotal < 20000 && finalTotal > 5000 && paymentMethod !== "cod") {
    onlinePayAmount = finalTotal;
    offlinePayAmount = 0;
    partialPay = false;
  }

  // console.log("online",onlinePayAmount)
  // console.log("offlne",offlinePayAmount)
  // console.log("partial ",partialPay)

  if (finalTotal < 5000 && paymentMethod === "cod") {
    onlinePayAmount = 0;
    offlinePayAmount = finalTotal;
    partialPay = false;
  } else if (finalTotal < 5000 && paymentMethod !== "cod") {
    onlinePayAmount = finalTotal;
    offlinePayAmount = 0;
    partialPay = false;
  }

  // Build order items from recomputed lines
  const orderItems = recomputed
    .filter((ci) => ci._unit != null)
    .map((ci) => ({
      productId: ci.itemType == "Product" ? ci.item._id : null,
      jewelryId: ci.itemType == "Jewelry" ? ci.item._id : null,
      quantity: ci.quantity,
      itemTotal: round2(ci._unit * Number(ci.quantity || 0)),
      customization: ci.customization,
    }));

  // (Optional) You might want to fail if some lines couldn't be priced:
  // if (priceErrors.length) { return res.status(400).json({ success:false, message:"Some items couldn't be priced.", priceErrors }); }

  // Create Razorpay order if needed
  let razorpayOrderId = null;
  let data = null;

  //   if (paymentMethod !== "cod") {
  //     const orderPayload = {
  //       amount: Math.round(finalTotal * 100),
  //       currency: "INR",
  //       receipt: "receipt_" + Date.now(),
  //     };

  //     const basicAuth = Buffer.from(
  //       process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
  //     ).toString("base64");

  //     const response = await fetch("https://api.razorpay.com/v1/orders", {
  //       method: "POST",
  //       headers: {
  //         Authorization: `Basic ${basicAuth}`,
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(orderPayload),
  //     });

  //     data = await response.json();
  //     if (!response.ok || !data.id) {
  //       return res.status(500).json({ msg: "Failed to create Razorpay order" });
  //     }
  //     razorpayOrderId = data.id;
  //   }

  // if (paymentMethod === "razorpay" && partialPay == true) {
  //     const orderPayload = {
  //       amount: Math.round(onlinePayAmount * 100),
  //       currency: "INR",
  //       receipt: "receipt_" + Date.now(),
  //     };

  //     const basicAuth = Buffer.from(
  //       process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
  //     ).toString("base64");

  //     const response = await fetch("https://api.razorpay.com/v1/orders", {
  //       method: "POST",
  //       headers: {
  //         Authorization: `Basic ${basicAuth}`,
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(orderPayload),
  //     });

  //     data = await response.json();
  //     if (!response.ok || !data.id) {
  //       return res.status(500).json({ msg: "Failed to create Razorpay order" });
  //     }
  //     razorpayOrderId = data.id;
  //   }
  const shouldCreateRazorpay = onlinePayAmount > 0;
  if (shouldCreateRazorpay) {
    const orderPayload = {
      amount: Math.round(onlinePayAmount * 100), // 🔑 IMPORTANT
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const basicAuth = Buffer.from(
      process.env.RAZOR_PAY_KEY_ID + ":" + process.env.RAZOR_PAY_KEY_SECRET
    ).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    data = await response.json();

    if (!response.ok || !data.id) {
      return res.status(500).json({ msg: "Failed to create Razorpay order" });
    }

    razorpayOrderId = data.id;
  }

  const order = new Order({
    userId,
    orderId: generateOrderId(),
    totalAmount: finalTotal, // final after discount
    subTotal: subTotal, // recomputed subtotal
    discountAmount: discountAmount, // from promo
    offerId: appliedOffer || undefined,
    items: orderItems,
    razorpayOrderId,
    address,
    paymentMethod,
    onlinePayAmount,
    offlinePayAmount,
    partialPay,
  });

  await order.save();

  if (paymentMethod == "cod") {
    user.cart = [];
    await user.save();
  }

  return res.status(200).json({
    msg: "Order initiated successfully",
    order,
    data: shouldCreateRazorpay ? data : null,
  });
});
