import { Jewelry } from "../models/jewelry.model.js";
import { Product } from "../models/product.model.js";
import { SubCategory } from "../models/subcategory.model.js";
import { originCountryMap } from "../models/originCountryMap.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { Admin } from "../models/Admin.model.js";

// imports for file handling
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import uploadPath from "../utils/uploadPaths.js";

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

export const createProduct = asyncHandler(async (req, res) => {
  const {
    sku,
    name,
    origin,
    carat,
    ratti,
    price,
    certificateTypes,
    certificatePrices,
    weight,
    description,
    treatment,
    shape,
    color,
    cut,
    isAvailable,
    isFeatured,
    stock,
    sellPrice,
    deliveryDays,
  } = req.body;

  const parsedCertificate = toArray(req.body.certificateTypes);

  const parsedupSellingProductSKU = toArray(req.body.upSellingProductSKU);

  const productUploadPath = uploadPath.productUpload;

  if (!sku || !name || !origin || !price) {
    deleteUploadedFiles(req, productUploadPath);
    return res.status(400).json({ msg: "Pls enter all fields" });
  }
  const files = req.files || {};

  const existingSku = await Product.findOne({ sku });
  if (existingSku) {
    deleteUploadedFiles(req, productUploadPath);
    return res
      .status(400)
      .json({ msg: "Product with this SKU already exists" });
  }

  const { subcategoryId } = req.params;
  if (!subcategoryId) {
    deleteUploadedFiles(req, productUploadPath);
    return res.status(400).json({ msg: "No Subcategory found" });
  }

  const images = Array.isArray(files?.images)
    ? files.images
    : [files?.images].filter(Boolean);
  const videos = Array.isArray(files?.videos)
    ? files.videos
    : [files?.videos].filter(Boolean);

  // Use the centralized uploadPath for consistent URL generation
  const productPath = productUploadPath.replace("../", "/");
  const gemimages = images.map((file) => ({
    fileName: file.filename,
    url: `${productPath}${file.filename}`,
  }));

  const gemvideos = videos.map((file) => ({
    fileName: file.filename,
    url: `${productPath}${file.filename}`,
  }));

  const certificate = Array.isArray(parsedCertificate)
    ? parsedCertificate.map((c) => ({
        certificateType: c.type,
        price: Number(c.price),
      }))
    : [];

    const upSellingProductSKU = Array.isArray(parsedupSellingProductSKU)
      ? parsedupSellingProductSKU
      : [];

  const newProduct = await Product.create({
    sku,
    name: name + " " + carat + " Carats",
    origin,
    carat,
    ratti,
    price,
    certificate,
    weight,
    description,
    treatment,
    shape,
    color,
    cut,
    isAvailable,
    isFeatured,
    stock,
    sellPrice,
    deliveryDays,
    subCategory: subcategoryId,
    images: gemimages, /// images field in postman
    videos: gemvideos, // videos field in postman
    upSellingProductSKU,
  });

  await SubCategory.findByIdAndUpdate(subcategoryId, {
    $push: { products: newProduct._id },
  });

  return res.status(201).json({
    msg: "Gem stone created successfully",
    newProduct,
  });
});

export const getAllProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const total = await Product.countDocuments();

  let products;
  if (req.user) {
    const userId = req.user._id;
    products = await Product.aggregate([
      {
        $match: {
          /* your filters */
        },
      },
      {
        $addFields: {
          isWishlisted: { $in: [userId, { $ifNull: ["$wishlistedBy", []] }] },
        },
      },
      // { $project: { name: 1, price: 1, images: 1, isWishlisted: 1 } },
      { $project: { wishlistedBy: 0 } },

      { $skip: skip }, // for pagination
      { $limit: limit },
    ]);
  } else {
    products = await Product.find()
      .select("-wishlistedBy")
      .skip(skip)
      .limit(limit);
    if (!products || products.length === 0) {
      return res.status(200).json({ msg: "no products found" });
    }
  }

  // const productsWish = await Product.aggregate([
  //   { $match: {/* your filters */} },
  //   { $addFields: {
  //       isWishlisted: { $in: [userId, "$wishlistedBy"] }
  //     }
  //   },
  //   { $project: { name: 1, price: 1, images: 1, isWishlisted: 1 } },
  //   { $skip: skip }, // for pagination
  //   { $limit: limit }
  // ]);

  return res.status(200).json({
    success: true,
    msg: "All stones fetched successfully",
    products,
    totalPage: Math.ceil(total / limit),
    currentPage: page,
  });
});

