import mongoose from "mongoose";
import appendDomainPlugin from "../plugins/appendDomain.js";

const retailerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      trim: true,
    },
    mobileNo: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    profilePic: {
      fileName: String,
      url: String,
    },
    address: [
      {
        type: String,
        required: true,
      }
    ],
    country: {
      type: String,
      required: false,
    },
    resetPasswordOtp: {
      type: String,
      required: false,
    },
    resetPasswordExpires: {
      type: Date,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    cart: [
      {
        itemType: {
          type: String,
          enum: ["Product", "Jewelry"],
          required: true,
        },
        item: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          refPath: "cart.itemType",
        },
        quantity: {
          type: Number,
          required: true,
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
            //// will be more
        },
      }
    ],


     deliveryAddress: [
      {
        addressType: {
          type: String,
          trim: true,
          required: true,
        },
        fullName: {
          type: String,
          trim: true,
          required: true,
        },
        email: {
          type: String,
          trim: true,
          required: true,
        },
        mobileNo: {
          type: String,
          trim: true,
          required: true,
        },
        addressLine1: {
          type: String,
          trim: true,
          required: true,
        },
        addressLine2: {
          type: String,
          trim: true,
        },
        landmark: {
          type: String,
          trim: true,
        },
        city: {
          type: String,
          trim: true,
          required: true,
        },
        pinCode: {
          type: String,
          trim: true,
          required: true,
        },
        state: {
          type: String,
          trim: true,
          required: true,
        },
        country: {
          type: String,
          trim: true,
          required: true,
        },
        note: {
          trim: true,
          type: String,
        },
      }
    ],
  },
  { timestamps: true }
);



retailerSchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const Retailer = mongoose.model("Retailer", retailerSchema);
