import { Router } from "express";
import {
  addItemInCart,
  removeItemFromCart,
  getAllCartList,
} from "../controllers/cart.controller.js";
// Make sure checkUserLoggedIn is imported
import {
  protect,
  checkUserLoggedIn,
  protectAdmin,
} from "../middlewares/authMiddleware.js";
import { customUpload, upload } from "../middlewares/multer.middleware.js";
import { body, validationResult } from "express-validator";

const router = Router();

// CHANGED: used checkUserLoggedIn instead of protect to allow Guest Add to Cart
router.post(
  "/add_item_in_cart",
  upload.none(),
  [
    body("itemId").isString().notEmpty().withMessage("Please Enter itemId"),
    body("quantity").isInt().optional().withMessage("Please Enter quantity"),
    // body("customization").notEmpty().withMessage("Please Enter customization"), // Optional: typically customization might be optional
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    next();
  },
  checkUserLoggedIn, // <--- Changed from protect
  addItemInCart,
);

// CHANGED: used checkUserLoggedIn to allow Guest Remove Item
router.delete("/remove_item_from_cart", checkUserLoggedIn, removeItemFromCart);

// CHANGED: used checkUserLoggedIn to allow Guest View Cart
router.get("/get_all_cart_list", checkUserLoggedIn, getAllCartList);

export default router;
