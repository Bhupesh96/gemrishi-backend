//helper for conversion of paise and rupee
// utils/money.js
export const inPaise = (rupees) => Math.round(Number(rupees) * 100);
export const inRupees = (paise) => (Number(paise) / 100).toFixed(2);
