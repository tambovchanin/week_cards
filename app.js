var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var AsanaStrategy = require('passport-asana').Strategy;
var User = require('./models/user');
var compression = require('compression');
var session = require('express-session');
var config = require('./config.js');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/dashboard')

var routes = require('./routes/index');

passport.serializeUser(function(user, done){
	done(null, user);
});

passport.deserializeUser(function(obj, done){
	done(null, obj);
});

passport.use(new AsanaStrategy({
		clientID: config.asana.id,
		clientSecret: config.asana.token,
		callbackURL: config.asana.callback
	},
	function(accessToken, refreshToken, profile, done){
		// asynchronous verification, for effect...
		process.nextTick(function(){
			//console.log("Tokens", accessToken, refreshToken, profile);

			User.findOne({asanaId: profile.id}, function(err, userData){
				if (err){
					res.send(500);
					return;
				}

				if (!userData){
					// Create new user record
					User.create({asanaId: profile.id, email: profile.emails, displayName: profile.displayName, accessToken: accessToken}, function(err, user){
						if (err){
							return done(err, user);
						}
						return done(null, user);
					});
				} else {
					// Update token for user record
					userData.accessToken = accessToken;
					userData.save(function(err, user){
						if (err)
							return done(err, user);
						return done(null, user);
					});
				}
			});
		});
	}
));

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(compression({
	filter: function(req, res){
		return /json|text|javascript|css/.test(res.getHeader('Content-Type'));
	},
	level: 9
}));

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(session({ secret: '$week.cards^',
		saveUninitialized: true,
		resave: true})
);
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(passport.session());
app.use('/', routes);

/// catch 404 and forward to error handler
app.use(function(req, res, next){
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development'){
	app.use(function(err, req, res, next){
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next){
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

app.set('port', config.port);

var server = app.listen(app.get('port'), function(){
	console.log('Express server listening on port ' + server.address().port);
});