import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "User",
    },
    retailerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Retailer",
    },
    orderId: {
      type: String,
      unique: true,
      required: false,
    },
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    totalAmount: {
      type: String,
      required: true,
    },
    subTotal: {
      type: Number,
      required: false,
    },
    discountAmount: {
      type: Number,
      required: false,
    },
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      required: false,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "InProgress", "Completed", "Failed", "Cancelled","Pending Refund","Refunded"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "InProgress", "Completed", "Cancelled","Failed"],
      default: "Pending",
    },
    cancelOrderReason: {
      type: String,
      required: false,
      trim: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: false,
          ref: "Product",
        },
        jewelryId: {
          type: mongoose.Schema.Types.ObjectId,
          required: false,
          ref: "Jewelry",
        },
        quantity: {
          type: Number,
          required: true,
        },
        cancelStatus: {
          type: Boolean,
        },
        cancelOrderReason: {
          type: String,
          required: false,
          trim: true,
        },
        itemTotal: {
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
          jewelryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Jewelry",
          },
          goldKarat: {
            karatType: {
              type: String,
              enum: ["gold24k", "gold22k", "gold18k"],
            },
            price: { type: Number },
          },
          gemstoneWeight: {
            weight: { type: String },
            price: { type: Number },
          },
          sizeSystem: {
            sizeType: { type: String },
            sizeNumber: { type: String },
          },
          isDiamondSubstitute: {
            type: Boolean,
          },
          diamondSubstitute: {
            name: { type: String },
            price: { type: Number },
          },
          quality: {
            qualityType: { type: String },
            price: { type: Number },
          },
        },
      },
    ],
    address: {
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
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "razorpay"],
    },
    onlinePayAmount: {
      type: Number,
    },
    offlinePayAmount: {
      type: Number,
    },
    partialPay: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
