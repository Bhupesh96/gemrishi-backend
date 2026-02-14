import { Router } from 'express';
import {
	registerSuperAdmin,
	loginSuperAdmin,
	logoutSuperAdmin,
	getSuperAdminProfile,
	updateSuperAdminProfile,
	// changeSuperAdminPassword,
	// forgotSuperAdminPassword,
	// resetSuperAdminPassword,
} from '../controllers/superAdmin.controller.js';

import { protectSuperAdmin } from '../middlewares/authMiddleware.js';
import { customUpload, upload } from '../middlewares/multer.middleware.js';
import  uploadPath  from '../utils/uploadPaths.js';

// const superAdminUpload = "../public/uploads/superAdmin/";
const superAdminUpload = uploadPath.superAdminUpload;

const router = Router();

// AUTHENTICATION ROUTES
// Register Super Admin (only once or with validation)
router.route('/superadmin_register').post(upload.none(), registerSuperAdmin);

// Login & Logout
router.route('/superadmin_login').post(upload.none(), loginSuperAdmin);
router.route('/superadmin_logout').get(protectSuperAdmin, logoutSuperAdmin);

// PROFILE ROUTES
// Get & Update Profile
router.route('/get_superadmin_profile').get(protectSuperAdmin, getSuperAdminProfile);
// router.route('/update_superadmin_profile').put(upload.single("superAdminAvatar"), protectSuperAdmin, updateSuperAdminProfile);
router.route('/update_superadmin_profile').put(
	customUpload({
		fieldName: "superAdminAvatar",
		uploadDir: superAdminUpload,
		fileNamePrefix: "superAdminAvatar",
	}),
	protectSuperAdmin,
	updateSuperAdminProfile
);




/**
// PASSWORD ROUTES
// Change password (after login)
router.route('/change-password').put(upload.none(), protectSuperAdmin, changeSuperAdminPassword);

// Forgot / Reset password flow
router.route('/forgot-password').post(upload.none(), forgotSuperAdminPassword);
router.route('/reset-password/:token').put(upload.none(), resetSuperAdminPassword);

*/

export default router;
