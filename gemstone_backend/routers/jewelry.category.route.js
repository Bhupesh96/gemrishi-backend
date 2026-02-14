import { Router } from "express"
import { createJewelryCategory, deleteJewelryCategory, getAllJewelryCategories, getSingleJewelryCategory, updateJewelryCategory } from "../controllers/jewelry.category.controller.js";
import { protectAdmin } from "../middlewares/authMiddleware.js";

const router = Router();


router.get("/single-jewelry-category/:slug", getSingleJewelryCategory)

router.post("/create-jewelry-category", protectAdmin, createJewelryCategory)

router.get("/get-jewelry-categories", getAllJewelryCategories)

router.put("/update-jewelry-category/:jewelryCategoryId", protectAdmin, updateJewelryCategory)

router.delete("/delete-jewelry-category/:jewelryCategoryId", protectAdmin, deleteJewelryCategory)


export default router

