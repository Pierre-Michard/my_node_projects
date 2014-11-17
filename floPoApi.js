const CLIENT_ID="pmich35@gmail.com";
const CLIENT_SECRET="U2ReAWtJ1TwpsylpZCddioYtlE5L3QeUbfv25sF7fIgfATII";
const BASE_URL = 'https://apiflowerpower.parrot.com';
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss z';


var LocalDb = require('./localDb')
  ,util = require('util');


var requestify  = require('requestify');
var oauth2 = require('simple-oauth2');




function FlowerApi ( base, token){
  this.base = base;
  this._token = token;

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
    token = oauth2.accessToken.create( tokenEntry);
  });

}



base = 'https://apiflowerpower.parrot.com/' 
//base = 'https://parrot-hawaii-valid-api.herokuapp.com/' 

module.exports = FlowerApi;
