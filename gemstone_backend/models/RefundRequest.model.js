//RefundRequest.model.js

import mongoose from "mongoose";

const RefundRequestSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        reason: {
            type: String,
            enum: ["damaged", "defective", "wrong_item", "other"],
            required: true,
        },
        description: { type: String },
        images: [{ type: String }],

        // amounts in paise
        amountRequestedPaise: { type: Number, required: true },
        amountApprovedPaise: { type: Number, default: 0 },
        amountProcessedPaise: { type: Number, default: 0 },

        // state machine
        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "processed"],
            default: "pending",
        },

        // audit / meta
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reviewedAt: { type: Date },
        processedAt: { type: Date },

        // Razorpay response snapshot
        gatewayRefundId: { type: String },
        gatewayPayload: { type: Object },

        // policy flags for traceability
        eligibleByWindow: { type: Boolean, default: false },
        eligibleByType: { type: Boolean, default: false },
        nonRefundableItem: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export default mongoose.model("RefundRequest", RefundRequestSchema);