export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.find()
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(15);

  return res.status(200).json({
    msg: "Featured products found",
    products,
  });
});

export const getSingleProduct = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug }).populate("subCategory");

  if (!product) {
    return res.status(404).json({
      msg: "Product not found",
    });
  }

  const countryData = await originCountryMap
    .findOne({ countryName: { $regex: `^${product.origin}$`, $options: "i" } })

  return res.status(200).json({
    msg: "Single product fetched successfully",
    product,
    countryData,
  });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findById(productId);

  if (!product) {
    return res.status(404).json({ msg: "no prod found" });
  }

  const productUploadPath = uploadPath.productUpload;

  // Delete all associated image files
  if (product.images && product.images.length > 0) {
    for (const image of product.images) {
      if (image.fileName) {
        const imagePath = path.join(
          __dirname,
          productUploadPath,
          image.fileName
        );
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }
  }

  // Delete all associated video files
  if (product.videos && product.videos.length > 0) {
    for (const video of product.videos) {
      if (video.fileName) {
        const videoPath = path.join(
          __dirname,
          productUploadPath,
          video.fileName
        );
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      }
    }
  }

  const deletStone = await Product.findByIdAndDelete(productId);

  // Remove the deleted product from all users' carts
  await User.updateMany(
    { "cart.item": productId },
    { $pull: { cart: { item: productId } } }
  );

  // Remove the deleted product from all users' wishlists
  await User.updateMany(
    { "wishlist.item": productId },
    { $pull: { wishlist: { item: productId } } }
  );

  return res.status(200).json({
    msg: "Gemstone product, its files, and all associated user cart/wishlist entries have been deleted successfully",
    deletStone,
  });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const updateData = req.body;
  const { productId } = req.params;
  // const { imageIndex, videoIndex } = req.body;  need to add logic for to replace old video or old image
  const files = req.files;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ msg: "Product not found" });
  }

  // if (updateData?.name) {
  //   const newSlug = updateData.name.replace(/ /g, "-");
  //   if (newSlug !== product.slug) {
  //     const existingSlug = await Product.findOne({
  //       slug: newSlug,
  //       _id: { $ne: productId },
  //     });
  //     if (existingSlug) {
  //       return res.status(400).json({
  //         message: "Name change failed. This slug already exists.",
  //       });
  //     }
  //     updateData.slug = newSlug;
  //   }
  // }
  if (updateData?.name) {
    let newSlug = updateData.name.toLowerCase().replace(/ /g, "-");

    // If name or SKU changed, regenerate slug
    if (newSlug !== product.slug) {
      const baseSlug = newSlug;
      let slug = baseSlug;
      let counter = 1;

      // ✅ Ensure unique slug like pre-save does
      while (await Product.exists({ slug, _id: { $ne: productId } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      updateData.slug = slug;
    }
  }
  const productUploadPath = uploadPath.productUpload;
  const productPath = productUploadPath.replace("../", "/");
  if (files?.images) {
    const newImages = files.images.map((file) => ({
      fileName: file.filename,
      url: `${productPath}${file.filename}`,
    }));
    product.images.push(...newImages);
  }

  if (files?.videos) {
    const newVideos = files.videos.map((file) => ({
      fileName: file.filename,
      url: `${productPath}${file.filename}`,
    }));
    product.videos.push(...newVideos);
  }

  // ✅ Parse and replace certificates
  if (updateData.certificate) {
    let parsedCerts = [];
    try {
      // If coming from FormData as a JSON string
      parsedCerts = JSON.parse(updateData.certificate);
    } catch {
      // If coming as array in req.body directly
      parsedCerts = updateData.certificate;
    }

    if (Array.isArray(parsedCerts)) {
      product.certificate = parsedCerts.map((c) => ({
        certificateType: c.certificateType,
        price: Number(c.price),
      }));
    }
  }

  if (typeof updateData.certificate === "string") {
    try {
      updateData.certificate = JSON.parse(updateData.certificate);
    } catch (err) {
      return res.status(400).json({ message: "Invalid certificate format" });
    }
  }

    // ✅ Parse and replace upselling SKU list
  if (updateData.upSellingProductSKU) {
    let parsedupSellingProductSKU = [];
    try {
      // If coming from FormData as a JSON string
      parsedupSellingProductSKU = JSON.parse(updateData.upSellingProductSKU);
    } catch {
      // If coming as array in req.body directly
      parsedupSellingProductSKU = updateData.upSellingProductSKU;
    }

    if (Array.isArray(parsedupSellingProductSKU)) {
      product.upSellingProductSKU = parsedupSellingProductSKU.map((c) => (c));
    }
  }

  if (typeof updateData.upSellingProductSKU === "string") {
    try {
      updateData.upSellingProductSKU = JSON.parse(updateData.upSellingProductSKU);
    } catch (err) {
      return res.status(400).json({ message: "Invalid upSellingProductSKU format" });
    }
  }

  if (
    updateData.subCategory &&
    updateData.subCategory !== String(product.subCategory)
  ) {
    if (product.subCategory) {
      await SubCategory.findByIdAndUpdate(product.subCategory, {
        $pull: {
          products: product._id,
        },
      });
    }
    await SubCategory.findByIdAndUpdate(updateData.subCategory, {
      $push: {
        products: product._id,
      },
    });
    product.subCategory = updateData.subCategory;
  }

  delete updateData.subCategory; /// handled already

  // Update other fields
  Object.assign(product, updateData);

  const updatedProd = await product.save();

  return res.status(200).json({
    msg: "product updated successfully",
    updatedProd,
    newSlug: updatedProd.slug,
  });
});

export const editImage = asyncHandler(async (req, res) => {
  const { imageId, productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ msg: "No prod found" });
  }

  const imageIndex = product.images.findIndex(
    (img) => img._id.toString() === imageId
  );

  if (imageIndex === -1) {
    return res.status(400).json({ msg: "No index found" });
  }

  // Delete the old image file from the server
  const oldImage = product.images[imageIndex];
  if (oldImage && oldImage.fileName) {
    const productUploadPath = uploadPath.productUpload;
    const oldPath = path.join(__dirname, productUploadPath, oldImage.fileName);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const productPath = uploadPath.productUpload.replace("../", "/");
  const payload = {
    fileName: req.file.filename,
    url: `${productPath}${req.file.filename}`,
  };

  product.images[imageIndex] = payload;

  const updatedImage = await product.save();

  return res.status(200).json({
    msg: "Image updated successfully",
    updatedProduct: updatedImage.images,
  });
});

