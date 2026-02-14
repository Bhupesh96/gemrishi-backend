import { Router } from 'express';
import {
	registerAdmin,
	loginAdmin,
	logoutAdmin,
	getAdminProfile,
	updateAdminProfile,
	changePassword,
	sendOtpToAdmin,
	forgotPasswordAdmin,
	// changeSuperAdminPassword,
	// forgotSuperAdminPassword,
	// resetSuperAdminPassword,
} from '../controllers/admin.controller.js';

import { protectAdmin } from '../middlewares/authMiddleware.js';
import { customUpload, upload } from '../middlewares/multer.middleware.js';
import  uploadPath  from '../utils/uploadPaths.js';

const adminUpload = uploadPath.adminUpload;

const router = Router();

// AUTHENTICATION ROUTES
// Register Super Admin (only once or with validation)
router.route('/change_admin_password').put(protectAdmin, changePassword);
router.route('/admin_register').post(upload.none(), registerAdmin);
router.post("/send-otp", sendOtpToAdmin)
router.post("/reset-password", forgotPasswordAdmin)


// Login & Logout
router.route('/admin_login').post(upload.none(), loginAdmin);
router.route('/admin_logout').post(protectAdmin, logoutAdmin);
// PROFILE ROUTES
// Get & Update Profile
router.route('/get_admin_profile').get(protectAdmin, getAdminProfile);
// router.route('/update_admin_profile').put(upload.single("adminAvatar"), protectAdmin, updateAdminProfile);
router.route('/update_admin_profile').put(
	customUpload({
		fieldName: "adminAvatar",
		uploadDir: adminUpload,
		fileNamePrefix: "adminAvatar",
	}),
	protectAdmin,
	updateAdminProfile
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
