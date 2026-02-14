import express from "express";
import {
  createRefundRequest,
  approveRefundRequest,
  rejectRefundRequest,
  processApprovedRefund,
  getRefundRequestsForOrder,
  getRefundRequestById,
} from "../controllers/refund.controller.js";
import { protect, protectAdmin } from "../middlewares/authMiddleware.js";
const router = express.Router();

// USER
router.post("/:orderId/requests", protect, createRefundRequest);
router.get("/order/:orderId", protect, getRefundRequestsForOrder);
router.get("/request/:refundRequestId", protect, getRefundRequestById);

// ADMIN
router.post("/admin/:refundRequestId/approve", approveRefundRequest);
router.post("/admin/:refundRequestId/reject", rejectRefundRequest);
router.post("/admin/:refundRequestId/process", processApprovedRefund);

export default router;
