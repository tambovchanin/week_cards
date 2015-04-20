var express = require('express');
var passport = require('passport');
var router = express.Router();

var User = require('../models/user');
var Log = require('../models/log');
var TaskOrder = require('../models/taskOrder');

var UAParser = require('ua-parser-js');

/* GET home page. */
router.get('/login', function(req, res){
	res.render('index', { title: 'WEEK.CARDS' });
});

router.get('/', function(req, res){
	if (!(req.user && req.user.accessToken))
		res.redirect('/login');
	res.render('asana', { message: 'Well done', error: {status: 'success', user: req.user} });
});

router.get('/login/asana/callback',
	passport.authenticate('Asana', { failureRedirect: '/login' }),
	function(req, res) {
		res.cookie('token', req.user.accessToken, {maxAge:3600000*24*7}).redirect('/');
	});

router.get('/login/asana',
	passport.authenticate('Asana'),
	function(req, res){
		// The request will be redirected to Asana authentication, so this
		// function will not be called.
		console.log('you should not get here!')
	});

router.post('/logPage', function(req, res){
	//console.warn(req.user);
	var logData = req.body.data;
	logData.userAgent = req.headers['user-agent'];
	logData.ip = req.connection.remoteAddress;

	var parser = new UAParser();
	var ua = req.headers['user-agent'];
	var uaInfo = parser.setUA(ua).getResult();

	logData.browser = uaInfo.browser;
	logData.engine = uaInfo.engine;
	logData.os = uaInfo.os;
	logData.device = uaInfo.device;
	logData.cpu = uaInfo.cpu;
	logData.date = new Date().getTime();

	var user = req.body.user;
	if (!user || !logData){
		res.send(500);
		return;
	}

	var createLog = function(userData, logData){
		if (logData.loadType == 'login'){
			userData.loginCnt++;
		} else {
			userData.refreshCnt++;
		}
		userData.save(function(err, data){
			if (err){
				res.send(500);
				return;
			}

			Log.create(logData, function(err, data){
				if (err){
					res.send(500);
					return;
				}

				res.send(200);
			});
		});
	};

	User.findOne({email: user.email}, function(err, userData){
		if (err){
			res.send(500);
			return;
		}

		if (!userData){
			User.create({email: user.email}, function(err, userData){
				if (err){
					res.send(500);
					return;
				}

				createLog(userData, logData);
			});
		} else {
			createLog(userData, logData);
		}
	});
});

router.post('/logCheckBox', function(req, res){
	var user = req.body.user;
	if (!user){
		res.send(500);
		return;
	}

	User.findOne({email: user.email}, function(err, userRecord){
		if (err || !userRecord){
			res.send(500);
			return;
		}

		userRecord.checkboxClkCnt++;
		userRecord.save(function(err, data){
			if (err){
				res.send(500);
				return;
			}

			res.send(200);
		});
	});
});

router.post('/logMove', function(req, res){
	var user = req.body.user;
	if (!user){
		res.send(500);
		return;
	}

	User.findOne({email: user.email}, function(err, userRecord){
		if (err || !userRecord){
			res.send(500);
			return;
		}

		userRecord.moveCnt++;
		userRecord.save(function(err, data){
			if (err){
				res.send(500);
				return;
			}

			res.send(200);
		});
	})
});

router.post('/getTasksOrder', function(req, res){
	var user = req.body.user;
	if (!user){
		res.send(500);
		return;
	}

	User.findOne({email: user.email}, function(err, userRecord){
		if (err || !userRecord){
			res.send({});
			return;
		}
		
		TaskOrder.find({userId: userRecord._id}, function(err, orderData){
			if (err){
				res.send(500);
				return;
			}
			
			var result = {};
			if (orderData) {
				for (var i in orderData) {
					if (!result[orderData[i].column])
						result[orderData[i].column] = {};
					result[orderData[i].column][orderData[i].taskId] = orderData[i].order;
				}
			}

			res.send(result);
		});
	})
});

router.post('/setTasksOrder', function(req, res){
	var user = req.body.user;
	var orderData = req.body.orders;
	if (!user || !orderData){
		res.send(500);
		return;
	}

	User.findOne({email: user.email}, function(err, userRecord){
		if (err || !userRecord){
			res.send(500);
			return;
		}
		
		TaskOrder.remove({userId: userRecord._id}, function(err){
			if (err){
				res.send(500);
				return;
			}
			
			var saveData = [];
			for (var column in orderData) {
				if (column < 1) continue;
				for (var taskId in orderData[column]) {
					saveData.push({
						userId: userRecord._id,
						column: column,
						taskId: taskId,
						order: orderData[column][taskId]
					});
				}
			}
			
			TaskOrder.create(saveData, function(err){
				if (err){
					res.send(500);
					return;
				}
				
				res.send(200);
			});
		});
	})
});

module.exports = router;
