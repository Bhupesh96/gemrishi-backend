import asyncHandler from "../utils/asyncHandler.js";
import {Order} from "../models/order.model.js";
import RefundRequest from "../models/RefundRequest.model.js";
import {
	evaluateRefundEligibility,
	computeMaxRefundablePaise,
} from "../utils/policy.js";
import { inPaise } from "../utils/money.js";
import { createRefund } from "../services/razorpay.service.js";

/**
 * USER: Create refund request (no money moved yet)
 * Body: { reason: "damaged"|"defective"|"wrong_item"|"other", amountRequested (₹), description, images[] }
 */
export const createRefundRequest = asyncHandler(async (req, res) => {
	const { orderId } = req.params;
	const { reason, amountRequested, description, images = [] } = req.body;

	const order = await Order.findById(orderId);
	if (!order) return res.status(404).json({ msg: "Order not found" });
	if (order.paymentStatus === "refunded") {
		return res.status(400).json({ msg: "Order already fully refunded" });
	}

	const policy = evaluateRefundEligibility(order, reason);
	const maxRefundablePaise = computeMaxRefundablePaise(order);
	const amountRequestedPaise = amountRequested
		? inPaise(amountRequested)
		: maxRefundablePaise;

	// Cap amountRequested by maxRefundable
	const cappedRequestPaise = Math.min(amountRequestedPaise, maxRefundablePaise);

	const refundReq = await RefundRequest.create({
		orderId: order._id,
		userId: req.user._id,
		reason,
		description,
		images,
		amountRequestedPaise: cappedRequestPaise,
		eligibleByWindow: policy.eligibleByWindow,
		eligibleByType: policy.eligibleByType,
		nonRefundableItem: policy.nonRefundableItem,
		status: policy.eligible ? "pending" : "rejected",
	});

	return res.status(201).json({
		msg: policy.eligible
			? "Refund request submitted"
			: "Refund request rejected by policy",
		policy,
		maxRefundablePaise,
		refundRequest: refundReq,
	});
});

/**
 * ADMIN: Approve a refund request (does not move money yet)
 * Body: { approveAmount (₹) }
 */
export const approveRefundRequest = asyncHandler(async (req, res) => {
	const { refundRequestId } = req.params;
	const { approveAmount } = req.body;

	const rr = await RefundRequest.findById(refundRequestId).populate("orderId");
	if (!rr) return res.status(404).json({ msg: "Refund request not found" });
	if (rr.status !== "pending") {
		return res
			.status(400)
			.json({ msg: `Cannot approve in status ${rr.status}` });
	}

	const order = rr.orderId;
	const maxRefundablePaise = computeMaxRefundablePaise(order);
	const approvedPaise = approveAmount
		? inPaise(approveAmount)
		: rr.amountRequestedPaise;

	if (approvedPaise > maxRefundablePaise) {
		return res
			.status(400)
			.json({ msg: "Approved amount exceeds maximum refundable" });
	}

	rr.amountApprovedPaise = approvedPaise;
	rr.status = "approved";
	rr.reviewedBy = req.user._id;
	rr.reviewedAt = new Date();
	await rr.save();

	return res.status(200).json({ msg: "Refund approved", refundRequest: rr });
});

/**
 * ADMIN: Reject a refund request
 * Body: { note }
 */
export const rejectRefundRequest = asyncHandler(async (req, res) => {
	const { refundRequestId } = req.params;

	const rr = await RefundRequest.findById(refundRequestId);
	if (!rr) return res.status(404).json({ msg: "Refund request not found" });
	if (["approved", "processed", "rejected"].includes(rr.status)) {
		return res
			.status(400)
			.json({ msg: `Cannot reject in status ${rr.status}` });
	}

	rr.status = "rejected";
	rr.reviewedBy = req.user._id;
	rr.reviewedAt = new Date();
	await rr.save();

	return res.status(200).json({ msg: "Refund rejected", refundRequest: rr });
});

/**
 * ADMIN: Process an approved refund (this calls Razorpay and moves money)
 * After success → mark processed, update Order
 */
export const processApprovedRefund = asyncHandler(async (req, res) => {
	const { refundRequestId } = req.params;

	const rr = await RefundRequest.findById(refundRequestId).populate("orderId");
	if (!rr) return res.status(404).json({ msg: "Refund request not found" });
	if (rr.status !== "approved") {
		return res.status(400).json({
			msg: `Refund must be 'approved' to process. Current: ${rr.status}`,
		});
	}

	const order = rr.orderId;

	// Call Razorpay Refund API (supports partial refunds)
	const refundData = await createRefund(
		order.paymentId,
		rr.amountApprovedPaise
	);

	// Update refund request state
	rr.status = "processed";
	rr.gatewayRefundId = refundData.id;
	rr.gatewayPayload = refundData;
	rr.amountProcessedPaise = rr.amountApprovedPaise;
	rr.processedAt = new Date();
	await rr.save();

	// Update order
	if (rr.amountProcessedPaise >= order.amountPaidPaise) {
		order.paymentStatus = "refunded";
		order.orderStatus = "returned"; // or "cancelled" if refund due to cancellation-before-shipment
	} else {
		order.paymentStatus = "partially_refunded";
	}
	await order.save();

	return res.status(200).json({
		msg: "Refund processed successfully",
		refundRequest: rr,
		order,
	});
});

/**
 * OPTIONAL: Get refund(s)
 */
export const getRefundRequestsForOrder = asyncHandler(async (req, res) => {
	const { orderId } = req.params;
	const list = await RefundRequest.find({ orderId }).sort({ createdAt: -1 });
	res.json(list);
});

export const getRefundRequestById = asyncHandler(async (req, res) => {
	const { refundRequestId } = req.params;
	const rr = await RefundRequest.findById(refundRequestId);
	if (!rr) return res.status(404).json({ msg: "Refund request not found" });
	res.json(rr);
});
