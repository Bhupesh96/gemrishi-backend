import mongoose from "mongoose";

const buyBackRequestSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    retailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Retailer",
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        quantity: {
          type: Number,
          default: 1,
        },
        customization: {
          certificate: {
            certificateType: {
              type: String,
            },
            price: {
              type: Number,
            },
          },
        },
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Completed"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export const BuyBackRequest = mongoose.model(
  "BuyBackRequest",
  buyBackRequestSchema
);
