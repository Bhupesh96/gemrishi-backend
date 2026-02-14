
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { emailSub } from "../models/emailSub.model.js";


// add email for subscription
const addEmailSub = asyncHandler(async (req, res) => {

	const { email } = req.body;

	if (!email) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "Email fields is required."
		});
	}

	const emailSubData = await emailSub.findOne({email: email});

	if (emailSubData && emailSubData.isActive === true) {
		return res.status(200).json({
			success: true,
			field: "email",
			message: "Email already subscribed."
		});
	}

	if (emailSubData && emailSubData.isActive === false) {
		emailSubData.isActive = true;
		const updatedEmailSub = await emailSubData.save();
		return res.status(200).json({
			success: true,
			emailSub: updatedEmailSub,
			message: "Email subscribed successfully."
		});
	}

	const newEmailSub = await emailSub.create({ email: email, isActive: true });

	return res.status(200).json({
		success: true,
		emailSub: newEmailSub,
		message: "Email subscribed successfully."
	});

});


// remove email for subscription
const removeEmailSub = asyncHandler(async (req, res) => {

	const { email, reason } = req.body;

	if (!email) {
		return res.status(400).json({ success: false, field: "email", message: "Email fields is required." });
	}

	const emailSubData = await emailSub.findOne({email: email});

	if (!emailSubData) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "Email not found or not subscribed yet."
		});
	}

	if (emailSubData && emailSubData.isActive === false) {
		emailSubData.unsubReason = reason || emailSubData.unsubReason || "";
		const updatedEmailSub = await emailSubData.save();
		return res.status(200).json({
			success: true,
			emailSub: updatedEmailSub,
			message: "Email Unubscribed successfully."
		});
	}

	emailSubData.isActive = false;
	emailSubData.unsubReason = reason || emailSubData.unsubReason || "";
	const updatedEmailSub = await emailSubData.save();

	return res.status(200).json({
		success: true,
		emailSub: updatedEmailSub,
		message: "Email Unsubscribed successfully."
	});

});


// Get all sub and unsub email with pagination
const getAllSubEmailList = asyncHandler(async (req, res) => {

	const { isActive, page = 1, limit = 10 } = req.query;

	const isActive_options = ["true", "false", "all"];

	if (!isActive || !isActive_options.includes(isActive) || !page) {
		return res.status(400).json({
			success: false,
			field: `${!isActive || !isActive_options.includes(isActive) ? "isActive, " : ""}${!page ? "page" : ""}`,
			required: isActive_options,
			message: `${!isActive ? "isActive is required, " : ""}${!isActive_options.includes(isActive) ? "Invalid isActive value. Please provide either 'true' or 'false' or 'all', " : ""}isActive: ${isActive }, ${!page ? "page is required" : ""}.`
		});
	}

	const pageNum = parseInt(page, 10);
	const limitNum = parseInt(limit, 10);
	const skip = (pageNum - 1) * limitNum;

	let emailSubDataList;
	let totalEmails;

	if(isActive == "true" || isActive == "false" || isActive == true || isActive == false) {
		totalEmails = await emailSub.countDocuments({isActive: isActive});
		emailSubDataList = await emailSub.find({isActive: isActive}).skip(skip).limit(limit).sort({createdAt: -1});
	}

	if(isActive == "all" || !isActive || isActive == "" || (isActive != "true" && isActive != "false" && isActive != true && isActive != false)) {
		totalEmails = await emailSub.countDocuments();
		emailSubDataList = await emailSub.find().skip(skip).limit(limit).sort({createdAt: -1});
	}

	return res.status(200).json({
		success: true,
		message: "Emails list fetched successfully.",
		totalEmails,
		totalPages: Math.ceil(totalEmails / limitNum),
		currentPage: pageNum,
		emailSubDataList: emailSubDataList,
	});

});


// Delete email from subscription list
const deleteEmailSub = asyncHandler(async (req, res) => {

	const { email } = req.query;

	if (!email) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "email is required."
		});
	}

	const emailSubData = await emailSub.exists({email: email});

	if (!emailSubData) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "Email not found or not subscribed yet."
		});
	}

	const deletedEmailSub = await emailSub.deleteOne({email: email});

	if (!deletedEmailSub) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "Email not found or not subscribed yet."
		});
	}
	return res.status(200).json({
		success: true,
		message: "Email: " + email + " Deleted successfully.",
		emailSubData: deletedEmailSub,
	});

});

// Download active emails as CSV
const downloadActiveEmailsCSV = asyncHandler(async (req, res) => {
	// 1. Fetch only active subscribers from the database
	const activeEmails = await emailSub.find({ isActive: true }).select("email createdAt").lean();

	if (!activeEmails || activeEmails.length === 0) {
		return res.status(404).json({
			success: false,
			message: "No active email subscribers found to download."
		});
	}

	// 2. Create CSV content
	const csvHeader = "Email,SubscribedAt\n";
	const csvRows = activeEmails.map(row =>
		`${row.email},${row.createdAt.toISOString()}`
	).join("\n");

	const csvData = csvHeader + csvRows;

	// 3. Set headers for file download
	res.header('Content-Type', 'text/csv');
	res.attachment('active-subscribers.csv');

	// 4. Send the CSV data as the response
	res.status(200).send(csvData);
});




export {
	addEmailSub,
	removeEmailSub,
	getAllSubEmailList,
	deleteEmailSub,
	downloadActiveEmailsCSV,
}





/**


	addEmailSub()			- Add Email to Subscription						DONE
	removeEmailSub()		- Remove Email to Subscription					DONE
	getAllSubEmailList()	- Get all Emails to Subscription				DONE
	deleteEmailSub()		- Delete Email From Subscription				DONE
	downloadActiveEmailsCSV()- Export isActive true Email to CSV file		DONE




 */