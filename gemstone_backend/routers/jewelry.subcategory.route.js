import { Router } from "express"
import {
	createJewelrySubcategory,
	deleteJewelrySubCategory,
	getAllJewelrySubcategories,
	getSingleJewelrySubcategory,
	updateJewelrySubCategory,
	getAllJewelryTypes,
} from "../controllers/jewelry.subcategory.controller.js"
import { upload } from "../middlewares/multer.middleware.js"
import { protectAdmin } from "../middlewares/authMiddleware.js"

const router = Router()


router.post("/create-jewelry-subcategory/:jewelryCategoryId", upload.single("subCategoryImg"), protectAdmin, createJewelrySubcategory)

router.get("/single-jewelry-subcategory/:slug", getSingleJewelrySubcategory)

router.get("/get-jewelry-subcategories", getAllJewelrySubcategories)

router.get("/get_all_jewelry_type_list", getAllJewelryTypes);	// API for the all jewelry types which is actually JewelerySubcategory

router.put("/update-jewelry-subcategory/:jewelrysubCategoryId", upload.single("subCategoryImg"), protectAdmin, updateJewelrySubCategory)

router.delete("/delete-jewelry-subcategory/:jewelrysubCategoryId", protectAdmin, deleteJewelrySubCategory)


export default router