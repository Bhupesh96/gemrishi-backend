import mongoose from "mongoose";
import appendDomainPlugin from "../plugins/appendDomain.js";

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
    },
    targetAudience: String,
    benefits: {
      type: [String], // ✅ changed from String to Array of String
    },
    qualityLevel: String,
    pricingDetails: String,
    faqs: [
      {
        question: String,
        answer: String,
      },
    ],
    tags: [String],
    image: {
      fileName: { type: String },
      url: { type: String },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  { timestamps: true }
);

subCategorySchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/ /g, "-");
  }
  next();
});

subCategorySchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const SubCategory = mongoose.model("SubCategory", subCategorySchema);
