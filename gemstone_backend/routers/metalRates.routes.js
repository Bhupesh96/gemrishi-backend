import express from "express";
import {
	addMetalRates,
	getTodayMetalRates,
	getMetalRatesHistory,
	getLatestRates,
	getRateById,
	updateMetalRates,
	deleteMetalRate,
} from "../controllers/metalRates.controller.js";

import { protectAdmin } from '../middlewares/authMiddleware.js';
import { customUpload, upload } from '../middlewares/multer.middleware.js';



const router = express.Router();


router.post("/add_metal_rates", upload.none(), protectAdmin, addMetalRates);		// Admin: create one or many rates (body = object or array)

router.get("/metal_rates_today", getTodayMetalRates);	// Get today's rates

router.get("/metal_rates_history", getMetalRatesHistory);		// Get history with optional filters

router.get("/get_latest_metal_rate", getLatestRates);	// Get latest rates (latest effectiveDate per metal+variant)

router.get("/get_metal_rate", getRateById);	// Get single rate by id

router.put("/updateMetalRates", upload.none(), protectAdmin, updateMetalRates);	// Admin: update one or many rates

router.delete("/deleteMetalRate", protectAdmin, deleteMetalRate);	// Admin: delete metal rate


export default router;