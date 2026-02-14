
import asyncHandler from "../utils/asyncHandler.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import mongoose from "mongoose";
import { Jewelry } from "../models/jewelry.model.js";
import { Product } from "../models/product.model.js";
import { Order } from "../models/order.model.js";
import { MetalRates } from "../models/metalRates.model.js";

import uploadPath from "../utils/uploadPaths.js"; // <-- Import the uploadPath object for file uploads



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


// add review and rating for the product (gemstone and jewelry)
const addReviewRating = asyncHandler(async (req, res) => {

	const { productId, rating, review } = req.body;
	console.log(req.body);
	console.log(req.file);

	const reviewImageUpload = uploadPath.reviewImageUpload;

	if (!productId || !rating || !review) {
		deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded if field is missing
		return res.status(400).json({ success: false, message: "All fields are required." });
	}

	// check if id exist in jewelery model or product model
	const gemstoneCheck = await Product.exists({ _id: productId });
	const jeweleryCheck = await Jewelry.exists({ _id: productId });

	if (!gemstoneCheck && !jeweleryCheck) {
		deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded files
		return res.status(400).json({ success: false, filed: "productId", message: "productId does not exist in either Product or Jewelry model." });
	}

	const checkReviewModel = gemstoneCheck ? Product : Jewelry;

    // Prevent duplicate review by same user for Product model
	const existingReview = await checkReviewModel.findOne(
		{_id: productId,	"reviewRating.userId": req.user._id,},
		{ reviewRating: { $elemMatch: { userId: req.user._id } } },
	).populate("reviewRating.userId", "fullName email profilePic").lean();
	if (existingReview) {
		deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded files
		return res.status(400).json({
			success: false,
			message: `You have already reviewed this ${gemstoneCheck ? "Product" : "Jewelry"} and Can not do it again`,
			existingReview,
		});
	}

	let updatedProduct;
	let isPurchased = false;

	if (gemstoneCheck) {

		const order = await Order.findOne({
			"items.productId": productId,
			"items.quantity": { $gt: 0 },
			userId: req.user._id,
		});

		console.log("Order found for gemstoneCheck:", order);

		if (!order) {
			isPurchased = true;
			deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded files
			return res.status(400).json({ success: false, message: "You have not purchased this product, You can't give Review Rating to Product." });
		}

		if(order.orderStatus == "Pending" || order.orderStatus == "InProgress"){
			isPurchased = true;
			deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded files
			return res.status(400).json({ success: false, message: "Your order is in progress, You can give Review Rating to Product After the product is delivered." });
		}

		if(order.orderStatus == "Cancelled"){
			isPurchased = true;
			deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded files
			return res.status(400).json({ success: false, message: "Your order is Cancelled, You can't give Review Rating to Product." });
		}

	} else
	if(jeweleryCheck) {

		const order = await Order.findOne({
			$or: [
				{ "items.jewelryId": productId },
				{ "items.customization.jewelryId": productId }
			],
			"items.quantity": { $gt: 0 },
			userId: req.user._id,
		});

		if (!order) {
			isPurchased = true;
			deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded files
			return res.status(400).json({ success: false, message: "You have not purchased this jewelry product, You can't give Review Rating to Product." });
		}

		if(order.orderStatus == "Pending" || order.orderStatus == "InProgress"){
			isPurchased = true;
			deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded files
			return res.status(400).json({ success: false, message: "Your order is in progress, You can give Review Rating to Product After the product is delivered." });
		}

		if(order.orderStatus == "Cancelled"){
			isPurchased = true;
			deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded files
			return res.status(400).json({ success: false, message: "Your order is Cancelled, You can't give Review Rating to Product." });
		}

	}

	// if (!req.file) {
	// 	deleteUploadedFiles(req, reviewImageUpload); // Clean up uploaded file
	// 	return res.status(400).json({ message: "Image is required." });
	// }

	const imagePath = reviewImageUpload.replace("../", "/");

	const reviewData = {
		rating: rating,
		review: review,
		userId: req.user._id,
		image: {
			fileName: req.file ? req.file.filename : null,
			url: req.file ? `${imagePath}${req.file.filename}` : null,
		},
	};

	const modelToUpdate = gemstoneCheck ? Product : Jewelry;

	updatedProduct = await modelToUpdate.findByIdAndUpdate(
		productId,
		{ $push: { reviewRating: reviewData } },
		{ new: true } // This option returns the modified document
	);

	if (!updatedProduct) {
		deleteUploadedFiles(req, reviewImageUpload);
		return res.status(404).json({ success: false, message: "Product or Jewelry not found during update." });
	}

	return res.status(200).json({
		success: true,
		msg: "rating and review added successfully",
		reviewData,
	});

});



