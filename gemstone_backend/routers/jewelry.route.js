import { Router } from "express";

const router = Router();

import { body, validationResult } from "express-validator";
import { upload, customUploadFields, customUpload } from "../middlewares/multer.middleware.js";
import { protect, checkUserLoggedIn, protectAdmin } from "../middlewares/authMiddleware.js";
import {
  createJewelry,
  deleteImage,
  deleteJewelry,
  deleteVideo,
  editImage,
  editVideo,
  getAllJweleries,
  getAllJweleriesOfGemstoneType,
  getSingleJewelry,
  jewelryByFilter,
  filterProducts,
  updateJewelry,
} from "../controllers/jewelry.controller.js";

import  uploadPath  from '../utils/uploadPaths.js';
const jewelryUpload = uploadPath.jewelryUpload;

const jewelryValidators = [
  body("sku").notEmpty().withMessage("sku  is required"),
  body("jewelryType").notEmpty().withMessage("Jewelry type is required"),
  body("jewelryName").notEmpty().withMessage("Jewelry name is required"),
  body("jewelryDesc").notEmpty().withMessage("jewelryDesc is required"),
  body("metal").notEmpty().withMessage("metal is required"),
  body("stock").notEmpty().withMessage("stock is required").isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),
  body("jewelryPrice").notEmpty().withMessage("jewelryPrice is required").isInt({ min: 0 }).withMessage("jewelryPrice must be a non-negative integer"),
  body("jewelryMetalWeight").notEmpty().withMessage("jewelryMetalWeight  is required").isInt({ min: 0 }).withMessage("jewelryMetalWeight must be a non-negative integer"),
  body("isDiamondSubstitute").notEmpty().withMessage("isDiamondSubstitute  is required").isBoolean().withMessage("isDiamondSubstitute must be a boolean"),
  body("isAvailable").optional().isBoolean().withMessage("isAvailable must be a boolean"),
  body("isFeatured").optional().isBoolean().withMessage("isFeatured must be a boolean"),

  // validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const jewelryUpdateValidators = [
  body("sku").optional(),
  body("jewelryType").optional(),
  body("jewelryName").optional(),
  body("jewelryDesc").optional(),
  body("metal").optional(),
  body("stock").optional().isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),
  body("jewelryPrice").optional().isInt({ min: 0 }).withMessage("jewelryPrice must be a non-negative integer"),
  body("jewelryMetalWeight").optional().isInt({ min: 0 }).withMessage("jewelryMetalWeight must be a non-negative integer"),
  body("isDiamondSubstitute").optional().isBoolean().withMessage("isDiamondSubstitute must be a boolean"),
  body("isAvailable").optional().isBoolean().withMessage("isAvailable must be a boolean"),
  body("isFeatured").optional().isBoolean().withMessage("isFeatured must be a boolean"),

  // validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

router.post(
  "/create-jewelry/:productSubCategoryId/:jewelrysubcategoryId",
  // upload.fields([
  //   { name: "images", maxCount: 10 },
  //   { name: "videos", maxCount: 5 },
  // ]),
  customUploadFields({
    fields: [
      { name: "images", maxCount: 10 },
      { name: "videos", maxCount: 5 },
    ],
    uploadDir: jewelryUpload, // e.g., '../public/uploads/jewelry'
    fileNamePrefix: "jewelry-asset"
  }),
  jewelryValidators,
  protectAdmin,
  createJewelry
);

router.put(
  "/edit-image/:jewelryId/:imageId",
  customUpload({
    fieldName: "images",
    uploadDir: jewelryUpload,
    fileNamePrefix: "jewelry-asset"
  }),
  protectAdmin,
  editImage
);
router.delete("/delete-image/:jewelryId/:imageId", protectAdmin, deleteImage);

router.put(
  "/edit-video/:jewelryId/:videoId",
  customUpload({
    fieldName: "videos",
    uploadDir: jewelryUpload,
    fileNamePrefix: "jewelry-asset"
  }),
  protectAdmin,
  editVideo
);
router.delete("/delete-video/:jewelryId/:videoId", protectAdmin, deleteVideo);


router.get("/get-all-jewelry", getAllJweleries);

router.get("/get_all_jewelry_of_gemstone_type", checkUserLoggedIn, getAllJweleriesOfGemstoneType); // only for to get jewelery of certain gemstone type

router.get("/single-jewelry/:slug", getSingleJewelry);

router.delete("/delete-jewelry/:jewelryId", protectAdmin, deleteJewelry);

router.put(
  "/update-jewelry/:jewelryId",
  customUploadFields({
    fields: [
      { name: "images", maxCount: 10 },
      { name: "videos", maxCount: 5 },
    ],
    uploadDir: jewelryUpload,
    fileNamePrefix: "jewelry-asset"
  }),
  jewelryUpdateValidators,
  protectAdmin,
  updateJewelry
);

router.get("/jewelry-by-filter", jewelryByFilter);

router.get("/jewelry-by-filter2", filterProducts);



export default router;
