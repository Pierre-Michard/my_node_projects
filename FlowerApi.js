/*jslint indent:3, node: true, vars: true, nomen: true */

(function () {
   "use strict";
   
   var DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss z',

      localDB = require('./localDb'),
      util = require('util'),
      request  = require('request'),
      oauth2 = require('simple-oauth2'),
      url = require('url'),
      events = require('events');
      

   process.env.DEBUG = true;
   // Allow Charles Proxy.
   process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
   
   
   
   function HtmlError(response) {
      this.name = "HtmlError";
      this.statusCode = response.statusCode;
      this.message = "HTML status: " + response.statusCode;
      Error.call(this, this.message);
   }
   util.inherits(HtmlError, Error);
   
   
   function Api(params) {
      this.method = params.method;
      this.url = params.url;
      this.id = params.id;
      this.needAuth = params.needAuth;
      this.formatter = params.formatter;
   }
   
   
   
   Api.prototype.describe = function () {
      return String(this.id + " " + this.method + " " + this.getUri());
   };
      
   Api.prototype.manageHtmlErrors = function (response) {
      var error = new HtmlError(response);
      return error;
   };
   

                           
   Api.prototype.request = function (serverConfig, args, callback) {
      var self = this,
         proxy = serverConfig.proxy,
         baseURI = serverConfig.baseURI,
         token = serverConfig.token;
      
      this.getUri = function () {
         return (url.resolve(baseURI, this.url));
      };
      
      this.getHeaders = function () {
         if (this.needAuth === true) {
            return {Authorization : "Bearer " + token.token.access_token};
         }
      };
      
      if (this.needAuth === true) {
         if (token === null) {
            throw 'authentication needed';
         } else if (token.expired()) {
            token.refresh(function (error) {
               if (error) {
                  callback(error, null);
               } else {
                  self.request(serverConfig, args, callback);
               }
            });
         }
      }

      console.log("calling API: " + this.describe());
      request({
         proxy: proxy,
         method: this.method,
         uri: this.getUri(),
         headers: this.getHeaders(),
         body: (args !== null)? JSON.stringify(args) : undefined
      }, function (error, response, body) {
         if (error !== null) {
            callback(error, null);
         } else if (response.statusCode !== 200) {
            var htmlError = self.manageHtmlErrors(response);
            if (typeof (callback) === 'function') {
               callback(htmlError, body);
            }
         } else {
            body = JSON.parse(body);
            if((body.hasOwnProperty("errors") && (body.errors.length > 0))){
               callback(body.errors[0], null);  
            }
            else {
               if (self.formatter instanceof Function){
                  body = self.formatter(body);
               }
               if (callback instanceof Function) {
                  callback(null, body);
               }
            }
         }
      });
   };
   
   function FlowerApi(params) {
      var apiServerConfig = {
         token: null,
         baseURI: params.baseURI || 'https://apiflowerpower.parrot.com',
         proxy:  params.proxy || null
      };
      
      events.EventEmitter.call(this);
      
      var clientId = params.clientId,
         clientSecret = params.clientSecret,
         self = this,
         apiList = {
            authenticate :       new Api({ method: 'POST', url: '/user/v1/authenticate',                   id: "2.1",    needAuth: false }),
            uploadSamples:       new Api({ method: 'PUT',  url: 'sensor_data/v5/sample',                   id: "1.1",    needAuth: true  }),
            getGardenStatus:     new Api({ method: 'GET',  url: 'sensor_data/v4/garden_locations_status',  id: "1.28",   needAuth: true, formatter: this.gardenStatusFormatter  }),
            getGardenConfig:     new Api({ method: 'GET',  url: 'sensor_data/v3/sync',                     id: "1.25",   needAuth: true, formatter: this.gardenConfigFormatter  }),
            getLocationSamples:  new Api({ method: 'GET',  url: 'sensor_data/v2/sample/location/',         id: "1.3",    needAuth: true  }),
            getUserProfile:      new Api({ method: 'GET',  url: 'user/v4/profile',                         id: "2.4",    needAuth: true  }),
            acknowledgeSatuses:  new Api({ method: 'PUT',  url: 'sensor_data/v1/garden_locations_status',  id: "1.30",   needAuth: true  }),
            getVersions:         new Api({ method: 'GET',  url: 'user/v1/versions',                        id: "2.17",   needAuth: true  })
         };
      
      this.oauth2 = oauth2({
         clientID: clientId,
         clientSecret: clientSecret,
         site: apiServerConfig.baseURI,
         authorizationPath: '/oauth2/v1/authorize',
         tokenPath: '/user/v1/authenticate'
      });
      
      this.isAuthenticated = function () {
         return (apiServerConfig.token !== null);
      };
      
      function wrapToken(token) {
         // make token refresh to save the token in DB
         var __refresh = token.refresh;
         token.refresh = function (callback) {
            __refresh.call(token, function (error, result) {
               if (error) {
                  if (callback) {
                     callback(error, result);
                  }
               } else {
                  localDB.saveToken(token.token, function (error, token) {
                     callback(error, token);
                  });
               }
            });
         };
         return token;
      }
      
      localDB.on('token_set', function (tokenEntry) {
         if ((apiServerConfig.token === null) || (tokenEntry.access_token !== apiServerConfig.token.access_token)) {
            tokenEntry.expires_in = tokenEntry.expires_at - new Date();
            apiServerConfig.token = wrapToken(self.oauth2.accessToken.create(tokenEntry));
         }
      });
      
      localDB.on('user_config_set', function () {
         localDB.getConfigVersion( function(err, userConfigVersion){
            console.log('user config set', userConfigVersion);
            self.userConfigVersion = userConfigVersion;
         });
      });
      
      var api;
      for (api in apiList) {
         if (apiList.hasOwnProperty(api)) {
            this[api] = apiList[api].request.bind(apiList[api], apiServerConfig);
         }
      }
   }
      
   var formatField = function(field, fn){
      var keyList = field.split('.');
      if (keyList.length > 1){
         if (this.hasOwnProperty(keyList[0])){
            var current = this[keyList[0]];
            if (Array.isArray(current)){
               current.forEach(function(el){
                  formatField.call(el, keyList.slice(1).join('.'), fn);
               });
            }
            else{
               formatField.call(current, keyList.slice(1).join('.'), fn);
            }
          }
      }else if (keyList.length == 1){
         if (this.hasOwnProperty(keyList[0])){
            if (this[field] !== null){
               this[field] = fn(this[field]);
            }
         }
      }
   };
   
   var formatDateField = function(field){
     return formatField.call(this, field, function(value){return new Date(value)});
   };
   
   FlowerApi.prototype.gardenStatusFormatter = function (gardenStatus) {
      formatDateField.call(gardenStatus, 'sensors.battery_level.battery_end_of_life_date_utc');
      formatDateField.call(gardenStatus, 'sensors.last_upload_datetime_utc');
      
      formatDateField.call(gardenStatus, 'locations.last_processed_upload_timedate_utc');
      formatDateField.call(gardenStatus, 'locations.last_sample_upload');
      formatDateField.call(gardenStatus, 'locations.first_sample_utc');
      formatDateField.call(gardenStatus, 'locations.last_sample_utc');
      formatDateField.call(gardenStatus, 'locations.global_validity_timedate_utc');
      
      formatDateField.call(gardenStatus, 'locations.air_temperature.next_analysis_timedate_utc');
      formatDateField.call(gardenStatus, 'locations.air_temperature.predicted_action_timedate_utc');
      formatDateField.call(gardenStatus, 'locations.air_temperature.done_action_timedate_utc');
      
      formatDateField.call(gardenStatus, 'locations.light.next_analysis_timedate_utc');
      formatDateField.call(gardenStatus, 'locations.light.predicted_action_timedate_utc');
      formatDateField.call(gardenStatus, 'locations.light.done_action_timedate_utc');
      
      formatDateField.call(gardenStatus, 'locations.light.soil_moisture');
      formatDateField.call(gardenStatus, 'locations.light.soil_moisture');
      formatDateField.call(gardenStatus, 'locations.light.soil_moisture');
      
      formatDateField.call(gardenStatus, 'locations.fertilizer.soil_moisture');
      formatDateField.call(gardenStatus, 'locations.fertilizer.soil_moisture');
      formatDateField.call(gardenStatus, 'locations.fertilizer.soil_moisture');
      
      return gardenStatus;
   };
   
   FlowerApi.prototype.gardenConfigFormatter = function (gardenConfig) {
      formatDateField.call(gardenConfig, 'locations.plant_assigned_date');
      return gardenConfig;
   };
   
   FlowerApi.prototype.updateConfig = function (callback) {
      var self = this;
      var done = {
         userProfile: false,
         gardenConfig: false,
         gardenStatus: false
      };
      var errors = [];
      
      function isUpdateFinished() {
         return done.userProfile && done.gardenConfig;
      }
      
      this.getUserProfile(null, function (error, response) {
         if (error) {
            console.log(error);
            errors.push(error);
            done.user_profile = true;
         } else {
            localDB.saveUserConfig(response.user_profile, function (err, userConfig) {
               done.user_profile = true;
            });
         }
      });
      
      this.getGardenConfig(null, function (error, gardenConfig) {
         if (error) {
            console.log(error);
            errors.push(error);
            done.user_profile = true;
         } else {
            localDB.saveConfigVersions(gardenConfig.user_config_version, function (error) {
               if (error !== null) {
                  console.log(error);
               }
               self.getGardenStatus(null, function (error, gardenStatus) {
                  if (error) {
                     console.log(error);
                     errors.push(error);
                     done.gardenStatus = true;
                  } else {
                     localDB.saveUserSensorsStatus(gardenStatus.sensors, function (error) { });
                     done.gardenStatus = true;
                  }
               });
            });
         }
      });
      
      
   };
   
   FlowerApi.prototype.getAuthorizeURL = function (params) {
      return this.oauth2.authCode.authorizeURL(params);
   };

   FlowerApi.prototype.getToken = function (config, callback) {
      var self = this;
      return this.oauth2.authCode.getToken(config, function (error, result) {
         if (error === null) {
            result.expires_at = new Date() + result.expires_in;
            localDB.saveToken(result, function (error, result) {
               callback(error, result);
            });
         } else {
            callback(error, result);
         }
      });
   };
   
   module.exports = FlowerApi;
}());