var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');

//Hash these keys
var crypto = require('crypto');


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


app.get('/',
function(req, res) {
  res.render('index');
});

//TODO:  APP.GET '/signup' HERE
app.get('/signup',
  function(req,res) {
    res.render('signup');
});

app.post('/signup', function(req,res){

  new User({ username: req.body.username }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      console.log(req.body);
      var hasher = crypto.createHash('sha1');
      console.log(hasher.update(req.body.password).digest('hex'));
        var user = new User({
          username: req.body.username,
          password: req.body.password
        });

        user.save().then(function(newUser) {
          // Links.add(newLink);
          res.send(200, newUser);
        });
      };
    })
});


app.get("/login",
  function(req, res) {
  res.render('login');
});

//TODO: finish login
app.post('/login',
  function(req, res){
    console.log("Post to login received")
    //grab username and password from field
    new User( {username: req.body.username} ).fetch()
    .then(function(found){
      //if username is in database
      if(found){
        console.log("DBPassword:",found.attributes.password);
        console.log("Input Password:",req.body.password);
          //Check if the password is the same
        if(found.attributes.password === req.body.password){
          console.log("authenticated:",req.body.username);
          // route to index page
          // show logged in status there somehow
          res.redirect("/");
        }else{
          console.log("incorrect password");
          res.redirect("/login");
        };
      }else{
      //redirect to sign up page
        console.log("username " + req.body.username + " does not exist");
        res.redirect("/signup");
      }
    })
    //console.log("REQ body:", req.body)
  })


app.get('/create',
function(req, res) {
  res.render('index');
});

app.get('/links',
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',
function(req, res) {
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
