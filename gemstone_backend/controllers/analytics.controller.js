import { Order } from "../models/order.model.js";
import { SubCategory } from "../models/subcategory.model.js";
import asyncHandler from "../utils/asyncHandler.js";

export const revenueByMonthsAndYear = asyncHandler(async (req, res) => {
  const pipeLine = await Order.aggregate([
    { $unwind: "$items" },
    {
      $project: {
        _id: null,
        month: { $month: "$createdAt" },
        year: { $year: "$createdAt" },
        totalAmount: { $toDouble: "$items.itemTotal" },
      },
    },
    {
      $group: {
        _id: { month: "$month", year: "$year" },
        revenue: { $sum: "$totalAmount" },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
  ]);

  const currentYear = new Date().getFullYear();
  const normalized = Array.from({ length: 12 }, (_, i) => {
    const found = pipeLine.find(
      (s) => s._id.month === i + 1 && s._id.year === currentYear
    );
    return {
      _id: { month: i + 1, year: currentYear },
      revenue: found?.revenue || 0,
    };
  });

  return res.status(200).json({
    msg: "Revenue by months and year fetched successfully",
    revenue: normalized,
  });
});

export const ordersCountByMonthAndYear = asyncHandler(async (req, res) => {
  const pipeLine = await Order.aggregate([
    {
      $group: {
        _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
        totalOrders: {
          $sum: 1,
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  res.status(200).json({
    msg: "Orders by month and year",
    ordersCount: pipeLine,
  });
});

export const customerStats = asyncHandler(async (req, res) => {
  const pipeLine = await Order.aggregate([
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        repeatedCustomers: {
          $sum: {
            $cond: [{ $gt: ["$orderCount", 1] }, 1, 0],
          },
        },
        newCustomers: {
          $sum: {
            $cond: [{ $eq: ["$orderCount", 1] }, 1, 0],
          },
        },
      },
    },
  ]);

  const result = pipeLine[0] || { repeatedCustomers: 0, newCustomers: 0 };

  return res.status(200).json({
    msg: "Customer statistics",
    repeatedCustomers: result.repeatedCustomers,
    newCustomers: result.newCustomers,
  });
});

export const inventory = asyncHandler(async (req, res) => {
  const subcategories = await SubCategory.find().populate("products").exec();

  const result = subcategories.map((sub) => {
    const productsList = sub.products;

    const outOfStock = productsList.filter((prod) => prod.stock === 0).length;
    const inStock = productsList.filter((prod) => prod.stock > 0).length;

    const totalAmount = productsList
      .filter((prod) => prod.stock > 0)
      .reduce((sum, product) => sum + product.price, 0);

    return {
      subCategoryName: sub.name,
      inStock,
      outOfStock,
      totalAmount,
    };
  });

  return res.status(200).json({
    msg: "Inventory result",
    result,
  });
});

export const getOrderStats = asyncHandler(async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalRevenue: { $sum: { $toDouble: "$totalAmount" } },
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "Completed"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const paymentStats = await Order.aggregate([
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          revenue: { $sum: { $toDouble: "$totalAmount" } },
        },
      },
    ]);

    res.json({ stats, paymentStats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
