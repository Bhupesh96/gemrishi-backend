import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";

// Handle __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Factory function to create multer middleware with custom path and filename prefix
export function customUpload({ fieldName, uploadDir, fileNamePrefix }) {
  // Ensure upload directory exists
  const uploadPath = path.isAbsolute(uploadDir)
    ? uploadDir
    : path.join(__dirname, uploadDir);
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
      cb(null, `${fileNamePrefix || file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });

  // File filter to allow only images
  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|avif|mp4|mov|webm|webp|quicktime/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error("Only jpeg, jpg, png, avif,mp4,mov,webm,webp image types are allowed."));
    }
  };

  return multer({ storage, fileFilter, limits: { fileSize: 500 * 1024 * 1024 } }).single(fieldName);
}

// Factory function to create multer middleware for multiple fields with custom path and filename prefix
export function customUploadFields({ fields, uploadDir, fileNamePrefix }) {
  // Ensure upload directory exists
  const uploadPath = path.isAbsolute(uploadDir)
    ? uploadDir
    : path.join(__dirname, uploadDir);
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
      cb(null, `${fileNamePrefix || file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });

  // File filter to allow only images and videos
  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|avif|mp4|mov|webm|webp|quicktime/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) cb(null, true);
    else cb(new Error("Only jpeg, jpg, png, avif, mp4, mov, webm, webp types are allowed."));
  };

  return multer({ storage, fileFilter, limits: { fileSize: 500 * 1024 * 1024 }  }).fields(fields);
}

// Default upload for backward compatibility
const defaultUploadPath = path.join(__dirname, "../public/uploads/");
if (!fs.existsSync(defaultUploadPath)) {
  fs.mkdirSync(defaultUploadPath, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, defaultUploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|avif|mp4|mov|webm|webp|quicktime/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only jpeg, jpg, png, avif,mp4,mov,webm,webp image types are allowed."));

  }
};
export const upload = multer({ storage, fileFilter, limits: { fileSize: 500 * 1024 * 1024 } }); // 10MB limit
