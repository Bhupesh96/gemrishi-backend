import { Router } from 'express';
import {
	createBanner,
	updateBanner,
	deleteBanner,
	getAllBannerAdmin,
	getAllBanner,
} from '../controllers/banner.controller.js';

import { protectAdmin } from '../middlewares/authMiddleware.js';
import { customUpload, upload } from '../middlewares/multer.middleware.js';
import  uploadPath  from '../utils/uploadPaths.js';

const bannerUpload = uploadPath.bannerUpload;


const router = Router();


// app apis - harsh
// Banner API
router.route('/create_banner').post(
	customUpload({
		fieldName: "image",
		uploadDir: bannerUpload,
		fileNamePrefix: "banner",
	}),
	protectAdmin,
	createBanner
);

router.route('/get_all_banner_admin').get(protectAdmin, getAllBannerAdmin);

router.route('/delete_banner').delete(protectAdmin, deleteBanner);


router.route('/update_banner').put(
	customUpload({
		fieldName: "image",
		uploadDir: bannerUpload,
		fileNamePrefix: "banner",
	}),
	protectAdmin,
	updateBanner
);

router.route('/get_all_banner').get(getAllBanner);



export default router;