// Get All The review and rating for the product (gemstone or jewelry)
const getAllReviewRating = asyncHandler(async (req, res) => {

	const { productId, page = 1, limit = 10 } = req.query;

	if (!productId) {
		return res.status(400).json({ success: false, message: "productId is required." });
	}

	const pageNum = parseInt(page, 10);
	const limitNum = parseInt(limit, 10);
	const skip = (pageNum - 1) * limitNum;

	// Check if id exists in Jewelry model or Product model
	const isProduct = await Product.exists({ _id: productId });
	const isJewelry = await Jewelry.exists({ _id: productId });

	if (!isProduct && !isJewelry) {
		return res.status(404).json({ success: false, message: "Item not found." });
	}

	let Model;
	if (isProduct) {
		Model = Product;
	} else {
		Model = Jewelry;
	}

	const totalReviewsResult = await Model.aggregate(
		[
			{
			$match: {
				_id: mongoose.Types.ObjectId.createFromHexString(productId)
			}
			},
			{
			$project: {
				totalReviews: { $size: '$reviewRating' }
			}
			}
		],
		);

	const totalReviews = totalReviewsResult.length > 0 ? totalReviewsResult[0].totalReviews : 0;

	if (totalReviews === 0) {
		return res.status(200).json({
			success: true,
			message: "No reviews found for this item.",
			totalPages: 0,
			totalReviews: 0,
			currentPage: pageNum,
			reviews: [],
		});
	}

	// Aggregation to get paginated reviews and populate user details
	const paginatedReviewsResult = await Model.aggregate([
		{ $match: { _id: mongoose.Types.ObjectId.createFromHexString(productId) } },
		{
			$project: {
				paginatedReviews: { $slice: [`$reviewRating`, skip, limitNum] }
			}
		},
		{ $unwind: "$paginatedReviews" },
		{
			$lookup: {
				from: "users",
				let: { userId: "$paginatedReviews.userId" },
				pipeline: [
					{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
					{
						$project: {
							_id: 1,
							fullName: 1,
							profilePic: 1,
						},
					},
				],
				as: "paginatedReviews.userDetails"
			},
		},
		{ $unwind: { path: "$paginatedReviews.userDetails", preserveNullAndEmptyArrays: true } },
		{
			$group: {
				_id: "$_id",
				reviews: { $push: "$paginatedReviews" }
			}
		}
	]);

	const paginatedReviews = paginatedReviewsResult.length > 0 ? paginatedReviewsResult[0].reviews : [];

	return res.status(200).json({
								success: true,
								message: "Reviews fetched successfully.",
								totalReviews,
								totalPages: Math.ceil(totalReviews / limitNum),
								currentPage: pageNum,
								reviews: paginatedReviews,
							});
});

// function to get metal rates
async function getMetalRates(){
  const latestMetalRates = await MetalRates.findOne().sort({ createdAt: -1 }).lean();
  // console.log(latestMetalRates);
  return latestMetalRates
}

export const getAllReviews = async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    let skip = (page - 1) * limit;

    // Product reviews
    const productReviewsQuery = Product.aggregate([
      { $unwind: "$reviewRating" },
      {
        $project: {
          type: "product",
          itemId: "$_id",
          name: "$name",
          review: "$reviewRating",
          createdAt: "$reviewRating.dateAdded",
        },
      },
    ]);

    // Jewelry reviews
    const jewelryReviewsQuery = Jewelry.aggregate([
      { $unwind: "$reviewRating" },
      {
        $project: {
          type: "jewelry",
          itemId: "$_id",
          name: "$jewelryName",
          review: "$reviewRating",
          createdAt: "$reviewRating.dateAdded",
        },
      },
    ]);

    // Run in parallel → faster
    const [productReviews, jewelryReviews] = await Promise.all([
      productReviewsQuery,
      jewelryReviewsQuery,
    ]);

    // Merge both
    let allReviews = [...productReviews, ...jewelryReviews];

    // Sort by newest first
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Total count
    const total = allReviews.length;

    // Apply pagination
    const paginated = allReviews.slice(skip, skip + limit);

    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      reviews: paginated,
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};



// Get Best Seller Product (Gemstone) and Jewelry
const getAllBestSeller = asyncHandler(async (req, res) => {

	const { page = 1, limit = 10, type = 'jewelry' } = req.query;

	const pageNum = parseInt(page, 10);
	const limitNum = parseInt(limit, 10);
	const skip = (pageNum - 1) * limitNum;

	let Model;
	if (type.toLowerCase() === 'product') {
		Model = Product;
	} else if (type.toLowerCase() === 'jewelry') {
		Model = Jewelry;
	} else {
		return res.status(400).json({ success: false, message: "Invalid 'type' parameter. Use 'product' or 'jewelry'." });
	}

	const pipeline = [
		// Unwind the reviewRating array to process each review
		{ $unwind: "$reviewRating" },
		// Group by product/jewelry ID to calculate average rating and review count
		{
			$group: {
				_id: "$_id",
				averageRating: { $avg: "$reviewRating.rating" },
				reviewCount: { $sum: 1 },
				// Keep the first document's data for other fields
				doc: { $first: "$$ROOT" }
			}
		},
		// Sort by average rating (descending) and then by review count (descending)
		{ $sort: { averageRating: -1, reviewCount: -1 } },
		// Pagination: skip and limit
		{ $skip: skip },
		{ $limit: limitNum },
		// Replace the root with the original document data, and add calculated fields
		{
			$replaceRoot: {
				newRoot: {
					$mergeObjects: ["$doc", { averageRating: "$averageRating", reviewCount: "$reviewCount" }]
				}
			}
		},
		// Exclude the full reviewRating array from the final output to keep it clean
		{ $project: { reviewRating: 0, wishlistedBy: 0 } }
	];

	const bestSellers = await Model.aggregate(pipeline);

	// To get the total count for pagination, we run a similar pipeline without skip/limit
	const totalCountPipeline = [
		{ $unwind: "$reviewRating" },
		{ $group: { _id: "$_id" } },
		{ $count: "total" }
	];
	const totalResult = await Model.aggregate(totalCountPipeline);
	const total = totalResult.length > 0 ? totalResult[0].total : 0;

	return res.status(200).json({
		success: true,
		message: `Best rated ${type}s fetched successfully.`,
		total,
		totalPages: Math.ceil(total / limitNum),
		currentPage: pageNum,
		metalRates: await getMetalRates(),
		data: bestSellers,
	});
});



export {
	addReviewRating,
	getAllReviewRating,
	getAllBestSeller,
}







/**


	addReviewRating()		- Add review and rating for the products (gemstone and jewelery)	DONE
	getAllReviewRating()	- Get all reviews and ratings for a product or jewelry.				DONE
	getAllBestSeller()		- Get all best seller products from rating.							DONE


	delete review prnding


 */