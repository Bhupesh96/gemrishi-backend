import { Router } from "express";

const router = Router();
import uploadPath from "../utils/uploadPaths.js";
import { body, validationResult } from "express-validator";
import { upload } from "../middlewares/multer.middleware.js";
import {
  createProduct,
  deleteImage,
  deleteProduct,
  deleteVideo,
  editImage,
  editVideo,
  filterProducts,
  getAllProducts,
  getFeaturedProducts,
  getSingleProduct,
  updateProduct,
  getOriginCountryForSubCat,
  crossSellingProductList,
  upSellingProductSKU,
} from "../controllers/product.controller.js";
import { protect, checkUserLoggedIn, protectAdmin } from "../middlewares/authMiddleware.js";
import { searchApi, similarJewelries, similarProducts } from "../controllers/jewelry.controller.js";
import { customUpload, customUploadFields } from "../middlewares/multer.middleware.js";
// import { cacheMiddleware } from "../middlewares/cache.middleware.js";

const gemstoneValidators = [
  body("sku").notEmpty().withMessage("SKU is required"),
  body("name").notEmpty().withMessage("Name is required"),
  body("origin").notEmpty().withMessage("Origin is required"),
  body("carat").isNumeric().withMessage("Carat must be a number"),
  body("ratti").optional().isNumeric(),
  body("price").isNumeric().withMessage("Price must be a number"),
  body("certificateTypes").optional(),
  body("weight").optional(),
  body("description").optional().isString(),
  body("treatment").optional().isString(),
  body("shape").optional().isString(),
  body("color").optional().isString(),
  body("cut").optional().isString(),
  body("isAvailable").optional().isBoolean(),
  body("isFeatured").optional().isBoolean(),
  body("stock").optional().isInt({ min: 0 }),
  // middleware to check validation result
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const gemstoneUpdateValidators = [
  body("sku").optional(),
  body("name").optional(),
  body("origin").optional(),
  body("carat").optional().isNumeric().withMessage("Carat must be a number"),
  body("ratti").optional().isNumeric(),
  body("price").optional().isNumeric().withMessage("Price must be a number"),
  body("weight").optional(),
  body("description").optional().isString(),
  body("treatment").optional().isString(),
  body("shape").optional().isString(),
  body("color").optional().isString(),
  body("cut").optional().isString(),
  body("isAvailable").optional().isBoolean(),
  body("isFeatured").optional().isBoolean(),
  body("stock").optional().isInt({ min: 0 }),
  body("upSellingProductSKU").optional(),
  // middleware to check validation result
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

router.get("/search", searchApi);
router.get("/filter", filterProducts);
router.get("/featured-products", getFeaturedProducts)

router.post(
  "/create-gemstone/:subcategoryId",
  customUploadFields({
    fields: [
      { name: "images", maxCount: 10 },
      { name: "videos", maxCount: 5 },
    ],
    uploadDir: uploadPath.productUpload,
    fileNamePrefix: "product-asset",
  }),
  gemstoneValidators,
  createProduct
);

router.get("/get-all-gemstones" , /* cacheMiddleware("gemstones"), */  getAllProducts);

router.get("/single-gemstone/:slug", getSingleProduct);

router.delete("/delete-gemstone/:productId", protectAdmin, deleteProduct);

router.put(
  "/update-gemstone/:productId",
  customUploadFields({
    fields: [
      { name: "images", maxCount: 10 },
      { name: "videos", maxCount: 5 },
    ],
    uploadDir: uploadPath.productUpload,
    fileNamePrefix: "product-asset",
  }),
  gemstoneUpdateValidators,
  protectAdmin,
  updateProduct
);

router.put(
  "/edit-image/:productId/:imageId",
  customUpload({
    fieldName: "images",
    uploadDir: uploadPath.productUpload,
    fileNamePrefix: "product-asset",
  }),
  protectAdmin,
  editImage
);
router.delete("/delete-image/:productId/:imageId", protectAdmin, deleteImage);

router.put(
  "/edit-video/:productId/:videoId",
  customUpload({
    fieldName: "videos",
    uploadDir: uploadPath.productUpload,
    fileNamePrefix: "product-asset",
  }),
  protectAdmin,
  editVideo
);
router.delete("/delete-video/:productId/:videoId", protectAdmin, deleteVideo);

router.get("/similar-products/:productId", similarProducts)

router.get("/similar-jewelleries/:jewelryId", similarJewelries)

router.get("/get-product-origin-countries-list/:slug", getOriginCountryForSubCat);

router.get("/cross-selling-product-list", protect, crossSellingProductList);

router.get("/upselling-product-list/:productId", upSellingProductSKU);


export default router;
