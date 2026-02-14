import asyncHandler from "../utils/asyncHandler.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { Banner } from "../models/banner.model.js";

import uploadPath from "../utils/uploadPaths.js"; // <-- Import the uploadPath object for file uploads

const filesUploadPath = process.env.FILES_UPLOAD_PATH;


// Helper to delete uploaded file if it exists
function deleteUploadedFiles(req, fileUploadPath) {
  const uploadPath = fileUploadPath;

  // For single file (e.g., upload.single)
  if (req.file) {
    const filePath = path.join(__dirname, uploadPath, req.file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  // For multiple files (e.g., upload.fields)
  if (req.files) {
    Object.values(req.files).forEach((fileArr) => {
      fileArr.forEach((file) => {
        const filePath = path.join(__dirname, uploadPath, file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    });
  }
}

// Create banner
const createBanner = asyncHandler(async (req, res) => {
  const { name, pramotionId, isActive } = req.body;

  const bannerUploadPath = uploadPath.bannerUpload;
  // if (!name || !pramotionId || !isActive) {
  if (!name || !isActive) {
    deleteUploadedFiles(req, bannerUploadPath); // Clean up uploaded if field is missing
    return res.status(400).json({ message: "All fields are required." });
  }

  const checkBanner = await Banner.findOne({ name: name });

  if (checkBanner) {
    deleteUploadedFiles(req, bannerUploadPath); // Clean up uploaded if field is missing
    return res.status(400).json({ message: "Banner name already exists." });
  }

  if (!req.file) {
    deleteUploadedFiles(req, bannerUploadPath); // Clean up uploaded if field is missing
    return res.status(400).json({ message: "Banner image is required." });
  }

  const imagePath = bannerUploadPath.replace("../", "/");
  const filesUploadPath = process.env.FILES_UPLOAD_PATH;

  const bannerData = await Banner.create({
    name,
    // pramotionId: pramotionId,
    isActive: isActive,
    image: {
      fileName: req.file ? req.file.filename : null,
      url: req.file ? `${imagePath}${req.file.filename}` : null,
    },
  });

  await bannerData.save();

  return res
    .status(200)
    .json({ message: "Banner Created Successfully.", Banner: bannerData });

});

// Update banner
const updateBanner = asyncHandler(async (req, res) => {
  const { bannerId, name, pramotionId, isActive } = req.body;

  const bannerUploadPath = uploadPath.bannerUpload;

  // Check banner exists
  const bannerData = await Banner.findById(bannerId);
  if (!bannerData) {
    deleteUploadedFiles(req, bannerUploadPath);
    return res
      .status(404)
      .json({ success: false, message: "Banner ID does not exist." });
  }

  // Check for duplicate name (exclude current banner)
  const checkBannerName = await Banner.findOne({
    name,
    _id: { $ne: bannerId },
  });
  if (checkBannerName) {
    deleteUploadedFiles(req, bannerUploadPath);
    return res
      .status(400)
      .json({ success: false, message: "Banner name already exists." });
  }

  // Handle file upload
  let bannerFileName;
  let bannerURL;
  if (req.file) {
    // Delete old file if exists
    if (bannerData.image?.fileName) {
      const oldPath = path.join(
        __dirname,
        bannerUploadPath,
        bannerData.image.fileName
      );
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const bannerURLPath = bannerUploadPath.replace("../", "/");
    bannerFileName = req.file.filename;
    bannerURL = `${bannerURLPath}${req.file.filename}`;
  } else {
    // Keep existing if no new file uploaded
    bannerFileName = bannerData.image.fileName;
    bannerURL = bannerData.image.url;
  }

  // Update fields
  bannerData.name = name || bannerData.name;
  bannerData.isActive = isActive ?? bannerData.isActive;
  // bannerData.pramotionId = pramotionId || bannerData.pramotionId;
  bannerData.image.fileName = bannerFileName;
  bannerData.image.url = bannerURL;

  const updatedBanner = await bannerData.save();

  return res.status(200).json({
    success: true,
    message: "Banner updated successfully.",
    banner: updatedBanner,
  });
});

// Delete banner
const deleteBanner = asyncHandler(async (req, res) => {
  const bannerId = req.query.bannerId; // filter

  const bannerData = await Banner.findById(bannerId);

  if (!bannerData) {
    return res
      .status(404)
      .json({ success: false, message: "Banner not found." });
  }

  const bannerUploadPath = uploadPath.bannerUpload;

  const oldPath = path.join(
    __dirname,
    bannerUploadPath,
    bannerData.image.fileName
  );

  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

  const deletedBanner = await Banner.findByIdAndDelete(bannerId);

  return res
    .status(200)
    .json({
      success: true,
      message: "Banner deleted successfully.",
      Banner: deletedBanner,
    });
});

// Get all banner list for admin
const getAllBannerAdmin = asyncHandler(async (req, res) => {
  const isActive = req.query.isActive; // filter

  if (isActive === "true" || isActive === "false") {
    const allBanner = await Banner.find({ isActive: isActive });
    return res.status(200).json(allBanner);
  } else if (isActive === "all" || !isActive) {
    const allBanner = await Banner.find();
    return res.status(200).json(allBanner);
  } else {
    const response = {
      success: false,
      message:
        "Invalid isActive value. Please provide either 'true' or 'false' or 'all' or leave it empty.",
    };
    return res.status(200).json(response);
  }
});

// Get all banner list
const getAllBanner = asyncHandler(async (req, res) => {
  const isActive = req.query.isActive; // filter

  if (isActive === "true" || isActive === "false") {
    const allBanner = await Banner.find({ isActive: isActive }).select(
      "name image isActive pramotionId"
    );
    return res.status(200).json(allBanner);
  } else if (isActive === "all" || !isActive) {
    const allBanner = await Banner.find();
    return res.status(200).json(allBanner);
  } else {
    const response = {
      success: false,
      message:
        "Invalid isActive value. Please provide either 'true' or 'false' or 'all' or leave it empty.",
    };
    return res.status(200).json(response);
  }
});

export {
  createBanner,
  getAllBannerAdmin,
  updateBanner,
  deleteBanner,
  getAllBanner,
};

/**

  createBanner()        - create banner                          DONE
  getAllBannerAdmin()   - get all banner for admin               DONE
  updateBanner()        - update banner                          DONE
  deleteBanner()        - delete banner                          DONE
  getAllBanner()        - get all banner for all (no middleware) DONE

 */
