import { Jewelry } from "../models/jewelry.model.js";
import { JewelrySubCategory } from "../models/jewelry.subcategory.model.js";
import { SubCategory } from "../models/subcategory.model.js";
import { Product } from "../models/product.model.js";
import { User } from "../models/user.model.js";
import { MetalRates } from "../models/metalRates.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";

// imports for file handling
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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

function toArray(value) {
  if (!value) return [];
  try {
    // If already an array, return as-is
    if (Array.isArray(value)) return value;
    // If JSON string, parse
    return JSON.parse(value);
  } catch {
    // Fallback for comma-separated string
    return value.split(",").map((v) => v.trim());
  }
}

// function to get metal rates
async function getMetalRates() {
  const latestMetalRates = await MetalRates.findOne()
    .sort({ createdAt: -1 })
    .lean();
  // console.log(latestMetalRates);
  return latestMetalRates;
}

export const createJewelry = asyncHandler(async (req, res) => {
  const {
    sku, //
    jewelryType, //
    jewelryName, //
    jewelryDesc, ///
    metal, //
    stock, //
    jewelryPrice, //
    jewelryMetalWeight, //
    isDiamondSubstitute, //
    diamondSubstitute, //
    isAvailable, //
    isFeatured, //
    deliveryDays,
  } = req.body;

  const { productSubCategoryId } = req.params;
  const { jewelrysubcategoryId } = req.params;

  const jewelryUploadPath = uploadPath.jewelryUpload;

  const jewelrysub = await JewelrySubCategory.findById(jewelrysubcategoryId);
  if (!jewelrysub) {
    deleteUploadedFiles(req, jewelryUploadPath);
    return res
      .status(404)
      .json({ success: false, message: "Jewelry subcategory not found" });
  }

  const productSubCategory = await SubCategory.findById(productSubCategoryId);
  if (!productSubCategory) {
    deleteUploadedFiles(req, jewelryUploadPath);
    return res
      .status(404)
      .json({ success: false, message: "Product subcategory not found" });
  }

  //sku check
  const jewelrySKUCheck = await Jewelry.findOne({ sku });
  if (jewelrySKUCheck) {
    deleteUploadedFiles(req, jewelryUploadPath);
    return res.status(400).json({
      success: false,
      message: "Jewelry SKU is already used. Try another one",
    });
  }

  const jewelryTypeEnum = [
    "Ring",
    "Pendant",
    "Bracelet",
    "Brooch",
    "Necklace",
    "Earrings",
  ];

  if (!jewelryTypeEnum.includes(jewelryType)) {
    // missing closing parenthesis
    deleteUploadedFiles(req, jewelryUploadPath);
    return res.status(400).json({
      success: false,
      message: `jewelryType type is not valid, use one of these values: ${jewelryTypeEnum.join(
        ", "
      )} `,
    });
  }

  const metalTypesEnum = ["gold", "silver", "platinum", "panchadhatu"];

  if (!metalTypesEnum.includes(metal)) {
    deleteUploadedFiles(req, jewelryUploadPath);
    return res.status(400).json({
      success: false,
      message: `Metal type is not valid, use one of these values: ${metalTypesEnum.join(
        ", "
      )} `,
    });
  }

  const parsedGemstoneWeight = toArray(req.body.gemstoneWeightTypes);
  const parsedCertificate = toArray(req.body.certificateTypes);
  const parsedSizeSystem = toArray(req.body.sizeSystem);
  // const parseddiamondSubstitute = toArray(req.body.diamondSubstitute);

  let isDiamondSubstituteData;
  let diamondSubstituteData;
  if (isDiamondSubstitute === "true" || isDiamondSubstitute === true) {
    isDiamondSubstituteData = true;
    diamondSubstituteData = toArray(req.body.diamondSubstitute);
  } else {
    isDiamondSubstituteData = false;
    diamondSubstituteData = [];
  }

  // const quality = Array.isArray(parsedQuality)
  //   ? parsedQuality.map((q) => ({
  //       qualityType: q.type,
  //       price: Number(q.price), // ensure number
  //     }))
  //   : [];

  const gemstoneWeight = Array.isArray(parsedGemstoneWeight)
    ? parsedGemstoneWeight.map((g) => ({
        weight: g.weight,
        price: Number(g.price),
      }))
    : [];

  const certificate = Array.isArray(parsedCertificate)
    ? parsedCertificate.map((c) => ({
        certificateType: c.type,
        price: Number(c.price),
      }))
    : [];

  const files = req.files;

  const images = Array.isArray(files?.images)
    ? files.images
    : [files?.images].filter(Boolean);
  const videos = Array.isArray(files?.videos)
    ? files.videos
    : [files?.videos].filter(Boolean);

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const jewelryPath = jewelryUploadPath.replace("../", "/");
  const jewelryImages = images.map((file) => ({
    fileName: file.filename,
    url: `${jewelryPath}${file.filename}`,
    // url: `/public/uploads/${file.filename}`,
  }));

  const jewelryVideos = videos.map((file) => ({
    fileName: file.filename,
    url: `${jewelryPath}${file.filename}`,
    // url: `/public/uploads/${file.filename}`,
  }));

  const jewelry = await Jewelry.create({
    sku,
    productSubCategory: productSubCategoryId,
    subCategory: jewelrysubcategoryId,
    jewelryName,
    // slug,
    jewelryMetalWeight,
    jewelryPrice,
    jewelryDesc,
    jewelryType,
    images: jewelryImages,
    videos: jewelryVideos,
    gemstoneWeight,
    isDiamondSubstitute: isDiamondSubstituteData,
    diamondSubstitute: diamondSubstituteData,
    certificate,
    sizeSystem: parsedSizeSystem,
    metal,
    stock,
    deliveryDays,
    isAvailable: isAvailable === "true" || isAvailable === true ? true : false,
    isFeatured: isFeatured === "true" || isFeatured === true ? true : false,
  });

  // push jewelry to product

  // await JewelrySubCategory.findByIdAndUpdate(jewelrysubcategoryId, {
  //   $push: {
  //     jewelleries: jewelry._id,
  //   },
  // });

  res.status(201).json({
    success: true,
    message: "Jewelry created and linked to product",
    jewelry,
  });
});

