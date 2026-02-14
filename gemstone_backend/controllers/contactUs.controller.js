
import asyncHandler from "../utils/asyncHandler.js";
import { contactUs } from "../models/contactUs.model.js";
import { sendEmail } from "../utils/sendEmails.js";


// contact us email sender api
const contactUsForm = asyncHandler(async (req, res) => {
	const { name, email, gemstoneHelp, message } = req.body;

	if (!name || !email || !gemstoneHelp || !message) {
		return res.status(400).json({ success: false, msg: "All fields are required." });
	}

	// Save the contact details to the database
	await contactUs.create({
		name,
		email,
		gemstoneHelp,
		message,
	});

	const html = `<div style="font-family: Arial, sans-serif; padding: 10px;">
					<h2 style="color: #333;">Contact Us</h2>
					<p>Hi Gemrishi Team, I would like to contact you regarding the following:</p>
					<br>
					<p>Name: ${name}</p>
					<p>Email: ${email}</p>
					<p>Subject: ${gemstoneHelp}</p>
					<p>Message: ${message}</p>
				</div>`;

	await sendEmail({
		to: process.env.CONTACT_EMAIL,
		subject: `Contact Us - ${gemstoneHelp}`,
		html: html,
	});

	return res.status(200).json({
		success: true,
		msg: "Email sent successfully.",
	});
});

// Get all contact us entries with pagination and filtering
const getAllContactUsList = asyncHandler(async (req, res) => {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 10;
	const { gemstoneHelp } = req.query;
	const skip = (page - 1) * limit;

	const query = {};

	if (gemstoneHelp) {
		query.gemstoneHelp = { $regex: gemstoneHelp, $options: "i" };
	}

	const total = await contactUs.countDocuments(query);

	if (total === 0) {
		return res.status(200).json({
			success: true,
			message: "No contact us entries found.",
			totalItems: 0,
			totalPages: 0,
			currentPage: 1,
			data: [],
		});
	}

	const entries = await contactUs.find(query)
		.sort({ createdAt: -1 })
		.skip(skip)
		.limit(limit);

	return res.status(200).json({
		success: true,
		message: "Contact us entries fetched successfully.",
		totalItems: total,
		totalPages: Math.ceil(total / limit),
		currentPage: page,
		data: entries,
	});
});

// Get a single contact us entry by ID
const contactUsDetails = asyncHandler(async (req, res) => {
	const { id } = req.query;

	if (!id) {
		return res.status(400).json({
			success: false,
			message: "Contact Us entry ID is required.",
		});
	}

	const entry = await contactUs.findById(id);

	if (!entry) {
		return res.status(404).json({
			success: false,
			message: "Contact Us entry not found.",
		});
	}

	return res.status(200).json({
		success: true,
		message: "Contact Us entry fetched successfully.",
		data: entry,
	});
});

// Delete a contact us entry
const deleteContactUs = asyncHandler(async (req, res) => {
	const { id } = req.query;

	if (!id) {
		return res.status(400).json({
			success: false,
			message: "Contact Us entry ID is required.",
		});
	}

	const entry = await contactUs.findByIdAndDelete(id);

	if (!entry) {
		return res.status(404).json({
			success: false,
			message: "Contact Us entry not found.",
		});
	}

	return res.status(200).json({
		success: true,
		message: "Contact Us entry deleted successfully.",
		deletedEntry: entry,
	});
});



export {
	contactUsForm,
	getAllContactUsList,
	contactUsDetails,
	deleteContactUs,
};



/**


	contactUsForm()           	- sends email and store the info in db         DONE
	getAllContactUsList()		- get all contact us entries with pagination   DONE
	contactUsDetails()          - get a single contact us entry by id      DONE
	deleteContactUs()           - delete a contact us entry by id          DONE



*/