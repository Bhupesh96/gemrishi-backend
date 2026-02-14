import mongoose from "mongoose";
import appendDomainPlugin from "../plugins/appendDomain.js";

const jewelryCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
    },
    image: {
      fileName: { type: String },
      url: { type: String },
    },
    jewelrySubCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JewelrySubCategory",
      },
    ],
  },
  { timestamps: true }
);

jewelryCategorySchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/ /g, "-");
  }
  next();
});

jewelryCategorySchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const JewelryCategory = mongoose.model(
  "JewelryCategory",
  jewelryCategorySchema
);
