import { Router } from "express";
import {
  getSingleSubcategory,
  createSubcategory,
  getAllSubcategories,
  updateSubCategory,
  deleteSubCategory,
  getAllGemstoneCategory,
} from "../controllers/subcategory.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { protectAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.post(
  "/create-subcategory/:categoryId",
  upload.single("subCategoryImg"),
  protectAdmin,
  createSubcategory
);

router.get("/single-subcategory/:slug", getSingleSubcategory);

router.get("/get-subcategories", getAllSubcategories);

router.put(
  "/update-subcategory/:subcategoryId",
  upload.single("subCategoryImg"),
  protectAdmin,
  updateSubCategory
);

router.delete("/delete-subcategory/:subcategoryId", protectAdmin, deleteSubCategory);

// App Api
router.get("/get_gemstone_cat", getAllGemstoneCategory);

export default router;
