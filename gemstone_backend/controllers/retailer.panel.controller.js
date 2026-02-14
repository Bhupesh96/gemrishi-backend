import bcrypt from "bcryptjs";
import { Retailer } from "../models/retailer.model.js";
import { RetailerStock } from "../models/retailerStock.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendEmail } from "../utils/sendEmails.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Order } from "../models/order.model.js";
import { BuyBackRequest } from "../models/buy.back.request.model.js";
import mongoose from "mongoose";

// Get all retailers stock list
export const getAllStockList = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const retailerId = req.user._id;

  const total = await RetailerStock.countDocuments({ retailerId });

  const retailerStock = await RetailerStock.find({ retailerId: retailerId })
    .skip(skip)
    .limit(limit)
    .select()
    .populate({ path: "productId" });

  if (!retailerStock || retailerStock.length === 0) {
    return res.status(404).json({
      success: false,
      msg: "No Retailer Stock found",
      total,
      currentPage: page,
      retailerStock,
    });
  }

  return res.status(200).json({
    success: true,
    msg: "Retailers Stock List Fetched Successfully",
    totalPage: Math.ceil(total / limit),
    currentPage: page,
    retailerStock,
  });
});

export const getRetailerStockBySubCategory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { retailerId } = req.params;

  const totalRetailerStock = await RetailerStock.countDocuments({ retailerId });

  const stocks = await RetailerStock.find({ retailerId })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "productId",
      populate: {
        path: "subCategory",
        select: "name slug image",
      },
    })
    .populate("buyBackRequestId")
    .lean();

  // group by subcategory
  const grouped = {};

  for (const stock of stocks) {
    const sub = stock.productId?.subCategory;
    if (!sub) continue;

    if (!grouped[sub.name]) {
      grouped[sub.name] = [];
    }
    grouped[sub.name].push({
      ...stock.productId, // product details
      certificate: stock.certificate, // include certificate info
      quantity: stock.quantity,
      status: stock.buyBackRequestId?.status,
      buyBackReq: stock.buyBackRequestId,
    });

    grouped[sub.name] = grouped[sub.name].slice(0, 50); // limit to 10 items per subcategory
  }

  return res.status(200).json({
    msg: "Retailer stock grouped by subcategory",
    data: grouped,
    currentPage: page,
    totalPages: Math.ceil(totalRetailerStock / limit),
  });
});

export const getAllOrdersByRetailer = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const retailerId = req.user._id;
  const query = {
    retailerId,
    $nor: [{ paymentMethod: "razorpay", paymentStatus: "Pending" }],
  };
  const totalOrders = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  if (!orders || orders.length === 0) {
    return res.status(404).json({ success: false, msg: "No orders found" });
  }

  return res.status(200).json({
    msg: "Orders fetched successfully",
    orders,
    currentPage: page,
    totalPages: Math.ceil(totalOrders / limit),
  });
});
export const getBuyBackSummary = asyncHandler(async (req, res) => {
  const retailerId = req.user._id || req.user.id;

  const summaryData = await BuyBackRequest.aggregate([
    { $match: { retailerId: new mongoose.Types.ObjectId(retailerId) } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Format response
  let summary = {
    totalRequests: 0,
    pendingCount: 0,
    acceptedCount: 0,
    completedCount: 0,
  };

  summaryData.forEach((item) => {
    summary.totalRequests += item.count;
    if (item._id === "Pending") summary.pendingCount = item.count;
    if (item._id === "Accepted") summary.acceptedCount = item.count;
    if (item._id === "Completed") summary.completedCount = item.count;
  });

  return res.status(200).json({
    msg: "Buyback requests fetched successfully",
    summary,
  });
});

export const dashboardStats = asyncHandler(async (req, res) => {
  const retailerId = req.user._id || req.user.id;

  const orderCount = await Order.countDocuments({ retailerId });
  const buyBackCount = await BuyBackRequest.countDocuments({
    retailerId,
    status: "Pending",
  });

  // need to display order count by months
  const orderPipeLine = await Order.aggregate([
    {
      $match: { retailerId: new mongoose.Types.ObjectId(retailerId) },
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        month: "$_id",
        count: 1,
        _id: 0,
      },
    },
    {
      $sort: { month: 1 },
    },
  ]);

  return res.status(200).json({
    msg: "Dashboard Stats fetched",
    orderCount,
    buyBackCount,
    ordersByMonth: orderPipeLine,
  });
});

export const businessSummaryOfRetailer = asyncHandler(async (req, res) => {
  const { retailerId } = req.params;

  const orederSales = await Order.aggregate([
    { $match: { retailerId: new mongoose.Types.ObjectId(retailerId) } },
    {
      $unwind: "$items",
    },
    {
      $group: {
        _id: null,
        totalSales: {
          $sum: { $multiply: ["$items.itemTotal", "$items.quantity"] },
        },
        totalOrders: { $sum: 1 },
      },
    },
  ]);
  const totalSales = orederSales[0]?.totalSales || 0;

  const totalStock = await RetailerStock.aggregate([
    { $match: { retailerId: new mongoose.Types.ObjectId(retailerId) } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    {
      $unwind: "$productDetails",
    },
    {
      $group: {
        _id: null,
        totalStockValue: {
          $sum: { $multiply: ["$quantity", "$productDetails.price"] },
        },
        totalItems: { $sum: "$quantity" },
      },
    },
  ]);
  const totalStockValue = totalStock[0]?.totalStockValue || 0;
  const totalItems = totalStock[0]?.totalItems || 0;

  return res.status(200).json({
    msg: "Business Summary fetched",
    totalSales,
    totalStockValue,
    totalItems,
    totalOrders: orederSales[0]?.totalOrders || 0,
  });
});

/**
  Retailse Login APIs =


  getAllStockList()                     Retailer Stock List                         DONE


 */
