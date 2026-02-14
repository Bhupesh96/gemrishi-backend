import { MetalRates } from "../models/metalRates.model.js";


// Normalize a Date to start-of-day (00:00:00)
function startOfDay(date = new Date()) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function endOfDay(date = new Date()) {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d;
}

// add metal rates
export async function addMetalRates(req, res) {
	try {

		const {

			//gold
			gold_gstpergram,
			gold24k,
			gold22k,
			gold18k,

			//silver
			silver_gstpergram,
			silver_rate,

			//platinum,
			platinum_gstpergram,
			platinum_rate,

			//panchadhatu,
			panchadhatu_gstpergram,
			panchadhatu_rate,
			note,

		} = req.body;

		if (
			!gold_gstpergram ||
			!gold24k ||
			!gold22k ||
			!gold18k ||

			!silver_gstpergram ||
			!silver_rate ||

			!platinum_gstpergram ||
			!platinum_rate ||

			!panchadhatu_gstpergram ||
			!panchadhatu_rate
		) {
			return res.status(400).json({
				success: false,
				message: 'All Fields are required',
			});
		}

		// gst calsulation
		const gstCal = (price, gstpercent) => {
			return Number(price) + Number((Number(price) * Number(gstpercent)) / 100);
		}

		const doc = {
			date: new Date(),
			gold: {
				goldGSTPerGram: Number(gold_gstpergram),
				gold24k: {
					withoutGSTRate: Number(gold24k),
					withGSTRate: gstCal(gold24k, gold_gstpergram),
				},
				gold22k: {
					withoutGSTRate: Number(gold22k),
					withGSTRate: gstCal(gold22k, gold_gstpergram),
				},
				gold18k: {
					withoutGSTRate: Number(gold18k),
					withGSTRate: gstCal(gold18k, gold_gstpergram),
				},
			},
			silver: {
				silverGSTPerGram: silver_gstpergram,
				withoutGSTRate: Number(silver_rate),
				withGSTRate: gstCal(silver_rate, silver_gstpergram),
			},
			platinum: {
				platinumGSTPerGram: platinum_gstpergram,
				withoutGSTRate: Number(platinum_rate),
				withGSTRate: gstCal(platinum_rate, platinum_gstpergram),
			},
			panchadhatu: {
				panchadhatuGSTPerGram: panchadhatu_gstpergram,
				withoutGSTRate: Number(panchadhatu_rate),
				withGSTRate: gstCal(panchadhatu_rate, panchadhatu_gstpergram),
			},
			note: note,
		};


		const rates = await MetalRates.create(doc);
		return res.status(201).json({
			success: true,
			message: 'All Rates are added successfully',
			rates,
		});


	} catch (err) {
		return res.status(400).json({ success: false, message: err.message || 'failed to create rates' });
	}
}

// get todays all rates
export async function getTodayMetalRates(req, res) {
	try {
		const start = startOfDay();
		const end = endOfDay();
		const results = await MetalRates.find({ date: { $gte: start, $lte: end } });

		if(!results || results.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'Todays Metal Rates not found. Please add Metal Rates for today',
			});
		}

		return res.json({
			success: true,
			message: 'Today Metal Rates fetched successfully',
			rates: results,
		});
	} catch (err) {
		return res.status(500).json({
			success: false,
			message: err.message || 'failed to fetch today rates'
		});
	}
}

// get metal rates history
export async function getMetalRatesHistory(req, res) {
	try {

		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const total = await MetalRates.countDocuments();

		const rates = await MetalRates.find().skip(skip).limit(limit).sort({ createdAt: -1 });

		if (!rates || rates.length === 0) {
			return res.status(404).json({ success: false, message: "No Metal Rates History found" });
		}

		return res.status(200).json({
			success: true,
			message: "Metal Rates History list fetched successfully",
			totalPages: Math.ceil(total / limit),
			currentPage: page,
			rates:rates,
		});

	} catch (err) {
		return res.status(500).json({ success: true, message: err.message || 'failed to fetch history' });
	}
}

