import { Router } from "express";
import {
  createProductOrder,
  createProductOrder2,
  createProductOrder3,
  getAllOrders,
  getAllOrders2,
  getAllOrderUsers,
  getBestSellers,
  getOrdersByUser,
  getSingleOrder,
  orderDashboard,
  orderUsersForCSV,
  updateOrder,
  verifyPayment,
  cancelOrderByUser,
  createProductRetailerOrder2,
  cancelOrderByUser2,
} from "../controllers/order.controller.js";
import { protect, protectAdmin, protectRetailer } from "../middlewares/authMiddleware.js";
import { body, validationResult } from "express-validator";
import { customUpload, upload } from '../middlewares/multer.middleware.js';


const router = Router();

router.post(
  "/create-order2",
  protect,
  [
    body("totalAmount")
      .notEmpty()
      .withMessage("Amount must not be empty")
      .isNumeric()
      .withMessage("Amount must be a number"),

    body("items")
      .isArray({ min: 1 })
      .withMessage("Items must be a non-empty array"),

    body("items.*.quantity")
      .isInt({ min: 1 })
      .withMessage("Each item must have quantity ≥ 1"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors });
    }
    next();
  },
  createProductOrder
);

router.post("/create-order", upload.none(), protect, createProductOrder3);

router.get("/get-all-orders", protectAdmin, getAllOrders);

router.get("/get-all-customers", getAllOrderUsers)

router.get("/get-all-customers-csv", protectAdmin, orderUsersForCSV)

router.get("/dashboard-metrics", protectAdmin, orderDashboard)

router.get("/orders-for-csv", protectAdmin, getAllOrders2)

router.post(
  "/verify-order",
  [
    body("razorpayOrderId").notEmpty().withMessage("order id must be present"),
    body("razorpayPaymentId")
      .notEmpty()
      .withMessage("payment id must be present"),
    body("razorpaySignature")
      .notEmpty()
      .withMessage("signature must be present"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors });
    }
    next();
  },
  verifyPayment
);

router.put("/update-order/:orderId", protectAdmin, updateOrder)

router.get("/get-single-order/:orderId", getSingleOrder)

router.get("/user-orders", protect, getOrdersByUser)

router.get("/best-sellers", getBestSellers)

router.put("/cancel_order", upload.none(), protect, cancelOrderByUser);   // only user can cancel the order

router.post("/create-retailer-order", protectRetailer, createProductRetailerOrder2);

export default router;

