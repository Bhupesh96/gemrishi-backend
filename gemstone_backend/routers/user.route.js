import Router from "express";

import {
  register,
  getAllUsers,
  sendOtp,
  verifyOtp,
  forgotPassword,
  getProfile,
  updateUser,
  deleteUser,
  login,
  logoutUser,

  addDeliveryAddress,
  getDeliveryAddress,
  getDeliveryAddressList,
  updateDeliveryAddress,
  deleteDeliveryAddress,

} from "../controllers/user.controller.js";
import { protect } from "../middlewares/authMiddleware.js";
import { upload, customUpload } from "../middlewares/multer.middleware.js";
import { body, validationResult } from "express-validator";
import uploadPath from "../utils/uploadPaths.js"; // <-- Import the uploadPath object for file uploads

const userUploadPath = uploadPath.userUpload;

const router = Router();

router.post(
  "/login",
  upload.none(),
  [
    body("email").isEmail().withMessage("Please Enter Email").normalizeEmail(),
    body("password").notEmpty().withMessage("Please Enter Password"),//password validation
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    next();
  },
  login
);

router.post(
  "/register",
  customUpload({
      fieldName: "profilePic",
      uploadDir: userUploadPath,
      fileNamePrefix: "profilePic",
    }),
  [
    body("email").isEmail().withMessage("Please Enter Email").normalizeEmail(),
    body("password").notEmpty().withMessage("Please Enter Password"),
    body("fullName").notEmpty().withMessage("Please Enter Name"),
    body("mobileNo").notEmpty().withMessage("Please Enter Mobile"),
    body("address").notEmpty().withMessage("Please Enter Address"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    next();
  },
  register
);

router.get("/all",protect, getAllUsers);

router.put(
  "/update-user/:userId",
  protect,
  customUpload({
		fieldName: "profilePic",
		uploadDir: userUploadPath,
		fileNamePrefix: "profilePic",
	}),
  [
    body("email")
      .optional()
      .isEmail()
      .withMessage("Valid email is required")
      .normalizeEmail(),

    body("fullName")
      .optional()
      .isString()
      .withMessage("Full name must be a string"),

    body("mobileNo")
      .optional()
      .isMobilePhone()
      .withMessage("Valid mobile number is required"),

    body("address")
      .optional()
      .isString()
      .withMessage("Address must be a string"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    next();
  },
  updateUser
);

router.delete("/delete-user/:userId", deleteUser);

router.post("/send-otp", upload.none(), sendOtp);

router.post("/verify_otp", upload.none(), verifyOtp);
router.post("/reset-password", upload.none(), forgotPassword);


router.get("/profile", protect, getProfile);

router.get("/logout", logoutUser);




router.post(
  "/add_delivery_address",
  protect,
  upload.none(),
  [
    body("addressType").notEmpty().withMessage("Please Enter Address Type"),
    body("fullName").notEmpty().withMessage("Please Enter Full Name"),
    body("email").notEmpty().withMessage("Please Enter Email for the address")
      .isEmail().withMessage("Please Enter a valid Email for the address"),
    body("mobileNo").notEmpty().withMessage("Please Enter Mobile Number for the address")
      .isMobilePhone('any', { strictMode: false }).withMessage("Please Enter a valid Mobile Number for the address"),
    body("addressLine1").notEmpty().withMessage("Please Enter Address Line 1"),
    body("city").notEmpty().withMessage("Please Enter City"),
    body("pinCode").notEmpty().withMessage("Please Enter Pin Code"),
    body("state").notEmpty().withMessage("Please Enter State"),
    body("country").notEmpty().withMessage("Please Enter Country"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    next();
  },
  addDeliveryAddress
);

router.put(
  "/update_delivery_address",
  protect,
  upload.none(),
  [
    body("addressId").notEmpty().withMessage("Address ID is required"),
    body("addressType").optional().notEmpty().withMessage("Address Type cannot be empty"),
    body("fullName").optional().notEmpty().withMessage("Please Enter Full Name"),
    body("email").optional().isEmail().withMessage("Please Enter a valid Email"),
    body("mobileNo").optional().isMobilePhone('any', { strictMode: false }).withMessage("Please Enter a valid Mobile Number"),
    body("addressLine1").optional().notEmpty().withMessage("Address Line 1 cannot be empty"),
    body("city").optional().notEmpty().withMessage("City cannot be empty"),
    body("pinCode").optional().notEmpty().withMessage("Pin Code cannot be empty"),
    body("state").optional().notEmpty().withMessage("State cannot be empty"),
    body("country").optional().notEmpty().withMessage("Country cannot be empty"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    next();
  },
  updateDeliveryAddress
);

router.get("/get_delivery_address", protect, getDeliveryAddress);

router.get("/get_delivery_address_list", protect, getDeliveryAddressList);

router.delete("/delete_delivery_address", protect, deleteDeliveryAddress);







export default router;
