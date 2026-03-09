import ephemeris from "ephemeris";

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

// Maps each Zodiac sign (0-11) to its ruling planet's Gemstone
const rulingGemstones = {
	0: "Pavala/Munga (Red Coral)",      // Aries -> Mars
	1: "Hira (Diamond)",                // Taurus -> Venus
	2: "Panna (Emerald)",               // Gemini -> Mercury
	3: "Moti (Pearl)",                  // Cancer -> Moon
	4: "Manik (Ruby)",                  // Leo -> Sun
	5: "Panna (Emerald)",               // Virgo -> Mercury
	6: "Hira (Diamond)",                // Libra -> Venus
	7: "Pavala/Munga (Red Coral)",      // Scorpio -> Mars
	8: "Pukhraj (Yellow Sapphire)",     // Sagittarius -> Jupiter
	9: "Neelam (Blue Sapphire)",        // Capricorn -> Saturn
	10: "Neelam (Blue Sapphire)",       // Aquarius -> Saturn
	11: "Pukhraj (Yellow Sapphire)",    // Pisces -> Jupiter
};

/**
 * Mathematically calculates the Sidereal Ascendant (Vedic Lagna)
 * using precise Julian Date and Local Sidereal Time algorithms.
 */
function calculateSiderealAscendant(date, lat, lng) {
	// 1. Get exact Julian Date from Unix Timestamp
	// (This ensures timezone independence)
	const unixTime = date.getTime();
	const jd = (unixTime / 86400000) + 2440587.5;

	// 2. Calculate Exact GMST (Greenwich Mean Sidereal Time) in degrees
	const d = jd - 2451545.0;
	let gmstDeg = (280.46061837 + 360.98564736629 * d) % 360;
	if (gmstDeg < 0) gmstDeg += 360;

	// 3. Calculate Local Sidereal Time (LST)
	let lstDeg = (gmstDeg + lng) % 360;
	if (lstDeg < 0) lstDeg += 360;

	// 4. Calculate Obliquity of the Ecliptic
	const t = d / 36525.0;
	const oblDeg = 23.439291 - 0.0130042 * t;

	// Convert to Radians for Math functions
	const rad = Math.PI / 180;
	const lstRad = lstDeg * rad;
	const oblRad = oblDeg * rad;
	const latRad = lat * rad;

	// 5. Calculate Tropical Ascendant
	const y = Math.cos(lstRad);
	const x = -Math.sin(lstRad) * Math.cos(oblRad) - Math.tan(latRad) * Math.sin(oblRad);

	let ascRad = Math.atan2(y, x);
	let ascDeg = ascRad / rad;
	if (ascDeg < 0) ascDeg += 360;

	// 6. Apply Lahiri Ayanamsa to convert Tropical to Vedic (Sidereal)
	const year = date.getUTCFullYear() + date.getUTCMonth() / 12;
	const ayanamsa = 23.85 + (year - 2000) * (50.29 / 3600);

	let siderealAsc = (ascDeg - ayanamsa) % 360;
	if (siderealAsc < 0) siderealAsc += 360;

	// Return the Zodiac Index (0 to 11)
	return Math.floor(siderealAsc / 30);
}

/**
 * Calculates Ascendant (Lagna) and recommends the ultimate benefic Gemstone
 */
export function recommendGemstoneFromBirthDetails(dateOfBirth, longitude, latitude, height = 0) {

	// 1. Calculate the exact Vedic Ascendant (Lagna)
	const lagnaIndex = calculateSiderealAscendant(dateOfBirth, latitude, longitude);

	// 2. Identify the 9th House Lord (The Planet of Luck, Destiny, and Career)
	const ninthHouseIndex = (lagnaIndex + 8) % 12;

	// Fetch the correct gemstone for the 9th Lord
	const primaryBeneficStone = rulingGemstones[ninthHouseIndex];

	let moonLongitude = 0;
	try {
		const result = ephemeris.getAllPlanets(dateOfBirth, longitude, latitude, height);
		moonLongitude = result.observed.moon.apparentLongitudeDd;
	} catch (error) {
		console.error("Ephemeris issue ignored safely.");
	}

	return {
		rashi: `${zodiacSigns[lagnaIndex]}`,
		gemstone: primaryBeneficStone,
		moonLongitude: moonLongitude
	};
}

/**
 * Get birthstone by birth month number (1-12)
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
		8: "Peridot (पेरिडॉट/ज़बरजद), Sardonex (सार्डोनेक्स)",
		9: "Sapphire (नीलम/सैफायर)",
		10: "Opal (ओपल), Tourmaline (टूर्मलीन/तूरमलिन)",
		11: "Topaz (पुखराज/टोपाज़)",
		12: "Turquoise (फिरोज़ा), Lapis (लाजवर्द/लापिस लाज़ुली)",
	};

	return birthstones[month] || null;
}

/**
 * Get gemstone recommendation based on the first letter of the name
 */
export function getRashiGemstone(firstLetter) {
	const rashiGemstones = [
		{ letters: ["A", "L"], rashi: "Mesh (Aries)", gemstone: "Pavala/Munga (Red Coral)" },
		{ letters: ["B", "V", "U", "E", "O"], rashi: "Vrushabh (Taurus)", gemstone: "Hira (Diamond)" },
		{ letters: ["K", "Ch", "G", "Gh", "Ng"], rashi: "Mithun (Gemini)", gemstone: "Panna (Emerald)" },
		{ letters: ["D", "H"], rashi: "Kark (Cancer)", gemstone: "Moti (Pearl)" },
		{ letters: ["M", "T"], rashi: "Sinh (Leo)", gemstone: "Manik (Ruby)" },
		{ letters: ["P", "Th", "N"], rashi: "Kanya (Virgo)", gemstone: "Panna (Emerald)" },
		{ letters: ["R", "T"], rashi: "Tula (Libra)", gemstone: "Hira (Diamond)" },
		{ letters: ["N", "Y"], rashi: "Vrushchik (Scorpio)", gemstone: "Pavala/Munga (Red Coral)" },
		{ letters: ["Bh", "Ph", "Dh", "F"], rashi: "Dhanu (Sagittarius)", gemstone: "Pukhraj (Yellow Sapphire)" },
		{ letters: ["Kh", "J"], rashi: "Makar (Capricorn)", gemstone: "Neelam (Blue Sapphire)" },
		{ letters: ["G", "S", "Sh"], rashi: "Kumbh (Aquarius)", gemstone: "Neelam (Blue Sapphire)" },
		{ letters: ["D", "Ch", "Zh", "Th"], rashi: "Meen (Pisces)", gemstone: "Pukhraj (Yellow Sapphire)" },
	];

	for (const entry of rashiGemstones) {
		if (entry.letters.includes(firstLetter)) {
			return entry.gemstone;
		}
	}
	return null;
}