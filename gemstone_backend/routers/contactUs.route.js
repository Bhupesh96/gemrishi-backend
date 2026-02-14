import Router from "express";

import {
  contactUsForm,
  getAllContactUsList,
  contactUsDetails,
  deleteContactUs,

} from "../controllers/contactUs.controller.js";
import { protectAdmin } from "../middlewares/authMiddleware.js";
import { upload, customUpload } from "../middlewares/multer.middleware.js";
// import { body, validationResult } from "express-validator";
// import uploadPath from "../utils/uploadPaths.js"; // <-- Import the uploadPath object for file uploads

// const userUploadPath = uploadPath.userUpload;

const router = Router();

// contact us email sender api
router.post("/contact_us", upload.none(), contactUsForm);


router.get("/get_all_contact_us_list", protectAdmin, getAllContactUsList);

router.get("/get_contact_us_details", protectAdmin, contactUsDetails);

router.delete("/delete_contact_us", protectAdmin, deleteContactUs);






export default router;
