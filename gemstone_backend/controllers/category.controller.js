import { Category } from "../models/category.model.js";
import { SubCategory } from "../models/subcategory.model.js";
import asyncHandler from "../utils/asyncHandler.js";

const filesUploadPath = process.env.FILES_UPLOAD_PATH;

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const filesUploadPath = process.env.FILES_UPLOAD_PATH;
  const category = new Category({
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

  await category.save();

  return res.status(200).json({
    msg: "Category created sucessfully",
    category,
  });
});

export const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().populate("subCategories");
  if (categories.length === 0) {
    return res.status(404).json({ msg: "No category found" });
  }

  return res.status(200).json({
    msg: "categories fetched succesfully",
    categories,
  });
});

export const getSingleCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const category = await Category.findOne({ slug });
  if (!category) {
    return res.status(404).json({ msg: "No category found" });
  }

  return res.status(200).json({
    msg: "Single category fetched",
    category,
  });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const updateData = req.body;
  const { categoryId } = req.params;

  const category = await Category.findById(categoryId)

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
      const existingSlug = await Category.findOne({ slug: newSlug });
      if (existingSlug) {
        return res.status(400).json({
          message: "Name change failed. This slug already exists.",
        });
      }
      updateData.slug = newSlug;
    }
  }

  const updatedCategory = await Category.findByIdAndUpdate(categoryId, payload, {
    new: true,
  });

  return res.status(200).json({
    msg: "Category updated successfully",
    updatedCategory,
  });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  // ✅ Find category first
  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({ msg: "No category found" });
  }

  // ✅ Delete subcategories linked to this category
  await SubCategory.deleteMany({ category: categoryId });

  // ✅ Delete the category itself
  await Category.findByIdAndDelete(categoryId);

  return res.status(200).json({
    msg: "Category and related subcategories deleted successfully",
    deletedCategory: category, // optional, if you want to return info
  });
});