export const getAllJweleries = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const jewelryType = req.query.jewelryType;

  // Build filter object
  const filter = {};
  if (jewelryType) {
    filter.jewelryType = { $regex: `^${jewelryType}$`, $options: "i" };
  }
  // Only show items that are in stock and available
  filter.stock = { $gt: 0 };
  filter.isAvailable = true;

  // Count filtered docs
  const total = await Jewelry.countDocuments(filter);

  let jeweleries;
  // If a user is logged in, add the 'isWishlisted' field
  if (req.user) {
    const user = await User.findById(req.user._id)
      .select("wishlist.item")
      .lean();
    const userWishlist = user?.wishlist.map((w) => w.item) || [];
    jeweleries = await Jewelry.aggregate([
      { $match: filter },
      {
        $addFields: {
          isWishlisted: { $in: ["$_id", userWishlist] },
        },
      },
      // { $project: { name: 1, price: 1, images: 1, isWishlisted: 1 } },
      { $project: { reviewRating: 0 } },

      { $skip: skip }, // for pagination
      { $limit: limit },
    ]);
  } else {
    jeweleries = await Jewelry.find(filter)
      .select("-reviewRating")
      .skip(skip)
      .limit(limit);

    if (!jeweleries || jeweleries.length === 0) {
      return res.status(200).json({
        success: true,
        msg: "no jeweleries found",
        totalPage: Math.ceil(total / limit),
        currentPage: page,
        jeweleries: [],
      });
    }
  }

  return res.status(200).json({
    success: true,
    msg: "all jeweleries fetched",
    totalPage: Math.ceil(total / limit),
    currentPage: page,
    jeweleries,
    metalRates: await getMetalRates(),
  });
});

