import { Router } from "express"
import {
	addEmailSub,
	removeEmailSub,
	getAllSubEmailList,
	deleteEmailSub,
	downloadActiveEmailsCSV,
} from "../controllers/emailSub.controller.js"
import { upload, customUpload } from "../middlewares/multer.middleware.js"
import { protect, protectAdmin } from '../middlewares/authMiddleware.js';


const router = Router();


router.post("/add_email_sub", upload.none(), addEmailSub);

router.delete("/remove_email_sub", upload.none(), removeEmailSub);

router.get("/get_emails_list", protectAdmin, getAllSubEmailList);

router.delete("/delete_email_sub", protectAdmin, deleteEmailSub);

router.get("/download_sub_emails_csv", protectAdmin, downloadActiveEmailsCSV);




export default router;