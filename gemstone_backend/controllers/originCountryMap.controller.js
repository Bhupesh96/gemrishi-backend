import asyncHandler from "../utils/asyncHandler.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { originCountryMap } from "../models/originCountryMap.model.js";

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
const addCountry = asyncHandler(async (req, res) => {

	try {

		const { countryCode, countryName, description } = req.body;

		const countryMapImageUploadPath = uploadPath.countryMapImageUpload;

		if (! countryCode|| !countryName || !description) {
			deleteUploadedFiles(req, countryMapImageUploadPath); // Clean up uploaded if field is missing
			return res.status(400).json({ message: "All fields are required. (countryName, countryCode, description and image)" });
		}

		const checkCountryCode = await originCountryMap.findOne({
			countryCode: { $regex: `^${countryCode}$`, $options: "i" },
		});

		if (checkCountryCode) {
			deleteUploadedFiles(req, countryMapImageUploadPath); // Clean up uploaded if field is missing
			return res.status(400).json({ success: false, message: `Country with this Country Code: ${countryCode} already exists.` });
		}

		const checkCountry = await originCountryMap.findOne({
			countryName: { $regex: `^${countryName}$`, $options: "i" },
		});

		if (checkCountry) {
			deleteUploadedFiles(req, countryMapImageUploadPath); // Clean up uploaded if field is missing
			return res.status(400).json({ success: false, message: `Country with this countryName: ${countryName} already exists.` });
		}

		if (!req.file) {
			deleteUploadedFiles(req, countryMapImageUploadPath); // Clean up uploaded if field is missing
			return res.status(400).json({ success: false, message: "Country Map image is required." });
		}

		const imagePath = countryMapImageUploadPath.replace("../", "/");

		const filesUploadPath = process.env.FILES_UPLOAD_PATH;
		const originCountryMapData = await originCountryMap.create({
			countryName,
			countryCode,
			description: description,
			image: {
				fileName: req.file ? req.file.filename : null,
				url: req.file ? `${imagePath}${req.file.filename}` : null,
			},
		});

		await originCountryMapData.save();

		return res.status(200).json({
			success: true,
			message: "Origin Country Map Created Successfully.",
			countryData: originCountryMapData
		});
	}
	catch (err) {
		return res.status(500).json({ success: false, message: err.message || 'failed to create origin country map' });
	}

});


// Update country
const updateCountry = asyncHandler(async (req, res) => {

	try {

		const { id, countryCode, countryName, description } = req.body; // id from body

		const countryMapImageUploadPath = uploadPath.countryMapImageUpload;

		if (!id) {
			deleteUploadedFiles(req, countryMapImageUploadPath);
			return res.status(400).json({ success: false, message: "Country ID is required." });
		}

		const countryToUpdate = await originCountryMap.findById(id);

		if (!countryToUpdate) {
			deleteUploadedFiles(req, countryMapImageUploadPath);
			return res.status(404).json({ success: false, message: "Country not found." });
		}

		// If countryName is being updated, check if the new name already exists for another country
		if (countryName && countryName.toLowerCase() !== countryToUpdate.countryName.toLowerCase()) {
			const existingCountry = await originCountryMap.findOne({
				countryName: { $regex: `^${countryName}$`, $options: "i" },
				_id: { $ne: id }
			});

			if (existingCountry) {
				deleteUploadedFiles(req, countryMapImageUploadPath);
				return res.status(400).json({ success: false, message: `Another country with the name '${countryName}' already exists.` });
			}
			countryToUpdate.countryName = countryName;
		}

		// If countryCode is being updated, check if the new code already exists for another country
		if (countryCode && countryCode.toLowerCase() !== countryToUpdate.countryCode.toLowerCase()) {
			const existingCountryCode = await originCountryMap.findOne({
				countryCode: { $regex: `^${countryCode}$`, $options: "i" },
				_id: { $ne: id }
			});

			if (existingCountryCode) {
				deleteUploadedFiles(req, countryMapImageUploadPath);
				return res.status(400).json({ success: false, message: `Another country with the code '${countryCode}' already exists.` });
			}
			countryToUpdate.countryCode = countryCode;
		}

		countryToUpdate.description = description || countryToUpdate.description;

		// Handle image update
		if (req.file) {
			// Delete old image if it exists
			if (countryToUpdate.image && countryToUpdate.image.fileName) {
				const oldPath = path.join(__dirname, countryMapImageUploadPath, countryToUpdate.image.fileName);
				if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
			}

			const filesUploadPath = process.env.FILES_UPLOAD_PATH;
			// Set new image
			const imagePath = countryMapImageUploadPath.replace("../", "/");
			countryToUpdate.image.fileName = req.file.filename;
			countryToUpdate.image.url = `${imagePath}${req.file.filename}`;
		}

		const updatedCountry = await countryToUpdate.save();

		return res.status(200).json({ success: true, message: "Country updated successfully.", countryData: updatedCountry });
	}
	catch (err) {
		return res.status(500).json({ success: false, message: err.message || 'failed to update origin country map' });
	}

});


