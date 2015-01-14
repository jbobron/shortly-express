var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');

//Hash these keys
//var crypto = require('crypto');
var bcrypt = require('bcrypt');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
// Use express session
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}));

app.get('/', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/create', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/links', util.checkUser, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', util.checkUser, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    console.log("FOUND_URL", found)
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

//TODO:  APP.GET '/signup' HERE
app.get('/signup', function(req,res) {
    res.render('signup');
});

app.post('/signup', function(req,res){
  new User({ username: req.body.username }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      bcrypt.genSalt(10,function(err,salt){
        bcrypt.hash(req.body.password,salt,function(err,hash){
          if(err){console.log("signin hash error")};
          var user = new User({
            username: req.body.username,
            password: hash
          });
          user.save().then(function(newUser) {
            //redirect to /
            res.send(200, newUser);
            res.redirect("/");
          })
        })
      });
    };
  })
});


app.get("/login", function(req, res) {
  res.render('login');
});

//TODO: finish login
app.post('/login', function(req, res){
//add user property, with value of username, to the session
  console.log("Post to login received")
  //grab username and password from field
  new User( {username: req.body.username} ).fetch().then(function(found){
    //if username is in database
    if(found){
      bcrypt.genSalt(10, function(err, salt){
        bcrypt.hash(req.body.password, salt, function(err, hash){
          console.log("Hash from db",found.attributes.password);
          console.log("pw from user", req.body.password);
          bcrypt.compare(req.body.password, found.attributes.password, function(err, result){
            if (result === true) {
              console.log("authenticated:",req.body.username);
              util.createSession(req,res,req.body.username);
            } else {
              console.log("incorrect password");
              res.redirect("/");
            }
          });
        });
      });
    }else{
    //redirect to sign up page
      console.log("username " + req.body.username + " does not exist");
      res.redirect("/login");
    }
  })
})




/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
