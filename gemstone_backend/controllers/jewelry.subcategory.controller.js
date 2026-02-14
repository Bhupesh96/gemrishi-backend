import { Category } from "../models/category.model.js";
import { JewelryCategory } from "../models/jewelry.category.model.js";
import { Jewelry } from "../models/jewelry.model.js";
import { JewelrySubCategory } from "../models/jewelry.subcategory.model.js";
import { SubCategory } from "../models/subcategory.model.js";
import asyncHandler from "../utils/asyncHandler.js";

const filesUploadPath = process.env.FILES_UPLOAD_PATH;

export const createJewelrySubcategory = asyncHandler(async (req, res) => {
  const { jewelryCategoryId } = req.params;
  const {
    name,
    description,
    about,
    meaning,
    qualityAndPrice,
    buyerGuide,
    faqs,
  } = req.body;

  const category = await JewelryCategory.findById(jewelryCategoryId);
  if (!category) {
    return res.status(404).json({ msg: "No category found" });
  }

  const parsedFaqs = JSON.parse(faqs);

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const subcategory = new JewelrySubCategory({
    name,
    description,
    about,
    meaning,
    qualityAndPrice,
    buyerGuide,
    faqs: parsedFaqs,
    jewelryCategory: jewelryCategoryId,
    image: {
      fileName: req.file ? req.file.filename : "",
      url: req.file
        ? `/public/uploads/${
            req.file.filename
          }`
        : null,
    },
  });

  await JewelryCategory.findByIdAndUpdate(jewelryCategoryId, {
    $push: {
      jewelrySubCategories: subcategory._id,
    },
  });

  await subcategory.save();

  return res.status(200).json({
    msg: "Jewelry Sub-category created",
    subcategory,
  });
});

export const getAllJewelrySubcategories = asyncHandler(async (req, res) => {
  const subcategories = await JewelrySubCategory.find();

  if (!subcategories) {
    return res.status(404).json({
      msg: "No Subcategories found",
      subcategories:[],
    });
  }
  return res.status(200).json({
    msg: "Subcategories fetched successfully",
    subcategories,
  });
});

export const getSingleJewelrySubcategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const subcategory = await JewelrySubCategory.findOne({ slug: slug });
  if (!subcategory) {
    return res.status(404).json({
      success: false,
      msg: "No Subcategory found",
    });
  }

  const filter = {
    subCategory: subcategory._id,
  };
  const totalJewelleris = await Jewelry.countDocuments(filter);

  const jewelleries = await Jewelry.find(filter).select("-reviewRating").skip(skip).limit(limit);

  return res.status(200).json({
    success: true,
    msg: "Subcategory with jewelleries fetched successfully",
    subcategory,
    jewelleries,
    totalPage: Math.ceil(totalJewelleris / limit),
    currentPage: page,
  });
});

export const deleteJewelrySubCategory = asyncHandler(async (req, res) => {
  const { jewelrysubCategoryId } = req.params;

  const subcategory = await JewelrySubCategory.findByIdAndDelete(
    jewelrysubCategoryId
  );
  if (!subcategory) {
    return res.status(404).json({
      msg: "No Subcategory found",
    });
  }

  await JewelryCategory.updateMany(
    { jewelrySubCategories: jewelrysubCategoryId },
    {
      $pull: {
        jewelrySubCategories: jewelrysubCategoryId,
      },
    }
  );

  return res.status(200).json({
    msg: "Subcategory deleted successfulyy",
    subcategory,
  });
});

export const updateJewelrySubCategory = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  const { jewelrysubCategoryId } = req.params;

  const subcategory = await JewelrySubCategory.findById(jewelrysubCategoryId);
  if (!jewelrysubCategoryId) {
    return res.status(404).json({ msg: "No Subcategory found" });
  }

  if (updates.faqs) {
    if (typeof updates.faqs === "string") {
      try {
        updates.faqs = JSON.parse(updates.faqs);
      } catch {
        return res.status(400).json({ msg: "Invalid faqs JSON" });
      }
      if (!Array.isArray(updates.faqs)) {
        return res.status(400).json({ msg: "Invalid faqs format" });
      }
    }
  }

  if (updates.jewelryCategory) {
    const catExists = await JewelryCategory.findById(updates.jewelryCategory);
    if (!catExists) {
      return res.status(400).json({ msg: "Invalid category" });
    }
    if (subcategory.jewelryCategory.toString() !== updates.jewelryCategory) {
      await JewelryCategory.findByIdAndUpdate(subcategory.jewelryCategory, {
        $pull: { jewelrySubCategories: jewelrysubCategoryId },
      });

      await JewelryCategory.findByIdAndUpdate(updates.jewelryCategory, {
        $push: { jewelrySubCategories: jewelrysubCategoryId },
      });
    }
  }

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const updatedsubCategoryImage = req.file
    ? {
        fileName: req.file.filename,
        url: `/public/uploads/${
          req.file.filename
        }`,
      }
    : null;

  const payload = updatedsubCategoryImage
    ? { image: updatedsubCategoryImage, ...updates }
    : updates;

  if (updates.name) {
    const newSlug = updates.name.replace(/ /g, "-");
    if (newSlug !== subcategory.slug) {
      const existingSlug = await SubCategory.findOne({
        slug: newSlug,
        _id: { $ne: subcategory._id },
      });
      if (existingSlug) {
        return res.status(400).json({
          message: "Name change failed. This slug already exists.",
        });
      }
      updates.slug = newSlug;
    }
  }

  const updatedsubcategory = await JewelrySubCategory.findByIdAndUpdate(
    jewelrysubCategoryId,
    payload,
    {
      new: true,
    }
  );

  return res.status(200).json({
    msg: "update successfull of jewelry subcategory",
    updatedsubcategory,
    newSlug: updatedsubcategory.slug
  });
});

// API for the all jewelry types which is actually JewelerySubcategory
export const getAllJewelryTypes = asyncHandler(async (req, res) => {
  const { jewelryType } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (jewelryType) {
    filter.name = { $regex: jewelryType, $options: "i" };
  }

  const total = await JewelrySubCategory.countDocuments(filter);

  const subcategories = await JewelrySubCategory.find(filter)
    .populate({
      path: "jewelleries",
      select: "jewelryName price images slug",
      options: {
        skip,
        limit,
      },
    })
    .sort({ createdAt: -1 });

  if (!subcategories.length) {
    return res.status(404).json({
      success: false,
      msg: "No subcategories found",
    });
  }

  return res.status(200).json({
    success: true,
    msg: "Subcategories fetched successfully",
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    subcategories,
  });
});

