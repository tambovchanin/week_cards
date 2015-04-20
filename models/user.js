var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
	email				: {type: Array, default: []},
	displayName : String,
	accessToken : String,
	asanaId			: String,
	checkboxClkCnt		: {type: Number, default: 0},
	moveCnt				: {type: Number, default: 0},
	loginCnt			: {type: Number, default: 0},
	refreshCnt			: {type: Number, default: 0}
});

module.exports = mongoose.model('User', userSchema);