export const editVideo = asyncHandler(async (req, res) => {
  const { videoId, productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ msg: "No prod found" });
  }

  const videoIndex = product.videos.findIndex(
    (vid) => vid._id.toString() === videoId
  );

  if (videoIndex === -1) {
    return res.status(400).json({ msg: "No index found" });
  }

  // Delete the old video file from the server
  const oldVideo = product.videos[videoIndex];
  if (oldVideo && oldVideo.fileName) {
    const productUploadPath = uploadPath.productUpload;
    const oldPath = path.join(__dirname, productUploadPath, oldVideo.fileName);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const productPath = uploadPath.productUpload.replace("../", "/");
  const payload = {
    fileName: req.file.filename,
    url: `${productPath}${req.file.filename}`,
  };

  product.videos[videoIndex] = payload;
  const updatedVideo = await product.save();

  return res.status(200).json({
    msg: "Video updated successfully",
    updatedProduct: updatedVideo.videos,
  });
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const { productId, videoId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ msg: "Product not found" });
  }

  const videoIndex = product.videos.findIndex(
    (vid) => vid._id.toString() === videoId
  );

  if (videoIndex === -1) {
    return res.status(400).json({ msg: "Video not found in product" });
  }

  // Get the video to be deleted to access its filename
  const videoToDelete = product.videos[videoIndex];

  // Delete the physical file from the server
  if (videoToDelete && videoToDelete.fileName) {
    const productUploadPath = uploadPath.productUpload;
    const oldPath = path.join(
      __dirname,
      productUploadPath,
      videoToDelete.fileName
    );
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  product.videos.splice(videoIndex, 1); // remove the video

  const updatedProduct = await product.save();

  res.status(200).json({
    msg: "Video deleted successfully",
    updatedVideos: updatedProduct.videos,
  });
});

