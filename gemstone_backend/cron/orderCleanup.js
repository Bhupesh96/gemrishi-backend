import cron from "node-cron";
import {Order} from "../models/order.model.js";
import {Product} from "../models/product.model.js";

console.log("✅ Order Cleanup Cron Job Setup Initiated"); // <--- ADD THIS

cron.schedule("* * * * *", async () => {
  const cutoff = new Date(Date.now() - 1 * 60 * 1000);
  console.log("cutoff", cutoff);

  const pendingOrders = await Order.find({
    paymentStatus: "Pending",
    paymentMethod: "razorpay",
    createdAt: { $lte: cutoff },
  });

  for (const order of pendingOrders) {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
      });
    }

    order.paymentStatus = "Failed";
    order.orderStatus = "Cancelled";
    await order.save();
  }

  console.log("⏳ Cleaned expired pending payments");
});
