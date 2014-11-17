var CLIENT_ID="pmich35@gmail.com";
var CLIENT_SECRET="U2ReAWtJ1TwpsylpZCddioYtlE5L3QeUbfv25sF7fIgfATII";
var BASE_URL = 'https://apiflowerpower.parrot.com';
var DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss z';

process.env.DEBUG = true;

var LocalDb = require('./localDb')
  ,util = require('util');


var request  = require('request');
var oauth2 = require('simple-oauth2');
var url = require('url');



function FlowerApi ( base){
  var self = this;
  this.base = base;
  this._token = null;

  this.API = {
    upload_sample:    { method: 'POST', url: 'sensor_data/v5/sample'                                },
    garden_status:    { method: 'GET',  url: 'sensor_data/v3/garden_locations_status',  api: "1.28" },
    sync:             { method: 'GET',  url: 'sensor_data/v3/sync',                     api: "1.25" },
    sample_location:  { method: 'GET',  url: 'sensor_data/v2/sample/location/',         api: "1.3"  },
    profile:          { method: 'GET',  url: 'user/v4/profile',                         api: "2.4"  }, 
    sync_ack:         { method: 'PUT',  url: 'sensor_data/v1/garden_locations_status',  api: "1.30" },
    versions_info:    { method: 'GET',  url: 'user/v1/versions',                        api: "2.17" }
  };

  this.oauth2 = oauth2({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    site: base,
    authorizationPath:'/oauth2/v1/authorize',
    tokenPath: '/user/v1/authenticate',
  });

  localDB = new LocalDb(); 

  localDB.on('token_set', function( tokenEntry){
    console.log("token set :)");
    self._token = self.oauth2.accessToken.create( tokenEntry);
    console.log(self._token);
  });

}

FlowerApi.prototype.isAuthenticated = function(){
   return (this._token !== null);
}

FlowerApi.prototype.getAuthorizeURL = function( config){
  return this.oauth2.authCode.authorizeURL(config);
}

FlowerApi.prototype.getToken = function( config, callback){
  return this.oauth2.authCode.getToken(config, function(error, result){
     if (error === null){
        localDB.saveToken(result);
     }
     callback( error, result);
  });
}

FlowerApi.prototype.getVersion =  function(){
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  api = this.API.versions_info;
  token = this._token.token.access_token;
  console.log(token);
  console.log("testing API: " + api.api);
  uri = url.resolve( this.base, api.url);
  console.log( api.method + " " + uri);
  
  request( {
    proxy: "http://127.0.0.1:8880",
    method: api.method,
    uri: uri,
    headers: {
      'Authorization' : "Bearer " + token
      }
    }
    , function(error, response, body){
      console.log(error, body);
    });
}


base = 'https://apiflowerpower.parrot.com/' 
//base = 'https://parrot-hawaii-valid-api.herokuapp.com/' 

module.exports = FlowerApi;