// returns the latest entry of metal rates
export async function getLatestRates(req, res) {
	try {
		const latestRate = await MetalRates.findOne().sort({ createdAt: -1 });

		if (!latestRate || latestRate.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'No metal rates found.',
			});
		}

		return res.status(200).json({
			success: true,
			message: "Latest metal rates fetched successfully",
			latestRate: latestRate,
		});

	} catch (err) {
		return res.status(500).json({ message: err.message || 'failed to fetch latest rates' });
	}
}

// get single rate
export async function getRateById(req, res) {
	try {
		const { id } = req.query;
		const doc = await MetalRates.findById(id);
		if (!doc) return res.status(404).json({
			success: false,
			message: 'Rates Not Found',
		});
		return res.json({
			success: true,
			message: 'Rates Fetched Successfully',
			rate: doc
		});
	} catch (err) {
		return res.status(500).json({ success: false, message: err.message || 'failed to fetch rate' });
	}
}

// Update Metal Rates
export async function updateMetalRates(req, res) {
	try {
		const {
			id,
			//gold
			gold_gstpergram,
			gold24k,
			gold22k,
			gold18k,

			//silver
			silver_gstpergram,
			silver_rate,

			//platinum,
			platinum_gstpergram,
			platinum_rate,

			//panchadhatu,
			panchadhatu_gstpergram,
			panchadhatu_rate,
			note,
		} = req.body;

		if (!id) {
			return res.status(400).json({ success: false, message: 'Metal rate ID is required for update.' });
		}

		// gst calsulation
		const gstCal = (price, gstpercent) => {
			return Number(price) + Number((Number(price) * Number(gstpercent)) / 100);
		}

		const updateData = {
			gold: {
				goldGSTPerGram: Number(gold_gstpergram),
				gold24k: {
					withoutGSTRate: Number(gold24k),
					withGSTRate: gstCal(gold24k, gold_gstpergram),
				},
				gold22k: {
					withoutGSTRate: Number(gold22k),
					withGSTRate: gstCal(gold22k, gold_gstpergram),
				},
				gold18k: {
					withoutGSTRate: Number(gold18k),
					withGSTRate: gstCal(gold18k, gold_gstpergram),
				},
			},
			silver: {
				silverGSTPerGram: silver_gstpergram,
				withoutGSTRate: Number(silver_rate),
				withGSTRate: gstCal(silver_rate, silver_gstpergram),
			},
			platinum: {
				platinumGSTPerGram: platinum_gstpergram,
				withoutGSTRate: Number(platinum_rate),
				withGSTRate: gstCal(platinum_rate, platinum_gstpergram),
			},
			panchadhatu: {
				panchadhatuGSTPerGram: panchadhatu_gstpergram,
				withoutGSTRate: Number(panchadhatu_rate),
				withGSTRate: gstCal(panchadhatu_rate, panchadhatu_gstpergram),
			},
			note: note,
		};

		const rates = await MetalRates.findByIdAndUpdate(id, updateData, { new: true });

		if (!rates) {
			return res.status(404).json({ success: false, message: 'Metal rate with the given ID not found.' });
		}

		return res.status(200).json({
			success: true,
			message: 'Metal Rates updated successfully',
			rates,
		});


	} catch (err) {
		return res.status(500).json({ success: false, message: err.message || 'Failed to update rates' });
	}
}

// delete Metal Rates
export async function deleteMetalRate(req, res) {
	try{

		const id = req.query.id;
		const rates = await MetalRates.findByIdAndDelete(id);
		if (!rates) {
			return res.status(404).json({ success: false, message: 'Metal rate with the given ID not found.' });
		}
		return res.status(200).json({
			success: true,
			message: 'Metal Rates deleted successfully',
			rates,
		});

	}catch(err){
		return res.status(500).json({ success: false, message: err.message || 'failed to fetch rate' });

	}
}



/**

	addMetalRates()						add metal rates									DONE
	getTodayMetalRates()				get todays all rates							DONE
	getLatestRates()					get latest rates								DONE
	getMetalRatesHistory()				get metal rates history							DONE
	getRateById()						get single rate									DONE
	updateMetalRates()					update metal rates								DONE
	deleteMetalRates()					delete metal rates								DONE


 */