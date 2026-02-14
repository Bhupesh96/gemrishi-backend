// install first: npm i date-fns
// put this in utils/policy.js

import { differenceInCalendarDays } from "date-fns";

const INR_50000_PAISE = 50000 * 100;

export function evaluateRefundEligibility(order, reason) {
	const today = new Date();
	const delivered = order.deliveredAt ? new Date(order.deliveredAt) : null;

	// Window check: 10 days from delivery (strict)
	let eligibleByWindow = false;
	if (delivered) {
		const diffDays = differenceInCalendarDays(today, delivered);
		eligibleByWindow = diffDays <= 10; // strict as per policy
	}

	// Type checks:
	const nonRefundableItem = !!order.isCustomizedItem;
	let eligibleByType = true;

	// Loose gemstones >= ₹50,000 are NOT refundable (replacement only)
	if (
		order.itemCategory === "loose_gem" &&
		order.listedPricePaise >= INR_50000_PAISE
	) {
		eligibleByType = false;
	}

	// Reason-based (policy prioritizes damaged/defective/wrong item)
	const reasonAllowed = ["damaged", "defective", "wrong_item"].includes(reason);

	return {
		eligible:
			eligibleByWindow && !nonRefundableItem && eligibleByType && reasonAllowed,
		eligibleByWindow,
		nonRefundableItem,
		eligibleByType,
		reasonAllowed,
	};
}

/**
 * Compute maximum refundable amount (deduct non-refundable fees).
 * Note: shipping and extra lab certificate fees are not refundable.
 */
export function computeMaxRefundablePaise(order) {
	const nonRefundableFees =
		Number(order.shippingFeePaise || 0) +
		Number(order.extraLabCertFeePaise || 0);
	const maxRefundable = Math.max(
		0,
		Number(order.amountPaidPaise) - nonRefundableFees
	);
	return maxRefundable;
}