// Get all Country list
const getAllCountryList = asyncHandler(async (req, res) => {

	try {
		const allCountryList = await originCountryMap.find().sort({ countryName: 1 });

		return res.status(200).json({
			success: false,
			message: "Country List Fetched Successfully.",
			countryList: allCountryList,
		});

	} catch (err) {
		return res.status(500).json({ success: false, message: "Server error.", error: err.message });
	}

});


// Get all Country list
const getCountryDetails = asyncHandler(async (req, res) => {

	try {
		const { id, countryName, countryCode } = req.query;

		// require either id or countryName or countryCode
		if (!id && !countryName && !countryCode) {
			return res.status(400).json({ success: false, message: "Provide either 'id' or 'countryName' as a query parameter." });
		}

		let countryData = null;

		// If an id is provided and it's a valid ObjectId, look up by _id
		if (id) {
			countryData = await originCountryMap.findById(id).lean();
		}else
		if (countryCode) {
			// Otherwise look up by countryCode (case-insensitive exact match)
			countryData = await originCountryMap
				.findOne({ countryCode: { $regex: `^${countryCode}$`, $options: "i" } })
				.lean();
		}else
		if (countryName) {
			// Otherwise look up by countryName (case-insensitive exact match)
			countryData = await originCountryMap
				.findOne({ countryName: { $regex: `^${countryName}$`, $options: "i" } })
				.lean();
		}

		if (!countryData) {
			return res.status(404).json({
				success: false,
				message: "Country Not Found",
			});
		}

		return res.status(200).json({
			success: false,
			message: "Country Fetched Successfully.",
			countryData: countryData,
		});

	} catch (err) {
		return res.status(500).json({ success: false, message: "Server error.", error: err.message });
	}

});


// Delete banner
const deleteCountry = asyncHandler(async (req, res) => {

	try {
		const id = req.query.id;

		const countryData = await originCountryMap.findById(id);

		if (!countryData) {
			return res.status(404).json({ success: false, message: "Country not found." });
		}

		const countryMapImageUpload = uploadPath.countryMapImageUpload;

		const oldPath = path.join(__dirname, countryMapImageUpload, countryData.image.fileName);

		if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

		const deletedCountry = await originCountryMap.findByIdAndDelete(id);

		return res.status(200).json({
			success: true,
			message: "Country Deleted successfully.",
			deletedCountry: deletedCountry,
		});

	} catch (err) {
		return res.status(500).json({ success: false, message: "Server error.", error: err.message });
	}


});


export {

	addCountry,
	updateCountry,
	getAllCountryList,
	getCountryDetails,
	deleteCountry,

};

/**

	addCountry()        	- add country	                        DONE
	getAllCountryList()     - get all country list					DONE
	getCountryDetails()     - get sigle country						DONE
	updateCountry()      	- update country						DONE
	deleteCountry()      	- delete country						DONE

 */