export const getSingleJewelry = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const jewelry = await Jewelry.findOne({ slug: slug }).populate(
    "subCategory productSubCategory"
  );

  if (!jewelry) {
    return res.status(404).json({ msg: "no jewelry found" });
  }
  return res.status(200).json({
    msg: "Single jewelry fetched",
    jewelry,
    metalRates: await getMetalRates(),
  });
});

export const deleteJewelry = asyncHandler(async (req, res) => {
  const { jewelryId } = req.params;

  const jewelryData = await Jewelry.findById(jewelryId);
  if (!jewelryData) {
    return res
      .status(404)
      .json({ success: false, msg: "jewelry not found and not deleted" });
  }

  const jewelryUploadPath = uploadPath.jewelryUpload;

  // delete uploaded files
  for (let i = 0; i < jewelryData.images.length; i++) {
    const oldPath = path.join(
      __dirname,
      jewelryUploadPath,
      jewelryData.images[i].fileName
    );
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  for (let i = 0; i < jewelryData.videos.length; i++) {
    const oldPath = path.join(
      __dirname,
      jewelryUploadPath,
      jewelryData.videos[i].fileName
    );
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const deleteJewel = await Jewelry.findByIdAndDelete(jewelryId);
  if (!deleteJewel) {
    return res
      .status(404)
      .json({ success: false, msg: "jewelry not found and not deleted" });
  }

  // Remove the deleted jewelry from all users' carts
  await User.updateMany(
    { "cart.item": jewelryId },
    { $pull: { cart: { item: jewelryId } } }
  );

  // Remove the deleted jewelry from all users' wishlists
  await User.updateMany(
    { "wishlist.item": jewelryId },
    { $pull: { wishlist: { item: jewelryId } } }
  );

  return res.status(200).json({
    success: true,
    msg: "jewelry deleted successfully",
    deleteJewel,
  });
});

export const updateJewelry = asyncHandler(async (req, res) => {
  const updateData = req.body;
  const { jewelryId } = req.params;
  // console.log("updateData", updateData);

  const files = req.files;

  const jewelry = await Jewelry.findById(jewelryId);
  if (!jewelry) {
    return res.status(404).json({ msg: "jewelry not found" });
  }

  // --- Validations ---
  if (updateData.sku && updateData.sku !== jewelry.sku) {
    const jewelrySKUCheck = await Jewelry.findOne({ sku: updateData.sku });
    if (jewelrySKUCheck) {
      return res.status(400).json({
        success: false,
        message: "Jewelry SKU is already used. Try another one",
      });
    }
  }

  if (updateData.jewelryType) {
    const jewelryTypeEnum = [
      "Ring",
      "Pendant",
      "Bracelet",
      "Brooch",
      "Necklace",
      "Earrings",
    ];
    if (!jewelryTypeEnum.includes(updateData.jewelryType)) {
      return res.status(400).json({
        success: false,
        message: `jewelryType type is not valid, use one of these values: ${jewelryTypeEnum.join(
          ", "
        )} `,
      });
    }
  }

  if (updateData.metal) {
    const metalTypesEnum = ["gold", "silver", "platinum", "panchadhatu"];
    if (!metalTypesEnum.includes(updateData.metal)) {
      return res.status(400).json({
        success: false,
        message: `Metal type is not valid, use one of these values: ${metalTypesEnum.join(
          ", "
        )} `,
      });
    }
  }
  // --- End Validations ---

  const oldSubId = jewelry.subCategory?.toString();

  if (updateData?.jewelryName) {
    const newSlug = updateData.jewelryName.replace(/ /g, "-");
    if (newSlug !== jewelry.slug) {
      const existingSlug = await Jewelry.findOne({
        slug: newSlug,
        _id: { $ne: jewelryId },
      });
      if (existingSlug) {
        return res.status(400).json({
          message: "Name change failed. This slug already exists.",
        });
      }
      updateData.slug = newSlug;
    }
  }

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const jewelryPath = uploadPath.jewelryUpload.replace("../", "/");
  if (files?.images) {
    const newImages = files.images.map((file) => ({
      fileName: file.filename,
      url: `${jewelryPath}${file.filename}`,
    }));
    jewelry.images.push(...newImages);
  }

  if (files?.videos) {
    const newVideos = files.videos.map((file) => ({
      fileName: file.filename,
      url: `${jewelryPath}${file.filename}`,
    }));
    jewelry.videos.push(...newVideos);
  }

  // Handle complex array fields from form-data
  if (updateData.certificate) {
    const parsedCertificate = toArray(updateData.certificate);
    let parsedCerts = [];
    /* try {
      // If coming from FormData as a JSON string
      parsedCerts = JSON.parse(updateData.certificate);
    } catch {
      // If coming as array in req.body directly
      parsedCerts = updateData.certificate;
    }
    */
    if (Array.isArray(parsedCertificate)) {
      jewelry.certificate = parsedCertificate.map((c) => ({
        certificateType: c.certificateType,
        price: Number(c.price),
      }));
    }
  }

  if (updateData.gemstoneWeight) {
    const parsedGemstoneWeight = toArray(updateData.gemstoneWeight);
    let parsedWeights = [];
    /* try {
      // If coming from FormData as a JSON string
      parsedWeights = JSON.parse(updateData.gemstoneWeight);
    } catch {
      // If coming as array in req.body directly
      parsedWeights = updateData.gemstoneWeight;
    }
    */
    if (Array.isArray(parsedGemstoneWeight)) {
      jewelry.gemstoneWeight = parsedGemstoneWeight.map((g) => ({
        weight: g.weight,
        price: Number(g.price),
      }));
    }
  }

  // quality
  if (updateData.quality) {
    const parsedQuality = toArray(updateData.quality);
    if (Array.isArray(parsedQuality)) {
      jewelry.quality = parsedQuality.map((q) => ({
        qualityType: q.type,
        price: Number(q.price),
      }));
    }
  }

  // sizeSystem
  if (updateData.sizeSystem) {
    const parsedSizeSystem = toArray(updateData.sizeSystem);
    if (Array.isArray(parsedSizeSystem)) {
      jewelry.sizeSystem = parsedSizeSystem;
    }
  }

  // isDiamondSubstitute and diamondSubstitute
  if (updateData.isDiamondSubstitute !== undefined) {
    const isDiamondSub =
      updateData.isDiamondSubstitute === "true" ||
      updateData.isDiamondSubstitute === true;
    jewelry.isDiamondSubstitute = isDiamondSub;
    if (isDiamondSub) {
      jewelry.diamondSubstitute = toArray(updateData.diamondSubstitute);
    } else {
      jewelry.diamondSubstitute = [];
    }
  }

  // Assign other simple fields from updateData
  const simpleFields = [
    "sku",
    "jewelryType",
    "jewelryName",
    "jewelryDesc",
    "metal",
    "stock",
    "slug",
    "jewelryPrice",
    "jewelryMetalWeight",
    "deliveryDays",
  ];

  simpleFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      jewelry[field] =
        updateData[field] === null ? undefined : updateData[field];
    }
  });

  // Handle boolean fields consistently
  ["isAvailable", "isFeatured"].forEach((field) => {
    if (updateData[field] !== undefined)
      jewelry[field] = String(updateData[field]) === "true";
  });

  if (updateData.subCategory) {
    const newSubId = updateData.subCategory.toString();
    // console.log("old id", oldSubId);
    // console.log("new id", newSubId);

    if (oldSubId !== newSubId) {
      // Remove jewelry from old subcategory
      if (oldSubId) {
        const pullRes = await JewelrySubCategory.findByIdAndUpdate(
          oldSubId,
          { $pull: { jewelleries: jewelry._id } },
          { new: true }
        );
        // console.log("Removed from old subcategory:", pullRes?.jewelleries);
      }

      // Add jewelry to new subcategory
      const pushRes = await JewelrySubCategory.findByIdAndUpdate(
        newSubId,
        { $addToSet: { jewelleries: jewelry._id } }, // $addToSet avoids duplicates
        { new: true }
      );
      // console.log("Added to new subcategory:", pushRes?.jewelleries);

      // Update jewelry document
      jewelry.subCategory = newSubId;
    }
  }

  if (updateData.productSubCategory) {
    jewelry.productSubCategory = updateData.productSubCategory;
  }

  // delete updateData.subCategory; // already handled

  const updatedProd = await jewelry.save({ validateBeforeSave: false });

  return res.status(200).json({
    msg: "jewelry updated sucessfully",
    updatedProd,
    newSlug: updatedProd.slug,
  });
});

