import Router from "express";
import {
  login,
  register,
  getProfile,
  updateRetailer,
  sendOtp,
  resetPassword,
  deactivateRetailerByReatailer,
  getAllRetailers,
  blockUnblockRetailerByAdmin,
  deleteRetailer,
  getRetailerById,
  logoutRetailer,
  changeRetailerPassword,
} from "../controllers/retailer.controller.js";

import {
  businessSummaryOfRetailer,
  dashboardStats,
  getAllOrdersByRetailer,
  getAllStockList,
  getBuyBackSummary,
  getRetailerStockBySubCategory,
} from "../controllers/retailer.panel.controller.js";

import { customUpload, upload } from "../middlewares/multer.middleware.js";
import {
  protectAdmin,
  protectRetailer,
} from "../middlewares/authMiddleware.js";
import { body, validationResult } from "express-validator";
import uploadPath from "../utils/uploadPaths.js";

const adminUpload = uploadPath.adminUpload;
const router = Router();

// Register Retailer
router.post(
  "/register",
  upload.single("profilePic"),
  [
    body("email").isEmail().withMessage("Email is needed").normalizeEmail(),
    body("password").notEmpty().withMessage("password needed"),
    body("fullName").notEmpty().withMessage("name is required"),
    body("mobileNo").notEmpty().withMessage("mobile no is required"),
    body("address").notEmpty().withMessage("address is required"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    next();
  },
  protectAdmin,
  register
);

router.post("/login", upload.none(), login);

router.post("/logout", logoutRetailer);

router.get("/profile", protectRetailer, getProfile);

router.put(
  "/update-retailer/:retailerId",
  customUpload({
    fieldName: "retailerAvatar",
    uploadDir: adminUpload,
    fileNamePrefix: "adminAvatar",
  }),
  protectRetailer,
  updateRetailer
);

router.post("/send-otp", sendOtp);

router.post("/reset-password", resetPassword);

router.delete(
  "/deactivate_retailer_by_retailer",
  upload.none(),
  protectRetailer,
  deactivateRetailerByReatailer
);

router.get("/get-single-retailer/:retailerId", getRetailerById);

// admin operations only
router.get("/get_all_retailers_list", protectAdmin, getAllRetailers); // Admin Only

router.put(
  "/block_unblock_retailer_by_admin",
  upload.none(),
  protectAdmin,
  blockUnblockRetailerByAdmin
); // Admin Only

router.delete("/delete_retailer", protectAdmin, deleteRetailer); // Admin Only

// Retailer Operations

// router.post("/add_item_in_cart", upload.none(), protectRetailer, addItemInCart);
// router.delete("/remove_item_from_cart", protectRetailer, removeItemFromCart);
// router.get("/get_all_cart_list", protectRetailer, getAllCartList);

router.get("/get_all_stock_list", protectRetailer, getAllStockList);

router.get("/dashboard-stats", protectRetailer, dashboardStats);

router.get("/get-retailer-stock/:retailerId", getRetailerStockBySubCategory);

router.get(
  "/get-all-orders-by-retailer",
  protectRetailer,
  getAllOrdersByRetailer
);

router.get("/get-business-summary/:retailerId", businessSummaryOfRetailer);

router.get("/buy-back-summary", protectRetailer, getBuyBackSummary);

router.put("/change-retailer-password", protectRetailer, changeRetailerPassword)

export default router;
