/*jslint indent:2 */
/*global process:true, require:true, console:true */

var CLIENT_ID = "pmich35@gmail.com";
var CLIENT_SECRET = "U2ReAWtJ1TwpsylpZCddioYtlE5L3QeUbfv25sF7fIgfATII";
var SERVER_ADDRESS = "http://127.0.0.1:3000";
var BASE_URL = 'https://apiflowerpower.parrot.com';

var flowerApi = require('./FlowerApi');
var fApi = new flowerApi(BASE_URL);
process.env.DEBUG = true;

var express = require('express'),
  app = express();

var requestify  = require('requestify');

var oauth2 = fApi.oauth2;

// Authorization uri definition
var authorization_uri = oauth2.authCode.authorizeURL({
    redirect_uri: SERVER_ADDRESS + '/callback',
    scope: 'notifications',
  });


// Initial page redirecting to Github
app.get('/auth', function (req, res) {
  res.redirect(authorization_uri);
});

// Callback service parsing the authorization token and asking for the access token
app.get('/callback', function (req, res) {
  if (req.query.error) {
    res.send(req.query.error);
  } else {
    var code = req.query.code;
    fApi.getToken({
      code: code,
      redirect_uri: SERVER_ADDRESS + '/callback'
    }, saveToken);

    function saveToken(error, result) {
       if (error) { 
          console.log('Access Token Error', error.message); 
          res.send(error);
       } else {
         res.redirect('/');
       }
    }
     
    function refreshToken (token){
       token.refresh(function(error, result) {
         token = result;
       })
     }
  }
});

app.get('/', function (req, res) {
   if (fApi.isAuthenticated() === false){
      res.redirect('/auth');
   }
   else{
      fApi.getVersion();
      res.send("hello");
   }
});

app.listen(3000);

console.log('Express server started on port 3000');