export const jewelryByFilter = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { jewelryType, productSubCategory, metal } = req.query;

  console.log(req.query);

  let jewelryFilter = {};

  if (jewelryType) {
    jewelryFilter.jewelryType = { $regex: `^${jewelryType}$`, $options: "i" };
  }

  if (productSubCategory) {
    if (!mongoose.Types.ObjectId.isValid(productSubCategory)) {
      return res
        .status(400)
        .json({ success: false, msg: "Invalid productSubCategory ID format." });
    }
    jewelryFilter.productSubCategory = new mongoose.Types.ObjectId(
      productSubCategory
    );
  }

  if (metal) {
    jewelryFilter.metal = { $regex: `^${metal}$`, $options: "i" };
  }

  const total = await Jewelry.countDocuments(jewelryFilter);
  const jeweleries = await Jewelry.find(jewelryFilter).skip(skip).limit(limit);

  // It's better to return a 200 with an empty array than a 404
  if (!jeweleries || jeweleries.length === 0) {
    return res.status(200).json({
      success: true,
      msg: "No jewelleries found for the given filters.",
      jeweleries: [],
    });
  }

  return res.status(200).json({
    success: true,
    msg: "Jewelleries fetched successfully by filter.",
    totalPage: Math.ceil(total / limit),
    currentPage: page,
    metalRates: await getMetalRates(),
    jeweleries,
  });
});

