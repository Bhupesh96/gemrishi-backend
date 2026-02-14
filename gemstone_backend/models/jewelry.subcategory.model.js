import mongoose from "mongoose";
import appendDomainPlugin from "../plugins/appendDomain.js";

const jewelrySubCategorySchema = new mongoose.Schema(
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
    about: String,
    meaning: String,
    buyerGuide: String,
    qualityAndPrice: String,
    faqs: [
      {
        question: String,
        answer: String,
      },
    ],
    image: {
      fileName: { type: String },
      url: { type: String },
    },
    jewelryCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JewelryCategory",
    },
    // jewelleries: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Jewelry",
    //   },
    // ],
  },
  { timestamps: true }
);

jewelrySubCategorySchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/ /g, "-");
  }
  next();
});

jewelrySubCategorySchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const JewelrySubCategory = mongoose.model(
  "JewelrySubCategory",
  jewelrySubCategorySchema
);
