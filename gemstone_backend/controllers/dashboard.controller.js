import { Order } from "../models/order.model.js";
import asyncHandler from "../utils/asyncHandler.js";

export const salesData = asyncHandler(async (req, res) => {
  const sales = await Order.aggregate([
    {
      $match: {
        paymentMethod: "razorpay",
        paymentStatus: { $ne: "Pending" }, // exclude pending
      },
    },
    {
      $group: {
        _id: {
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
          // day: { $dayOfMonth: "$createdAt"} for days
        },
        totalSales: { $sum: { $toDouble: "$totalAmount" } },
        orderCount: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
  ]);
  res.status(200).json({
    msg: "Sales by month & year",
    sales,
  });
});

export const getCustomers = asyncHandler(async (req, res) => {
  /// new customers and repeat customer count
  const customers = await Order.aggregate([
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        newCustomers: {
          $sum: { $cond: [{ $eq: ["$orderCount", 1] }, 1, 0] },
        },
        repeatCustomers: {
          $sum: { $cond: [{ $gt: ["$orderCount", 1] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        newCustomers: 1,
        repeatCustomers: 1,
      },
    },
  ]);

  return res.status(200).json({
    msg: "Customers with repeat and new ones",
    data: customers[0],
  });
});
