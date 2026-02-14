import express from "express";
import { protectAdmin, protectRetailer } from "../middlewares/authMiddleware.js";
import { createBuyBackRequest, getAllBuyBackRequestsByRetailer, getPendingBuyBackRequestsByRetailer, updateRequest } from "../controllers/buy.back.request.controller.js";

const router = express.Router();

router.post("/create-request", protectAdmin, createBuyBackRequest);

// router.post("/pay-back-request/:requestId", protectAdmin, payForBuyBack)

router.put("/update-request/:requestId", protectRetailer, updateRequest);

router.get("/get-pending-requests", protectRetailer, getPendingBuyBackRequestsByRetailer);

router.get("/get-all-requests", protectRetailer, getAllBuyBackRequestsByRetailer);

export default router;
