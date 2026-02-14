import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";

// Handle __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure upload directory exists
const uploadPath = path.join(__dirname, "../public/uploads/");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Define storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only jpeg, jpg, and png image types are allowed."));
  }
};

// Final upload export
export const upload = multer({ storage, fileFilter });





// not relevant for now


// // File filter to allow only images for complaints

// // Ensure upload directory exists
// const complaintsAttachmentUploadPath = path.join(__dirname, "../public/complaints_attachment/");
// if (!fs.existsSync(complaintsAttachmentUploadPath)) {
//   fs.mkdirSync(complaintsAttachmentUploadPath, { recursive: true });
// }

// // Define storage
// const ComplaintsAttachementStorage =  multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, complaintsAttachmentUploadPath);
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     const ext = path.extname(file.originalname);
//     cb(null, `complaintAttachment-${uniqueSuffix}${ext}`);
//   },
// });

// // File filter to allow only images
// const ComplaintsAttachementFileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|pdf|mp4/;
//   const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//   const mimetype = allowedTypes.test(file.mimetype);

//   if (mimetype && extname) {
//     cb(null, true);
//   } else {
//     cb(new Error("Only images are allowed (jpeg, jpg, png, pdf, mp4)"));
//   }
// };

// export const complaintsAttachmentUpload = multer({ ComplaintsAttachementStorage, ComplaintsAttachementFileFilter });

