import mongoose from "mongoose";
import appendDomainPlugin from "../plugins/appendDomain.js";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      trim: true,
    },
    fullName: {
      type: String,
      required: false,
    },
    mobileNo: {
      type: String,
      required: false,
    },
    country: {
      type: String,
      required: false,
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
    pinCode: {
      type: String,
    },
    city: {
      type: String,
    },
    landmark: {
      type: String,
    },

    deliveryAddress: [
      {
        addressType: {
          type: String,
          trim: true,
          required: false,
        },
        fullName: {
          type: String,
          trim: true,
          required: false,
        },
        email: {
          type: String,
          trim: true,
          required: false,
        },
        mobileNo: {
          type: String,
          trim: true,
          required: false,
        },
        addressLine1: {
          type: String,
          trim: true,
          required: false,
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
          required: false,
        },
        pinCode: {
          type: String,
          trim: true,
          required: false,
        },
        state: {
          type: String,
          trim: true,
          required: false,
        },
        country: {
          type: String,
          trim: true,
          required: false,
        },
        note: {
          trim: true,
          type: String,
        },
      }
    ],

    resetPasswordOtp: {
      type: String,
      required: false,
    },
    resetPasswordExpires: {
      type: Date,
      required: false,
    },

    wishlist: [
      {
        itemType: {
          type: String,
          enum: ["Product", "Jewelry"],
          required: true,
        },
        item: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          refPath: "wishlist.itemType",
        },
      }
    ],

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
        totalPrice: {
          type: Number,
          // required: true,
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
          gemstoneWeight: {
            weight: { type: String },
            price: { type: Number },
          },
          sizeSystem: {
            sizeType: { type: String },
            sizeNumber: { type: String },
          },
          goldKarat: {
            karatType: {
              type: String,
              enum: ["gold24k", "gold22k", "gold18k"],
            },
            price: { type: Number },
          },
          jewelryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Jewelry",
          },
          isDiamondSubstitute: {
            type: Boolean,
            default: false,
          },
          diamondSubstitute: {
            name: { type: String },
            price: { type: Number },
          },
        },

      }
    ],

  },
  {
    timestamps: true,
  }
);

userSchema.plugin(appendDomainPlugin, { fields: ["url"] });

export const User = mongoose.model("User", userSchema);