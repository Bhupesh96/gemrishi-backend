import mongoose from "mongoose";
import appendDomainPlugin from "../plugins/appendDomain.js";

const categorySchema = new mongoose.Schema(
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
    subCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory',
      },
    ],
  },
  { timestamps: true }
);

categorySchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/ /g, "-");
  }
  next();
});

categorySchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const Category = mongoose.model("Category", categorySchema);
