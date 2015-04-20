var mongoose = require('mongoose');

var taskOrderSchema = mongoose.Schema({
	userId					: String,
	column					: Number,
	taskId					: String,
	order					: Number
});

module.exports = mongoose.model('TaskOrder', taskOrderSchema);