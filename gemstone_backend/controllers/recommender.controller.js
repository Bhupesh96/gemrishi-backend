import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import {
	recommendGemstoneFromBirthDetails,
	getBirthstone,
	getRashiGemstone,
} from "../utils/recommendHelper.js";

function parseTime(hour, minute, ampm) {
	let h = parseInt(hour, 10);
	let m = parseInt(minute, 10);

	if (isNaN(h) || isNaN(m)) {
		throw new Error("Invalid time provided");
	}

	// Convert 12-hour format to 24-hour
	if (ampm === "PM" && h !== 12) h += 12;
	if (ampm === "AM" && h === 12) h = 0;

	return [h, m, 0];
}

export async function recommend(req, res) {
	try {
		const {
			name,
			email,
			phone,
			gender,
			purpose,
			budget,
			placeOfBirth,
			country,
			chartStyle,
			dob,
			tob,
		} = req.body;

		// ✅ Validation
		if (!name || !dob || !tob || !placeOfBirth) {
			return res.status(400).json({
				success: false,
				message:
					"Name, Date of Birth, Time of Birth, and Place of Birth are required.",
			});
		}

		// 🗺️ Fetch coordinates using OpenCage API
		const geoApiUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
			placeOfBirth
		)}&key=${process.env.OPENCAGE_API_KEY}`;

		const { data: geoData } = await axios.get(geoApiUrl);
		if (!geoData.results?.length) {
			return res.status(400).json({
				success: false,
				message: "Invalid city or unable to fetch coordinates.",
			});
		}

		const { lat: latitude, lng: longitude } = geoData.results[0].geometry;

		// 📅 Prepare birth date
		const { day, month, year } = dob;
		const [hour, minute, second] = parseTime(tob.hour, tob.minute, tob.ampm);

		const birthDate = new Date(year, month - 1, day, hour, minute, second);

		// Calculate timezone offset (in hours)
		const timezoneOffset = birthDate.getTimezoneOffset() / 60;

		// 🌕 Astrology recommendations
		const {
			rashi: janmaRashi,
			gemstone: gemstoneFromMoonSign,
			moonLongitude,
		} = recommendGemstoneFromBirthDetails(birthDate, longitude, latitude);

		const firstLetter = name.trim()[0].toUpperCase();
		const gemstoneFromNameLetter = getRashiGemstone(firstLetter);
		const birthstoneByMonth = getBirthstone(parseInt(month));

		return res.status(200).json({
			success: true,
			data: {
				name,
				email,
				phone,
				gender,
				purpose,
				budget,
				placeOfBirth,
				country,
				chartStyle,
				dob,
				tob,
				latitude,
				longitude,
				janmaRashi,
				gemstoneFromMoonSign,
				gemstoneFromNameLetter,
				birthstoneByMonth,
				moonLongitude,
			},
		});
	} catch (error) {
		console.error("Error in recommend:", error);
		return res.status(500).json({
			success: false,
			message: "Internal Server Error",
		});
	}
}
