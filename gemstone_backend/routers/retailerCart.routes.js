import { Router } from "express";
import {
	addItemInCart,
	removeItemFromCart,
	getAllCartList,
} from "../controllers/retailerCart.controller.js";
import { protect, checkUserLoggedIn, protectAdmin, protectRetailer } from "../middlewares/authMiddleware.js";
import { customUpload, upload } from '../middlewares/multer.middleware.js';


const router = Router();


router.post("/add_item_in_cart", upload.none(), protectRetailer, addItemInCart);
router.delete("/remove_item_from_cart/:itemId", protectRetailer, removeItemFromCart);
router.get("/get_all_cart_list", protectRetailer, getAllCartList);

export default router;
