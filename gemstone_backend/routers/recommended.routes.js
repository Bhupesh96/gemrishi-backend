import express from "express";
import * as gemstoneController from "../controllers/recommender.controller.js";
const router = express.Router();

router.post("/gem-suggestion", gemstoneController.recommend);

export default router;
