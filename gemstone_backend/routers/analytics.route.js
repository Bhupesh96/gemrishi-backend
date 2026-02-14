import { Router } from "express";
import { customerStats, getOrderStats, inventory, ordersCountByMonthAndYear, revenueByMonthsAndYear } from "../controllers/analytics.controller.js";
import { protectAdmin } from "../middlewares/authMiddleware.js";

const router = Router();


router.get("/revenue", protectAdmin, revenueByMonthsAndYear)

router.get("/ordersCount", protectAdmin, ordersCountByMonthAndYear)

router.get("/customer-stats", protectAdmin, customerStats)

router.get("/inventory", protectAdmin, inventory)

router.get("/order-stats", protectAdmin, getOrderStats)

export default router