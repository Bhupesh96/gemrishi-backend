import mongoose from "mongoose";
import appendDomainPlugin from "../plugins/appendDomain.js";

// need to add more
const retailerStockSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },

    retailerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Retailer",
    },

    certificate: {
      // need to display which certificate he bought
      certificateType: { type: String, required: true },
      price: { type: Number, required: true },
    },

    quantity: {
      type: Number,
      min: [0, "Quantity must be a positive number"],
    },

    buyBackRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyBackRequest",
    }, 

    reviewRating: [
      {
        rating: {
          type: Number,
          default: 0,
          min: [0, "Rating must be positive"],
          max: [5, "Rating must be less than or equal to 5"],
        },
        review: {
          type: String,
        },
        retailerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Retailer",
        },
        image: {
          fileName: String,
          url: String,
        },
        dateAdded: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

retailerStockSchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const RetailerStock = mongoose.model(
  "RetailerStock",
  retailerStockSchema
);
