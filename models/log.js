var mongoose = require('mongoose');

var logSchema = mongoose.Schema({
	userId					: String,
	projectsCnt				: Number,
	tasksCnt				: Number,
	userAgent				: String,
	ip						: String,
	loadType				: String,
	date: {type:Date, default: Date.now},
	browser: {
		name				: String,
		major				: String,
		version				: String
	},
	device: {
		model				: String,
		vendor				: String,
		type				: String
	},
	os: {
		name				: String,
		version				: String
	},
	engine: {
		name				: String,
		version				: String
	},
	cpu: {
		architecture		: String
	},
	window: {
		width				: Number,
		height				: Number
	},
	screen: {
		width				: Number,
		height				: Number
	}
});

module.exports = mongoose.model('Log', logSchema);