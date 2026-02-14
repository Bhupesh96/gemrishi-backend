import Router from "express";

import {
	addToWishlist,
	getAllWishlist,
	removeFromWishlist,
} from "../controllers/wishlist.controller.js";
import { protect } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();


router.post("/add_to_wishlist", protect, upload.none(), addToWishlist);

router.get("/get_all_wishlist", protect, getAllWishlist);

router.delete("/remove_from_wishlist", protect, removeFromWishlist);

export default router;