export const deleteImage = asyncHandler(async (req, res) => {
  const { productId, imageId } = req.params;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ msg: "Product not found" });
  }

  const imageIndex = product.images.findIndex(
    (img) => img._id.toString() === imageId
  );

  if (imageIndex === -1) {
    return res.status(400).json({ msg: "Image not found in product" });
  }

  // Get the image to be deleted to access its filename
  const imageToDelete = product.images[imageIndex];

  // Delete the physical file from the server
  if (imageToDelete && imageToDelete.fileName) {
    const productUploadPath = uploadPath.productUpload;
    const oldPath = path.join(
      __dirname,
      productUploadPath,
      imageToDelete.fileName
    );
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  product.images.splice(imageIndex, 1); // remove the image

  const updatedProduct = await product.save();

  res.status(200).json({
    msg: "Image deleted successfully",
    updatedImages: updatedProduct.images,
  });
});

export const filterProducts = asyncHandler(async (req, res) => {
  const {
    gemname,
    minWeight,
    maxWeight,
    minPrice,
    maxPrice,
    minRatti,
    maxRatti,
    origin,
    minCarat,
    maxCarat,
    color,
    cut,
    shape,
    certificateType,
    featured,
    treatment,
    subcategory,
    isAvailable,
  } = req.query;

const page = parseInt(req.query.page || 1); // default pages was missing
const limit = parseInt(req.query.limit || 12);
const skip = (page - 1) * limit;
  const query = {};

  if (gemname) query.name = gemname;
  if (origin) query.origin = origin;
  if (treatment) query.treatment = treatment;
  if (color) query.color = color;
  if (cut) query.cut = cut;
  if (shape) query.shape = shape;
  if (featured) query.isFeatured = featured;
  if (isAvailable !== undefined) {
    query.isAvailable = isAvailable === "true";
  }

  if (certificateType) {
    query.certificate = {
      $elemMatch: { certificateType },
    };
  }

  if (minCarat && maxCarat) {
    query.carat = { $gte: Number(minCarat), $lte: Number(maxCarat) };
  }

  if (minRatti && maxRatti) {
    query.ratti = { $gte: Number(minRatti), $lte: Number(maxRatti) };
  }

  if (minPrice && maxPrice) {
    query.price = { $gte: Number(minPrice), $lte: Number(maxPrice) };
  }
  if (minWeight && maxWeight) {
    query.weight = { $gte: Number(minWeight), $lte: Number(maxWeight) };
  }

  if (subcategory) {
    const subcat = await SubCategory.findOne({
      $or: [{ slug: subcategory }, { name: subcategory }],
    });

    if (subcat && subcat.products.length > 0) {
      query._id = { $in: subcat.products }; /* {
  _id: { $in: ["664ab12", "664ab13", "664ab14"] },
  price: { $gte: 100, $lte: 500 },
  color: "blue"
}
 */
    } else {
      return res
        .status(404)
        .json({ msg: "No products found for this category" });
    }
  }

  // Determine if requester is an admin; if not, enforce stock > 0 and availability true
  let isAdmin = false;
  try {
    const token =
      req.header("Authorization")?.split(" ")[1] || req.cookies?.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded) {
        const admin = await Admin.findById(decoded.id).select("_id");
        if (admin) {
          isAdmin = true;
        }
      }
    }
  } catch (e) {
    // ignore token errors for public access
  }

  if (!isAdmin) {
    query.isAvailable = true;
    query.stock = { $gt: 0 };
  }

  // Sorting
  let sortOption = {};

  switch (req.query.sort) {
    case "price_low_to_high":
      sortOption.price = 1;
      break;

    case "price_high_to_low":
      sortOption.price = -1;
      break;

    case "newest":
      sortOption.createdAt = -1;
      break;

    case "oldest":
      sortOption.createdAt = 1;
      break;

    default:
      break;
  }

  const totalProducts = await Product.countDocuments(query);

  // 👉 Apply pagination here
  const products = await Product.find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalProducts / limit);

  return res.status(200).json({
    msg: "Products fetched with filter",
    products,
     currentPage: page,
    totalPages,
    totalProducts,
    limit,
  });
});

export const getOriginCountryForSubCat = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({ msg: "Slug is required" });
  }

  // 1. Find the subcategory using slug
  const subcategory = await SubCategory.findOne({ slug });

  if (!subcategory) {
    return res.status(404).json({ msg: "Subcategory not found" });
  }

  // 2. Use the subcategory _id to fetch distinct origins
  const originsList = await Product.distinct("origin", {
    subCategory: subcategory._id,
  });

  return res.status(200).json({
    success: true,
    msg: "Distinct origins fetched successfully",
    originsList,
  });
});

