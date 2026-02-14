import ephemeris from "ephemeris";


function getMoonSign(longitude) {
	const zodiacSigns = [
		"Mesh (Aries)",
		"Vrushabh (Taurus)",
		"Mithun (Gemini)",
		"Kark (Cancer)",
		"Sinh (Leo)",
		"Kanya (Virgo)",
		"Tula (Libra)",
		"Vrushchik (Scorpio)",
		"Dhanu (Sagittarius)",
		"Makar (Capricorn)",
		"Kumbh (Aquarius)",
		"Meen (Pisces)",
	];

	const birthstones = {
		0: "Pavala/Munga (Red Coral)",
		1: "Hira (Diamond)",
		2: "Panna (Emerald)",
		3: "Moti (Pearl)",
		4: "Manik (Ruby)",
		5: "Panna (Emerald)",
		6: "Hira (Diamond)",
		7: "Pavala/Munga (Red Coral)",
		8: "Pukhraj (Yellow Sapphire)",
		9: "Neelam (Blue Sapphire)",
		10: "Neelam (Blue Sapphire)",
		11: "Pukhraj (Yellow Sapphire)",
	};

	const index = Math.floor((longitude % 360) / 30);
	return {
		rashi: zodiacSigns[index],
		gemstone: birthstones[index],
	};
}

/**
 * Calculate Janma Rashi (Moon Sign) and recommended gemstone
 * @param {Date} dateOfBirth - JavaScript Date object in UTC
 * @param {number} longitude - observer longitude in decimal degrees
 * @param {number} latitude - observer latitude in decimal degrees
 * @param {number} height - observer height in meters (default 0)
 * @returns {Object} { rashi, gemstone, moonLongitude }
 */
export function recommendGemstoneFromBirthDetails(
	dateOfBirth,
	longitude,
	latitude,
	height = 0
) {
	const result = ephemeris.getAllPlanets(
		dateOfBirth,
		longitude,
		latitude,
		height
	);
	const moonLongitude = result.observed.moon.apparentLongitudeDd;

	return getMoonSign(moonLongitude);
}

/**
 * Get birthstone by birth month number (1-12)
 * @param {number} month - Month number 1-12
 * @returns {string|null} gemstone name(s) or null if invalid month
 */
export function getBirthstone(month) {
	const birthstones = {
		1: "Garnet (गर्नेट/गोमेदक)",
		2: "Amethyst (ऐमेथिस्ट/कटैला/जमुनिया)",
		3: "Aquamarine (एक्वामरीन/बेरिल), Bloodstone (ब्लडस्टोन/रक्तमणि), Diamond (हीरा)",
		4: "White Sapphire (सफेद पुखराज/श्वेत नीलम)",
		5: "Emerald (पन्ना), Jade (जेड/जडाइट)",
		6: "Pearl (मोती), Alexandrite (एलेक्ज़ेन्ड्राइट), Moonstone (चंद्रमणि)",
		7: "Ruby (माणिक/रूबी)",
		8: "Peridot (पेरिडॉट/ज़बरजद), Sardonex (सार्डोनेक्स)",
		9: "Sapphire (नीलम/सैफायर)",
		10: "Opal (ओपल), Tourmaline (टूर्मलीन/तूरमलिन)",
		11: "Topaz (पुखराज/टोपाज़)",
		12: "Turquoise (फिरोज़ा), Lapis (लाजवर्द/लापिस लाज़ुली)",
	};

	return birthstones[month] || null;
}

/**
 * Get gemstone recommendation based on the first letter of the name (according to your chart)
 * @param {string} firstLetter - First letter of the name (assumed uppercase)
 * @returns {string|null} gemstone name or null if no match
 */
export function getRashiGemstone(firstLetter) {
	// Adapted from your mapping
	const rashiGemstones = [
		{
			letters: ["A", "L"],
			rashi: "Mesh (Aries)",
			gemstone: "Pavala/Munga (Red Coral)",
		},
		{
			letters: ["B", "V", "U", "E", "O"],
			rashi: "Vrushabh (Taurus)",
			gemstone: "Hira (Diamond)",
		},
		{
			letters: ["K", "Ch", "G", "Gh", "Ng"],
			rashi: "Mithun (Gemini)",
			gemstone: "Panna (Emerald)",
		},
		{ letters: ["D", "H"], rashi: "Kark (Cancer)", gemstone: "Moti (Pearl)" },
		{ letters: ["M", "T"], rashi: "Sinh (Leo)", gemstone: "Manik (Ruby)" },
		{
			letters: ["P", "Th", "N"],
			rashi: "Kanya (Virgo)",
			gemstone: "Panna (Emerald)",
		},
		{ letters: ["R", "T"], rashi: "Tula (Libra)", gemstone: "Hira (Diamond)" },
		{
			letters: ["N", "Y"],
			rashi: "Vrushchik (Scorpio)",
			gemstone: "Pavala/Munga (Red Coral)",
		},
		{
			letters: ["Bh", "Ph", "Dh", "F"],
			rashi: "Dhanu (Sagittarius)",
			gemstone: "Pukhraj (Yellow Sapphire)",
		},
		{
			letters: ["Kh", "J"],
			rashi: "Makar (Capricorn)",
			gemstone: "Neelam (Blue Sapphire)",
		},
		{
			letters: ["G", "S", "Sh"],
			rashi: "Kumbh (Aquarius)",
			gemstone: "Neelam (Blue Sapphire)",
		},
		{
			letters: ["D", "Ch", "Zh", "Th"],
			rashi: "Meen (Pisces)",
			gemstone: "Pukhraj (Yellow Sapphire)",
		},
	];

	for (const entry of rashiGemstones) {
		if (entry.letters.includes(firstLetter)) {
			return entry.gemstone;
		}
	}
	return null;
}