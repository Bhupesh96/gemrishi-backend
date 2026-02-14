import { BuyBackRequest } from "../models/buy.back.request.model.js";
import { Product } from "../models/product.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { RetailerStock } from "../models/retailerStock.model.js";

// need to test
export const getPendingBuyBackRequestsByRetailer = asyncHandler(
  async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const retailerId = req?.user?._id;
    if (!retailerId) return res.status(401).json({ msg: "Unauthorized" });

    const total = await BuyBackRequest.countDocuments({ retailerId, status: "Pending" });

    const requests = await BuyBackRequest.find({ retailerId, status: "Pending" })
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (!requests?.length) {
      return res.status(404).json({ msg: "No requests found" });
    }

    return res.status(200).json({
      msg: "requests found successfully",
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      requests,
    });
  }
);

export const getAllBuyBackRequestsByRetailer = asyncHandler(
  async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const retailerId = req?.user?._id;
    if (!retailerId) return res.status(401).json({ msg: "Unauthorized" });

    const total = await BuyBackRequest.countDocuments({ retailerId });

    const requests = await BuyBackRequest.find({ retailerId })
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (!requests?.length) {
      return res.status(404).json({ msg: "No requests found" });
    }

    return res.status(200).json({
      msg: "requests found successfully",
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      requests,
    });
  }
);


export const updateRequest = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { requestId } = req.params;
  const retailerId = req.user._id || req.user.id;

  const request = await BuyBackRequest.findOneAndUpdate(
    { _id: requestId, retailerId },
    { status },
    { new: true }
  );

  if (!request) {
    return res.status(404).json({ msg: "No request found" });
  }

  // if accepted then update the product stock
  const buyBackReq = await BuyBackRequest.findById(requestId);
  if (!buyBackReq) {
    return res.status(404).json({ msg: "BuyBack Request Not Found" });
  }

  if (request.status === "Accepted") {
    for (const item of buyBackReq.items) {
      // increment admin product stock
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity || 1 },
      });

      // decrement retailer stock (stock will be always one)
      const updated = await RetailerStock.findOneAndUpdate(
        {
          retailerId,
          productId: item.productId,
          "certificate.certificateType":
            item.customization?.certificate?.certificateType,
        },
        { $inc: { quantity: -1 } }, // reduce quantity
        { new: true }
      );

      // remove stock only if quantity is 0
      if (updated && updated.quantity <= 0) {
        await RetailerStock.findByIdAndDelete(updated._id);
      }
    }
  }

  return res.status(200).json({
    msg: "Request Updated Successfully",
    request,
  });
});

export const deleteRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const deletedRequest = await BuyBackRequest.findByIdAndDelete(requestId);

  if (!deletedRequest) {
    return res.status(404).json({ msg: "Deleted Request Not Found" });
  }

  return res.status(200).json({
    msg: "Request deleted successfully",
  });
});

export const createBuyBackRequest = asyncHandler(async (req, res) => {
  const { retailerId, items } = req.body;
  const adminId = req.user._id || req.user.id;

  // need to validate if retailer has that product or not
  const retailerStock = await RetailerStock.find({ retailerId });

  for (const item of items) {
    const hasProduct = retailerStock.some(
      (stock) => stock.productId.toString() === item.productId
    );

    if (!hasProduct) {
      return res.status(400).json({
        msg: `Product ${item.productId} not found for this retailer`,
      });
    }
  }

  // Fetch all products in the request
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  // Validate customization for each item
  for (const item of items) {
    const product = products.find((p) => p._id.toString() === item.productId);
    if (!product) {
      return res
        .status(404)
        .json({ message: `Product not found: ${item.productId}` });
    }

    if (item.customization?.certificate) {
      const validCertificate = product.certificate.find(
        (c) =>
          c.certificateType ===
            item.customization.certificate.certificateType &&
          c.price === item.customization.certificate.price
      );

      if (!validCertificate) {
        return res.status(400).json({
          message: `Invalid certificate for ${product.name}: ${item.customization.certificate.certificateType}`,
        });
      }
    }
  }

  const request = await BuyBackRequest.create({
    adminId,
    retailerId,
    items,
    status: "Pending",
  });

  for (const item of items) {
    await RetailerStock.updateOne(
      {
        retailerId,
        productId: item.productId,
        "certificate.certificateType":
          item.customization?.certificate?.certificateType,
      },
      { buyBackRequestId: request._id }
    );
  }

  //socket here

  return res.status(200).json({
    msg: "Request Initiated Successfully",
    request,
  });
});

// export const payForBuyBack = asyncHandler(async (req, res) => {
//   const { requestId } = req.params;

//   const request = await BuyBackRequest.findById(requestId);
//   if (!request) {
//     return res.status(404).json({ msg: "Request not found" });
//   }
//   if (request.status !== "Accepted") {
//     return res.status(401).json({ msg: "Request has not been accepted yet" });
//   }

//   /// payment and stock update logic
//   const orderPayload = {
//     amount: 0, // in paise
//     currency: "INR",
//     receipt: `buyback_${request._id}`,
//     payment_capture: 1,
//   };

//   const products = await Product.find({
//     _id: { $in: request.items.map((id) => id.productId) },
//   });

//   // calculate total amount from items
//   let totalAmount = 0;

//   for (const item of request.items) {
//     const product = products.find(
//       (p) => p._id.toString() === item.productId.toString()
//     );
//     if (!product) return res.status(404).json({ msg: "Product not found" });

//     // no need to check stock as admin is buying the products back

//     const basePrice = product.price;
//     const certificatePrice = item.customization?.certificate?.price || 0;

//     totalAmount += item.quantity * (basePrice + certificatePrice);
//   }

//   orderPayload.amount = totalAmount * 100; // convert to paise

//   const basicAuth = Buffer.from(
//     `${process.env.RAZOR_PAY_KEY_ID}:${process.env.RAZOR_PAY_KEY_SECRET}`
//   ).toString("base64");

//   const response = await fetch("https://api.razorpay.com/v1/orders", {
//     method: "POST",
//     headers: {
//       Authorization: `Basic ${basicAuth}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify(orderPayload),
//   });

//   const razorpayOrder = await response.json();

//   if (response.status !== 200 && response.status !== 201) {
//     return res
//       .status(500)
//       .json({ msg: "Failed to create Razorpay order", error: razorpayOrder });
//   }

//   /// after payment is done update the stock
//   for (const item of request.items) {
//     const product = products.find(
//       (p) => p._id.toString() === item.productId.toString()
//     );
//     if (product) {
//       product.stock += item.quantity;
//       await product.save();
//     }
//   }
//   //   request.razorpayOrderId = razorpayOrder.id;
//   request.status = "Completed";

//   // need to update retailer stock as well
//   for (const item of request.items) {
//     const retailerStock = await RetailerStock.findOne({
//       retailerId: request.retailerId,
//       productId: item.productId,
//     });

//     if (retailerStock) {
//       retailerStock.quantity -= item.quantity;

//       if (retailerStock.quantity <= 0) {
//         await RetailerStock.deleteOne({ _id: retailerStock._id });
//       } else {
//         await retailerStock.save();
//       }
//     }
//   }

//   await request.save();

//   return res.status(200).json({
//     msg: "Payment order initiated successfully",
//     orderId: razorpayOrder.id,
//     amount: razorpayOrder.amount,
//     currency: razorpayOrder.currency,
//     receipt: razorpayOrder.receipt,
//     razorpayOrder, // full razorpay order object
//   });
// });

/*

ADMIN
ADMIN SENDS REQUEST
ADMIN PAYS AFTER ACCEPT

RETAILER



*/
