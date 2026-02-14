import { Router } from "express"
import {
	addReviewRating,
	getAllReviewRating,
	getAllBestSeller,
	getAllReviews,

} from "../controllers/reviewRating.controller.js"
import { upload, customUpload } from "../middlewares/multer.middleware.js"
import { protect, protectAdmin } from '../middlewares/authMiddleware.js';


import  uploadPath  from '../utils/uploadPaths.js';

const reviewImageUpload = uploadPath.reviewImageUpload;


const router = Router();


router.post("/add_review_rating",
	customUpload({
		fieldName: "image",
		uploadDir: reviewImageUpload,
		fileNamePrefix: "reviewImage",
	}),
	protect,
	addReviewRating
);

router.get("/get_all_review_rating", getAllReviewRating);


router.get("/get-all-reviews", protectAdmin, getAllReviews);


router.get("/get_all_best_seller", getAllBestSeller);





export default router;