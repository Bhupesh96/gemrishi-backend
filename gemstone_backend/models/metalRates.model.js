import mongoose from 'mongoose';

const metalRatesSchema = new mongoose.Schema(
	{
		date: {
			type: Date,
			required: true,
		},

		gold: {
			goldGSTPerGram: Number,

			gold24k: {
				withoutGSTRate: Number,
				withGSTRate: Number,
			},
			gold22k: {
				withoutGSTRate: Number,
				withGSTRate: Number,
			},
			gold18k: {
				withoutGSTRate: Number,
				withGSTRate: Number,
			},
		},

		silver: {
			silverGSTPerGram: Number,
			withoutGSTRate: Number,
			withGSTRate: Number,
		},

		platinum: {
			platinumGSTPerGram: Number,
			withoutGSTRate: Number,
			withGSTRate: Number,
		},

		panchadhatu: {
			panchadhatuGSTPerGram: Number,
			withoutGSTRate: Number,
			withGSTRate: Number,
		},

		note:{
			type: String,
		}

	},
	{
		timestamps: true, // adds createdAt and updatedAt fields automatically
	}
);


export const MetalRates = mongoose.model('MetalRate', metalRatesSchema);