export const searchApi = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { keyword = "" } = req.query;

  const totalProduct = await Product.countDocuments();

  const products = await Product.find({
    $or: [
      {
        name: { $regex: keyword, $options: "i" },
      },
    ],
  })
    .skip(skip)
    .limit(limit);

  const totalJewelries = await Jewelry.countDocuments();

  const jeweleries = await Jewelry.find({
    $or: [
      {
        jewelryName: { $regex: keyword, $options: "i" },
      },
    ],
  })
    .skip(skip)
    .limit(limit);

  return res.status(200).json({
    msg: "Searched products fetched successfully",
    products,
    jeweleries,
    totalProduct: Math.ceil(totalProduct / limit),
    totalJewelries: Math.ceil(totalJewelries / limit),
    metalRates: await getMetalRates(),
  });
});

export const filterProducts = asyncHandler(async (req, res) => {
  const {
    jewelryname,
    jewelryType,
    productSubCategory,
    minWeight,
    maxWeight,
    minPrice,
    maxPrice,
    origin,
    minCarat,
    maxCarat,
    color,
    cut,
    shape,
    certificateType,
    featured,
    ratti,
    subcategory,
    isAvailable,
  } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  if (jewelryname) query.jewelryName = jewelryname;
  if (jewelryType) query.jweleryType = jewelryType;

  query.isAvailable = true;
  if (isAvailable !== undefined) {
    query.isAvailable = isAvailable === "true";
  }

  if (featured) query.isFeatured = featured;

  if (certificateType) {
    query.certificate = {
      $elemMatch: { certificateType },
    };
  }

  if (minPrice && maxPrice) {
    query.jewelryPrice = { $gte: Number(minPrice), $lte: Number(maxPrice) };
  }
  if (minWeight && maxWeight) {
    query.gemstoneWeight = {
      $elemMatch: {
        weight: { $gte: Number(minWeight), $lte: Number(maxWeight) },
      },
    };
  }

  if (subcategory) {
    const subcat = await JewelrySubCategory.findOne({ name: subcategory });
    if (subcat && subcat.jewelleries.length > 0) {
      query._id = { $in: subcat.jewelleries };
    } else {
      return res.status(404).json({
        msg: "No Product found in this category",
      });
    }
  }

  if (productSubCategory) {
    if (!mongoose.Types.ObjectId.isValid(productSubCategory)) {
      return res
        .status(400)
        .json({ success: false, msg: "Invalid productSubCategory ID format." });
    }
    query.productSubCategory = new mongoose.Types.ObjectId(productSubCategory);
  }

  let products = await Jewelry.find(query)
    .populate("productSubCategory")
    .skip(skip)
    .limit(limit);

  if (origin) {
    products = products.filter((p) => p.productSubCategory?.origin === origin);
  }
  if (color) {
    products = products.filter((p) => p.productSubCategory?.color === color);
  }

  if (cut) {
    products = products.filter((p) => p.productSubCategory?.cut === cut);
  }

  if (shape) {
    products = products.filter((p) => p.productSubCategory?.shape === shape);
  }

  if (ratti) {
    products = products.filter((p) => p.productSubCategory?.ratti === ratti);
  }

  if (minCarat && maxCarat) {
    // query.carat = { $gte: Number(minCarat), $lte: Number(maxCarat) };
    products = products.filter(
      (p) =>
        p.productSubCategory?.carat >= Number(minCarat) &&
        p.productSubCategory?.carat <= Number(maxCarat)
    );
  }

  const total = products.length;

  return res.status(200).json({
    msg: "Products fetched with filter",
    totalPage: Math.ceil(total / limit),
    currentPage: page,
    metalRates: await getMetalRates(),
    products,
  });
});

