import { Category } from "../models/category.model.js";
import { JewelryCategory } from "../models/jewelry.category.model.js";
import { JewelrySubCategory } from "../models/jewelry.subcategory.model.js";
import { SubCategory } from "../models/subcategory.model.js";
import asyncHandler from "../utils/asyncHandler.js";

const filesUploadPath = process.env.FILES_UPLOAD_PATH;


export const createJewelryCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const jewelryCategory = new JewelryCategory({
    name,
    description,
    image: {
      fileName: req.file ? req.file.filename : "",
      url: req.file
        ? `/public/uploads/${
            req.file.filename
          }`
        : null,
    },
  });

  await jewelryCategory.save();

  return res.status(200).json({
    msg: "Category created sucessfully",
    jewelryCategory,
  });
});

export const getAllJewelryCategories = asyncHandler(async (req, res) => {
  const jewelryCategories = await JewelryCategory.find().populate(
    "jewelrySubCategories"
  );
  if (jewelryCategories.length === 0) {
    return res.status(404).json({ msg: "No category found" });
  }

  return res.status(200).json({
    msg: "categories fetched succesfully",
    jewelryCategories,
  });
});

export const getSingleJewelryCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const jewelryCategory = await JewelryCategory.findOne({ slug });
  if (!jewelryCategory) {
    return res.status(404).json({ msg: "No category found" });
  }

  return res.status(200).json({
    msg: "Single category fetched",
    jewelryCategory,
  });
});

export const updateJewelryCategory = asyncHandler(async (req, res) => {
  const updateData = req.body;
  const { jewelryCategoryId } = req.params;

  const category = await JewelryCategory.findById(jewelryCategoryId);

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const updatedCategoryImage = req.file
    ? {
        fileName: req.file.filename,
        url: `/public/uploads/${
          req.file.filename
        }`,
      }
    : null;

  const payload = updatedCategoryImage
    ? { image: updatedCategoryImage, ...updateData }
    : updateData;

  if (updateData.name) {
    const newSlug = updateData.name.replace(/ /g, "-");
    if (newSlug !== category.slug) {
      const existingSlug = await JewelryCategory.findOne({ slug: newSlug });
      if (existingSlug) {
        return res.status(400).json({
          message: "Name change failed. This slug already exists.",
        });
      }
      updateData.slug = newSlug;
    }
  }

  const updatedCategory = await JewelryCategory.findByIdAndUpdate(
    jewelryCategoryId,
    payload,
    {
      new: true,
    }
  );

  return res.status(200).json({
    msg: "Category updated successfully",
    updatedCategory,
  });
});

export const deleteJewelryCategory = asyncHandler(async (req, res) => {
  const { jewelryCategoryId } = req.params;

  const category = await JewelryCategory.findById(jewelryCategoryId);
  if (!category) {
    return res.status(404).json({ msg: "No category found" });
  }

  await JewelrySubCategory.deleteMany({ jewelryCategory: jewelryCategoryId });

  await JewelryCategory.findByIdAndDelete(jewelryCategoryId);

  return res.status(200).json({
    msg: "Category and associated subcategories deleted successfully",
  });
});
