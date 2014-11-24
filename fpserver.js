/*jslint indent:3, node: true, vars: true */

var SERVER_ADDRESS = "http://127.0.0.1:3000";


var validConfig = {
   baseURI: 'https://parrot-hawaii-valid-api.herokuapp.com',
   clientId: "pierre.michard@parrot.com",
   clientSecret: "crxzpBX1i4rJogC2DsltHK0dnlaDenhMOeKbusr34KLacS4J",
   proxy: 'http://localhost:8880'
};

var prodConfig = {
    baseURI: 'https://apiflowerpower.parrot.com',
    clientId: "pmich35@gmail.com",
    clientSecret: "U2ReAWtJ1TwpsylpZCddioYtlE5L3QeUbfv25sF7fIgfATII",
    proxy: 'http://localhost:8880'
};


var flowerApi = require('./FlowerApi');
var fApi = new flowerApi(validConfig);
var pjson = require('./package.json');

var FlowerPower = require('./flower-power/index');

process.env.DEBUG = true;

var express = require('express'),
    app = express(),
    util = require('util'),
    async = require('async'),
    localDB = require('./localDb');

// Authorization uri definition
var authorization_uri = fApi.getAuthorizeURL({
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
    }, function (error) {
       if (error) { 
          console.log('Access Token Error', error.message); 
          res.send(error);
       } else {
         res.redirect('/');
       }
    });

    
  }
});

app.get('/', function (req, res) {
   if (fApi.isAuthenticated() === false){
      res.redirect('/auth');
   }
   else{
      //fApi.getVersions({test: "hello"}, function(error, response){console.log(error, response)});
      fApi.updateConfig();
      res.send("hello");
   }
});

app.listen(3000);

var sensors = {};

localDB.on('sensors_updated', function(sensors){
   sensors = sensors;
});

function getSensorSystemId(sensor, callback) {
   sensor.on('disconnect', function() {
      console.log('disconnected!');
   });
   async.series ({
      cnx: sensor.connect.bind(sensor),
      discover: sensor.discoverServicesAndCharacteristics.bind(sensor),
      systemId: sensor.readSystemId.bind(sensor),
      disconnect: sensor.disconnect.bind(sensor)
      }, function(err, results){
      if (err){
         callback(err, null);
      } else {
         console.log("system ID: " + results.systemId);
         callback(null, results.systemId);
      }
   });
}



function setSensorSystemId(uuid, systemId, callback){
   localDB.getSensorBySystemId(systemId, function(err, entry){
      
      if (err !== null){
         console.log("failed to get sensor from local db: " + err);
         callback(err, null);
      } else {
         var sensor = null;
         if (entry === null){
            sensor = {
               uuid: uuid,
               system_id: systemId,
               mine: false
            };
         } else {
            sensor = entry;
            sensor.uuid = uuid;
         }
         console.log("set sensor system ID: " + systemId);
         localDB.updateSensor(sensor, function(err){
            if (callback instanceof Function){
               callback(err);
            }
         });
      }
         
   });
}


function getSensorHistory(sensor, transferStartIdx, callback) {
   sensor.on('disconnect', function() {
      console.log('disconnected!');
   });
   async.series ({
      cnx: sensor.connect.bind(sensor),
      discover: sensor.discoverServicesAndCharacteristics.bind(sensor),
      historyContext: sensor.getHistoryContext.bind(sensor),
      startupTime: sensor.getStartupTime.bind(sensor),
      history: sensor.getHistory.bind(sensor, transferStartIdx),
      disconnect: sensor.disconnect.bind(sensor)
      }, function(err, results){
      if (err){
         callback(err, null);
      } else {
         callback(null, results);
      }
   });
}


function syncSensor(entry, callback){
   if (sensors.hasOwnProperty(entry.sensor_serial)){
      if (sensors[entry.sensor_serial].flags.hasEntry === false){
         console.log("up to date "+ entry.last_upload_datetime_utc);
         callback(null);
      }
      else {
         getSensorHistory(sensors[entry.sensor_serial], entry.current_history_index +1, function(err, results){
            console.log(results.historyContext);
            console.log(results.history);
            console.log(results.startupTime);

            fApi.uploadSamples({

               client_datetime_utc : new Date(),
               user_config_version : fApi.userConfigVersion,
               tmz_offset: (new Date()).getTimezoneOffset(),
               uploads: [{
                  sensor_serial: entry.sensor_serial,
                  upload_timestamp_utc : new Date(),
                  buffer_base64 : results.history,
                  app_version: pjson.version,
                  sensor_fw_version: entry.firmware_version,
                  sensor_hw_identifier:""
            }],
            session_histories:[{
               sensor_serial: entry.sensor_serial,
               session_id: results.historyContext.currentSessionId,
               sample_measure_period: results.historyContext.sessionPeriod,
               sensor_startup_timestamp_utc: results.startupTime,
               session_start_index: results.historyContext.sessionStartIdx
            }]
            }, callback);
         });
      }
   } else {
      callback(null);
   }
}



function syncSensors(callback){
   localDB.getSensors(function(err, sensors){
      if (err !== null){
         console.log("failed to get sensor from local db: " + err);
         callback(err, null);
      } else {
         async.each(sensors, function(sensor, callback){
            syncSensor(sensor, function(err){
               if (err !== null){
                  console.log("transfer failed:" + util.inspect(err));
               }
               callback(err);
            });
         }, function(){
            callback(null);
         });
      }
   });
}

FlowerPower.discover( 5000, function(err, fpDevices){
   console.log("discovered " + fpDevices.length + " sensors");
   async.each(fpDevices, function(sensor, callback){
      localDB.getSensorByUuid(sensor.uuid, function(err, entry){
         var systemId = null;
         if (entry === null){
            getSensorSystemId(sensor, function(err, gotSystemId){
               systemId = gotSystemId;
               sensors[systemId] = sensor;
               setSensorSystemId(sensor.uuid, systemId, callback);
            });
         } else {
            systemId = entry.sensor_serial;
            sensors[systemId] = sensor;
            setSensorSystemId(sensor.uuid, systemId, callback);
         }
         
      });
   }, function(){
      syncSensors(function(err){
         console.log("sync sensors finished: "+ err);
      });
   });
});


console.log('Express server started on port 3000');