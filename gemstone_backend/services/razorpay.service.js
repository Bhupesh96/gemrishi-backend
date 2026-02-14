//root/services-folder/razorpay.service.js
import axios from "axios";

const client = axios.create({
    baseURL: "https://api.razorpay.com/v1",
    auth: {
        username: process.env.RAZORPAY_KEY_ID,
        password: process.env.RAZORPAY_KEY_SECRET,
    },
    timeout: 15000,
});

export async function createRefund(paymentId, amountPaise) {
    const body = {};
    if (amountPaise && amountPaise > 0) body.amount = amountPaise;
    const { data } = await client.post(`/payments/${paymentId}/refund`, body);
    return data;
}
