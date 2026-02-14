import { Router } from "express"
import { getCustomers, salesData } from "../controllers/dashboard.controller.js"
import { protectAdmin } from "../middlewares/authMiddleware.js"

const router = Router()


router.get("/sales", protectAdmin, salesData)

router.get("/customers", protectAdmin, getCustomers)

export default router