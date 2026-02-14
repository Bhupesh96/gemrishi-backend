import { Router } from 'express';
import {
	createOffer,
	updateOffer,
	getOfferDetailsAdmin,
	deleteOffer,
	getAllOffers,
	getAllOffersAdmin,
	getOfferDetails,
	applyPromoCode,
	applyPromoCode2,
	applyOfferToCart,
	// getAllOffer,
} from '../controllers/offer.controller.js';

import { protect, protectAdmin } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/multer.middleware.js';

const router = Router();


// --- Admin Routes ---
router.route('/create_offer').post( upload.none(), protectAdmin, createOffer );
router.route('/update_offer/:offerId').put( upload.none(), protectAdmin, updateOffer );
router.route('/delete_offer/:offerId').delete(protectAdmin, deleteOffer);
router.route('/get_offer_admin').get(protectAdmin, getOfferDetailsAdmin);
router.route('/get_all_offers_admin').get(protectAdmin, getAllOffersAdmin);

// --- Public Route ---
router.route('/get_all_offers').get(getAllOffers);
router.route('/get_offer').get(getOfferDetails);
// router.route('/apply_promocode').post(upload.none(), protect, applyPromoCode);
// router.route('/apply_promocode').post(upload.none(), protect, applyPromoCode2);
router.route('/apply_promocode').post(upload.none(), protect, applyOfferToCart);




export default router;