// export const crossSellingProductList = asyncHandler(async (req, res) => {
//   // Assuming req.user is populated by an authentication middleware
//   const userId = req.user?._id;

//   if (!userId) {
//     return res.status(401).json({ msg: "User not authenticated." });
//   }

//   const user = await User.findById(userId)
//     .select("cart")
//     .populate({
//       path: "cart.item",
//       select: "subCategory", // Populate subCategory from the product in the cart
//     });

//   if (!user) {
//     return res.status(404).json({ msg: "User not found." });
//   }

//   // Check if the cart is empty or the first item is not a product
//   if (
//     !user.cart ||
//     user.cart.length === 0 ||
//     user.cart[0].itemType !== "Product"
//   ) {
//     return res.status(200).json({
//       success: false,
//       msg: "The first item in the cart is not a product or the cart is empty.",
//       products: [], // Return empty array
//     });
//   let products = await Product.find({
//     _id: { $ne: firstCartItem.item._id }, // Exclude the original product
//     subCategory: firstCartItem.item.subCategory,
//     price: { $gt: basePrice, $lte: maxPrice },
//     isAvailable: true,
//   }).limit(4); // Limiting to 4 results for a concise list
//   }
//   return res.status(200).json({
//     success: true,
//     msg: "Upselling products fetched successfully.",
//     products,
//   });
// });

export const crossSellingProductList = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ msg: "User not authenticated." });
  }

  const user = await User.findById(userId)
    .select("cart")
    .populate({
      path: "cart.item",
      select: "subCategory price",
    });

  if (!user) {
    return res.status(404).json({ msg: "User not found." });
  }

  // ✅ Find first product item
  const firstProductItem = user.cart.find(
    (item) => item.itemType === "Product"
  );

  if (!firstProductItem) {
    return res.status(200).json({
      success: false,
      msg: "No product found in the cart.",
      products: [],
    });
  }

  const basePrice = firstProductItem.totalPrice;
  const maxPrice = basePrice * 1.1;

  const products = await Product.find({
    _id: { $ne: firstProductItem.item._id },
    subCategory: firstProductItem.item.subCategory,
    price: { $gt: basePrice, $lte: maxPrice },
    isAvailable: true,
  }).limit(4);

  return res.status(200).json({
    success: true,
    msg: "Cross selling products fetched successfully.",
    products,
  });
});


export const upSellingProductSKU = asyncHandler(async(req, res) => {
  const {productId} = req.params;

  if(!productId){
    return res.status(400).json({
      success: false,
      message :"productId is Required.",
    })
  }

  const product = await Product.findById(productId).select("upSellingProductSKU");

  // for safty
  if (!product) {
  return res.status(200).json({
    success: false,
    data: [],
    message: "Product not found",
  });
}

if (!Array.isArray(product.upSellingProductSKU) || product.upSellingProductSKU.length === 0) {
  return res.status(200).json({
    success: false,
    data: [],
    message: "No upselling SKUs available",
  });
}

  console.log("here are the products ",product);

  const upSellingProductSKU = product.upSellingProductSKU;

  const SKUproducts = await Product.find({ sku: { $in: upSellingProductSKU }}).select("-wishlistedBy -reviewRating").limit(2);

  const SKUjewelry = await Jewelry.find({ sku: { $in: upSellingProductSKU }}).select("-wishlistedBy -reviewRating").limit(2);

  const data = [...SKUproducts, ...SKUjewelry];



  res.status(200).json({
    message:  "Up Selling Proudcts SKU added successFully",
    data : data,
  })

});


  // // Find the first item in the cart that is a product
  // const firstProductItem = user.cart.find((item) => item.itemType === "Product");

  // if (!firstProductItem) {
  //   return res.status(200).json({
  //     success: false,
  //     msg: "No product found in the cart.",
  //     products: [], // Return empty array
  //   });
  // }

  // const firstCartItem = firstProductItem;
  // const basePrice = firstCartItem.totalPrice;
  // const maxPrice = basePrice * 1.1; // 10% higher than the base price

  // // Find products that are available, in the same subcategory, and priced between the original price and 10% more
