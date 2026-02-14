import { Router } from 'express';
import {
	addCountry,
	getAllCountryList,
	getCountryDetails,
	deleteCountry,
	updateCountry,
	// deleteBanner,
	// getAllBannerAdmin,
} from '../controllers/originCountryMap.controller.js';

import { protectAdmin } from '../middlewares/authMiddleware.js';
import { customUpload, upload } from '../middlewares/multer.middleware.js';
import  uploadPath  from '../utils/uploadPaths.js';

const countryMapImageUpload = uploadPath.countryMapImageUpload;


const router = Router();


// app apis - harsh
// Banner API
router.route('/add_country').post(
	customUpload({
		fieldName: "image",
		uploadDir: countryMapImageUpload,
		fileNamePrefix: "map",
	}),
	protectAdmin,
	addCountry
);

// router.route('/get_all_banner_admin').get(protectAdmin, getAllBannerAdmin);

router.route('/delete_country').delete(protectAdmin, deleteCountry);


router.route('/update_country_details').put(
	customUpload({
		fieldName: "image",
		uploadDir: countryMapImageUpload,
		fileNamePrefix: "map",
	}),
	protectAdmin,
	updateCountry
);

router.route('/get_all_country_list').get(protectAdmin, getAllCountryList);

router.route('/get_single_country_details').get(getCountryDetails);







export default router;
