import { Router } from "express";
import {
	addItemInCart,
	removeItemFromCart,
	getAllCartList,
} from "../controllers/cart.controller.js";
import { protect, checkUserLoggedIn, protectAdmin } from "../middlewares/authMiddleware.js";
import { customUpload, upload } from '../middlewares/multer.middleware.js';
import { body, validationResult } from "express-validator";



const router = Router();

router.post("/add_item_in_cart",
	upload.none(),
	[
		body("itemId").isString().notEmpty().withMessage("Please Enter itemId"),
		body("quantity").isInt().optional().withMessage("Please Enter quantity"),
		body("customization").notEmpty().withMessage("Please Enter customization"),
	],
	(req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ error: errors.array() });
	}
	next();
	},
	protect,
	addItemInCart
);

router.delete("/remove_item_from_cart", protect, removeItemFromCart);

router.get("/get_all_cart_list", protect, getAllCartList);

export default router;
