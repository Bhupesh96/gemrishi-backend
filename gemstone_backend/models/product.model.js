import mongoose from "mongoose";
import { type } from "os";
import appendDomainPlugin from "../plugins/appendDomain.js";
// need to add more
const productSchema = new mongoose.Schema(
  {

    sku: {
      type: String,
      required: true,
      unique: true
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    origin: {
      type: String,
      required: [true, "Origin is required"],
      trim: true,
    },
    carat: {
      type: Number,
      required: [true, "Carat is required"],
      min: [0, "Carat must be a positive number"],
    },
    ratti: {
      type: Number,
      required: [true, "Ratti is required"],
      min: [0, "Ratti must be a positive number"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be a positive number"],
    },
    certificate: [
      {
        certificateType: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],
    weight: {
      type: Number,
      required: false,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    images: [
      {
        fileName: String,
        url: String,
      },
    ],
    videos: [
      {
        fileName: String,
        url: String,
      },
    ],treatment
    : { type: String, required: false },
    shape: { type: String, required: false },
    color: { type: String, required: false },
    cut: { type: String, required: false },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },
    stock: {
      type: Number,
      min: [0, "Stock must be positive"],
    },
    orderCount: {
      type: Number,
    },
    offerId: {
      type: String,
    },
    sellPrice: {
      type: Number,
    },
    deliveryDays: {
      type: Number,
    },

    wishlistedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],

    upSellingProductSKU: [
      {
        type: String,
      }
    ],

    reviewRating: [{
      rating: {
        type: Number,
        default: 0,
        min: [0, "Rating must be positive"],
        max: [5, "Rating must be less than or equal to 5"],
      },
      review: {
        type: String,
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      image: {
        fileName: String,
        url: String,
      },
      dateAdded: {
        type: Date,
        default: Date.now,
      },
    }],



  },
  { timestamps: true }
);

productSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/ /g, "-") + "-" + this.sku.toLowerCase().replace(/\//g, "");
  }
  next();
});

productSchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const Product = mongoose.model("Product", productSchema);