export const similarProducts = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ msg: "No prod found" });
  }
  const query = {
    _id: { $ne: productId },
    color: product.color,
    shape: product.shape,
    cut: product.cut,
    origin: product.origin,
  };

  const products = await Product.find(query).limit(10);

  return res.status(200).json({
    msg: "Products found",
    products,
    metalRates: await getMetalRates(),
  });
});
export const similarJewelries = asyncHandler(async (req, res) => {
  const { jewelryId } = req.params;
  const { metal, jweleryType } = req.query; // from URL query

  const jewelry = await Jewelry.findById(jewelryId);
  if (!jewelry) return res.status(404).json({ msg: "No product found" });

  // Use query params if provided, otherwise fallback to DB values
  const query = {
    _id: { $ne: jewelryId },
    metal: metal || jewelry.metal,
    jewelryType: jweleryType || jewelry.jewelryType, // fixed typo
  };

  const products = await Jewelry.find(query).limit(10);

  return res
    .status(200)
    .json({
      msg: "Products found",
      products,
      metalRates: await getMetalRates(),
    });
});

export const editImage = asyncHandler(async (req, res) => {
  const { imageId, jewelryId } = req.params;

  const jewellery = await Jewelry.findById(jewelryId);
  if (!jewellery) {
    return res.status(404).json({ msg: "No product found" });
  }

  const imageIndex = jewellery.images.findIndex(
    (img) => img._id.toString() === imageId
  );

  if (imageIndex === -1) {
    return res.status(400).json({ msg: "No index found" });
  }

  // Delete the old image file from the server
  const oldImage = jewellery.images[imageIndex];
  if (oldImage && oldImage.fileName) {
    const jewelryUploadPath = uploadPath.jewelryUpload;
    const oldPath = path.join(__dirname, jewelryUploadPath, oldImage.fileName);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const jewelryPath = uploadPath.jewelryUpload.replace("../", "/");
  const payload = {
    fileName: req.file.filename,
    url: `${jewelryPath}${req.file.filename}`,
  };

  jewellery.images[imageIndex] = payload;
  const updatedImage = await jewellery.save();

  return res.status(200).json({
    msg: "Image updated successfully",
    updatedProduct: updatedImage.images,
  });
});

export const editVideo = asyncHandler(async (req, res) => {
  const { videoId, jewelryId } = req.params;

  const jewelry = await Jewelry.findById(jewelryId);
  if (!jewelry) {
    return res.status(404).json({ msg: "No jewelry found" });
  }

  const videoIndex = jewelry.videos.findIndex(
    (vid) => vid._id.toString() === videoId
  );

  if (videoIndex === -1) {
    return res.status(400).json({ msg: "Video not found" });
  }

  // Delete the old video file from the server
  const oldVideo = jewelry.videos[videoIndex];
  if (oldVideo && oldVideo.fileName) {
    const jewelryUploadPath = uploadPath.jewelryUpload;
    const oldPath = path.join(__dirname, jewelryUploadPath, oldVideo.fileName);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const jewelryPath = uploadPath.jewelryUpload.replace("../", "/");
  const payload = {
    fileName: req.file.filename,
    url: `${jewelryPath}${req.file.filename}`,
  };

  jewelry.videos[videoIndex] = payload;
  const updatedJewelry = await jewelry.save();

  return res.status(200).json({
    msg: "Video updated successfully",
    updatedVideos: updatedJewelry.videos,
  });
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const { jewelryId, videoId } = req.params;

  const jewelry = await Jewelry.findById(jewelryId);
  if (!jewelry) {
    return res.status(404).json({ msg: "Jewelry not found" });
  }

  const videoIndex = jewelry.videos.findIndex(
    (vid) => vid._id.toString() === videoId
  );

  if (videoIndex === -1) {
    return res.status(400).json({ msg: "Video not found in jewelry" });
  }

  // Get the video to be deleted to access its filename
  const videoToDelete = jewelry.videos[videoIndex];

  // Delete the physical file from the server
  if (videoToDelete && videoToDelete.fileName) {
    const jewelryUploadPath = uploadPath.jewelryUpload;
    const oldPath = path.join(
      __dirname,
      jewelryUploadPath,
      videoToDelete.fileName
    );
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }
  jewelry.videos.splice(videoIndex, 1); // remove the video

  const updatedJewelry = await jewelry.save();

  res.status(200).json({
    msg: "Video deleted successfully",
    updatedVideos: updatedJewelry.videos,
  });
});

export const deleteImage = asyncHandler(async (req, res) => {
  const { jewelryId, imageId } = req.params;

  const jewelry = await Jewelry.findById(jewelryId);
  if (!jewelry) {
    return res.status(404).json({ msg: "Jewelry not found" });
  }

  const imageIndex = jewelry.images.findIndex(
    (img) => img._id.toString() === imageId
  );

  if (imageIndex === -1) {
    return res.status(400).json({ msg: "Image not found in jewelry" });
  }

  // Get the image to be deleted to access its filename
  const imageToDelete = jewelry.images[imageIndex];

  // Delete the physical file from the server
  if (imageToDelete && imageToDelete.fileName) {
    const jewelryUploadPath = uploadPath.jewelryUpload;
    const oldPath = path.join(
      __dirname,
      jewelryUploadPath,
      imageToDelete.fileName
    );
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  jewelry.images.splice(imageIndex, 1); // remove the image

  const updatedJewelry = await jewelry.save();

  res.status(200).json({
    msg: "Image deleted successfully",
    updatedImages: updatedJewelry.images,
  });
});

// this api is for to filter the gemstone type and jeweley type
export const getAllJweleriesOfGemstoneType = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const jewelryType = req.query.jewelryType;
  const gemstoneId = req.query.gemstoneId;
  const gemstoneName = req.query.gemstoneName;
  const gemstoneSlug = req.query.gemstoneSlug;

  if (!jewelryType) {
    return res.status(400).json({
      success: false,
      msg: "The 'jewelryType' query parameter is required.",
    });
  }

  let query = {};
  query.jewelryType = { $regex: `^${jewelryType}$`, $options: "i" };
  // Only show items that are in stock and available
  query.stock = { $gt: 0 };
  query.isAvailable = true;

  // Only filter by gemstone if one of the identifiers is provided
  if (gemstoneId || gemstoneName || gemstoneSlug) {
    const subCategoryQuery = {};
    if (gemstoneId) {
      if (!mongoose.isValidObjectId(gemstoneId)) {
        return res
          .status(400)
          .json({ success: false, msg: "Invalid gemstoneId provided." });
      }
      subCategoryQuery._id = gemstoneId;
    } else if (gemstoneName) {
      // Use a case-insensitive regex for the name
      subCategoryQuery.name = { $regex: `^${gemstoneName}$`, $options: "i" };
    } else if (gemstoneSlug) {
      // Slugs are stored as lowercase, so convert input to lowercase for a direct match
      subCategoryQuery.slug = gemstoneSlug.toLowerCase();
    }

    // Find the SubCategory by name, slug, or ID to get its _id
    const subCategory = await SubCategory.findOne(subCategoryQuery).lean();

    // If a gemstone identifier was provided but not found, return an empty list.
    if (!subCategory) {
      return res.status(200).json({
        success: true,
        msg: "No jewelry found for the specified subcategory identifier.",
        totalPage: 0,
        currentPage: page,
        jeweleries: [],
      });
    }
    // Add the found subCategory's _id to the main jewelry query
    query.productSubCategory = subCategory._id;
  }

  const totalListItems = await Jewelry.countDocuments(query);

  let jeweleries;

  if (req.user) {
    const user = await User.findById(req.user._id)
      .select("wishlist.item")
      .lean(); // Fetch only the item IDs
    const userWishlist = user?.wishlist.map((w) => w.item) || [];

    const pipeline = [
      { $match: query },
      {
        $addFields: {
          isWishlisted: {
            $in: ["$_id", userWishlist],
          },
        },
      },
      // Populate productSubCategory
      {
        $lookup: {
          from: "subcategories",
          localField: "productSubCategory",
          foreignField: "_id",
          as: "productSubCategory",
        },
      },
      {
        $unwind: {
          path: "$productSubCategory",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Populate subCategory
      {
        $lookup: {
          from: "jewelrysubcategories",
          localField: "subCategory",
          foreignField: "_id",
          as: "subCategory",
        },
      },
      {
        $unwind: { path: "$subCategory", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          // First projection: Exclude top-level fields
          reviewRating: 0,
          sizeSystem: 0,
          wishlistedBy: 0,
        },
      },
      {
        $project: {
          // Second projection: Reshape sub-documents to include only desired fields
          "productSubCategory.name": 1,
          "productSubCategory.slug": 1,
          "productSubCategory.category": 1,
          "subCategory.name": 1,
          "subCategory.slug": 1,
          "subCategory.jewelryCategory": 1,
          // Include all other fields from the root document
          // The '1' here means "keep this field as it is"
          isWishlisted: 1,
          sku: 1,
          jewelryName: 1,
          slug: 1,
          jewelryMetalWeight: 1,
          isDiamondSubstitute: 1,
          diamondSubstitute: 1,
          jewelryPrice: 1,
          jewelryDesc: 1,
          jewelryType: 1,
          images: 1,
          videos: 1,
          // gemstoneWeight: 1,
          // certificate: 1,
          quality: 1,
          metal: 1,
          stock: 1,
          isAvailable: 1,
          isFeatured: 1,
          price: 1,
          color: 1,
          // orderCount: 1,
          offerId: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    jeweleries = await Jewelry.aggregate(pipeline);
  } else {
    jeweleries = await Jewelry.find(query)
      .select(
        "-reviewRating -sizeSystem -wishlistedBy -gemstoneWeight -orderCount -certificate"
      )
      .populate({
        path: "productSubCategory",
        select: "name slug category",
      })
      .populate({
        path: "subCategory",
        select: "name slug jewelryCategory",
      })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  if (!jeweleries || jeweleries.length === 0) {
    return res.status(200).json({
      success: true,
      msg: "no jeweleries found",
      totalPage: Math.ceil(totalListItems / limit),
      currentPage: page,
      jeweleries: [],
    });
  }

  return res.status(200).json({
    success: true,
    msg: "all jeweleries fetched",
    totalPage: Math.ceil(totalListItems / limit),
    currentPage: page,
    jeweleries,
    metalRates: await getMetalRates(),
  });
});

/**


	getAllJweleries()                 - Get All Jewellery                             DONE
	getAllJweleriesOfGemstoneType()   - Get All Jewelery Of The Gemstone Type         DONE

  getJeweleryListForGemstone()      - Get Jewelery list for gemstone                DONE
 */
