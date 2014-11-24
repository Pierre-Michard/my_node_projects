/*jslint indent:3, node: true, vars: true */

(function () {
   "use strict";
   
   var Datastore = require('nedb'),
      events = require('events'),
      util = require('util'),
      async = require('async');
   
   var tokenDb  = new Datastore({ filename: 'db/tokenDb' });
   var gardenDb = new Datastore({ filename: 'db/gardenDb'});

   function LocalDB() {
      var self = this;

      tokenDb.loadDatabase(function (err) {
         tokenDb.ensureIndex({ fieldName: 'access_token', unique: true }, function (err) {
            self.getToken(function (err, token) {
               if ((null === err) && (token !== undefined)) {
                  self.emit('token_set', token);
               }
            });
         });
      });
      
      gardenDb.loadDatabase(function () {
         gardenDb.ensureIndex({ fieldName: 'email', unique: true, sparse: true });
         gardenDb.ensureIndex({ fieldName: 'sensor_serial', unique: true, sparse: true });
         self.emit('user_config_set');
      });
      
      events.EventEmitter.call(this);
      
      return this;
   }
   
   util.inherits(LocalDB, events.EventEmitter);
   
   LocalDB.prototype.getToken = function (callback) {
      tokenDb.find({access_token: {$exists: true}}, function (err, docs) {
         if (err) {
            callback(err, null);
         } else {
            callback(null, docs[0]);
         }
      });
   };

   LocalDB.prototype.saveToken = function (token, callback) {
      var self = this;
      console.log(token);
      var tokenDoc = {
         access_token: token.access_token,
         expires_at: token.expires_at,
         refresh_token: token.refresh_token
      };
      tokenDb.update({access_token: {$exists: true}}, tokenDoc, {upsert: true}, function (err, numReplace, newDoc) {
         if (callback) {
            try {
               if (err === null) {
                  self.emit('token_set', tokenDoc);
               }
            } catch (e) {
               self.emit('error', e);
            }
            callback(err, newDoc);
         }
      });
   };

   LocalDB.prototype.getUserConfig = function (callback) {
      gardenDb.find({type: "user_config"}, function (err, docs) {
         if (err) {
            callback(err, null);
         } else {
            callback(null, docs[0]);
         }
      });
   };

   LocalDB.prototype.saveUserConfig = function (userConfig, callback) {
      var self = this;
      var doc = userConfig;
      doc.type =  "user_config";
      
      gardenDb.update({$and:[{"email": userConfig.email}, {"type": "uesr_config"}]}, doc, {upsert: true}, function (err, numReplace, newDoc) {
         if (callback) {
            callback(err, newDoc);
            try {
               self.emit('user_config_set', newDoc);
            } catch (e) {
               self.emit('error', e);
            }
         }
      });
   };
   
   LocalDB.prototype.insertSensor = function (sensor, callback) {
      var doc = sensor;
      doc.type = "sensor";
      gardenDb.insert(doc, function (err) {
         console.log(err);
         if (callback) {
            callback(err);
         }
      });
   };
   
   LocalDB.prototype.updateSensor = function (sensor, callback) {
      var doc = sensor;
      var self = this;
      doc.type = "sensor";
      gardenDb.update({ $and: [{"type": "sensor"}, {sensor_serial: sensor.sensor_serial}]}, {$set: doc}, {}, function (err, numReplace) {
            if (numReplace === 0) {
               self.insertSensor(sensor, callback);
            } else {
               if (callback) {
                  callback(err, numReplace);
               }
         }
      });
   };
   
   LocalDB.prototype.setSensorsAsNotMine = function (mySensors, callback) {
      gardenDb.update({$and: [{"type": "sensor"}, {$not: {sensor_serial: {$in: mySensors}}}]}, {$set: {mine:false}}, {multi: true}, function (err, numRemoved) {
         
         if (callback) {
            callback(err, numRemoved);
         }
      });
   };
   
   LocalDB.prototype.getSensors = function (callback) {
      gardenDb.find({"type": "sensor"}, function (err, sensors) {
         if (callback) {
            callback(err, sensors);
         }
      });
   };
   
   LocalDB.prototype.getSensorByUuid = function (uuid, callback) {
      gardenDb.find({$and:[{"type": "sensor"},{"uuid": uuid}]}, function (err, sensors) {
         if (callback) {
            if (sensors.length == 1){
               callback(err, sensors[0]);
            } else {
               callback(err, null);
            }
         }
      });
   };
   
   LocalDB.prototype.getSensorBySystemId = function (system_id, callback) {
      gardenDb.find({$and:[{"type": "sensor"},{"sensor_serial": system_id}]}, function (err, sensors) {
         if (callback) {
            if (sensors.length == 1){
               callback(err, sensors[0]);
            } else {
               callback(err, null);
            }
         }
      });
   };
   
   LocalDB.prototype.saveUserSensorsConfig = function (sensorConfig, callback) {
      var self = this;
      var idx, sensorsIds = [];
      for (idx = 0; idx < sensorConfig.length; idx = idx + 1) {
         sensorsIds.push(sensorConfig[idx].sensor_serial);
      }
      this.setSensorsAsNotMine(sensorsIds, function (err, numDeleted) {
         if (err) {
            if (callback) {
               callback(err, null);
            }
         } else {
            async.each(sensorConfig, function(sensor, callback){
               sensor.mine = true;
               self.updateSensor(sensor, callback);
            }, function(err){
               if(err) {
                  console.log(err);
               }
               callback(err);
            });
         }
      });
   };
   
   LocalDB.prototype.saveConfigVersions = function (configVersion, callback) {
      gardenDb.update({"type": "user_config_version"}, {type:"user_config_version", user_config_version: configVersion}, {upsert: true}, function (err) {
         if(err){
            console.log(err);
         }
         callback(err);
      });
   };
   
   LocalDB.prototype.getConfigVersion = function (callback) {
      gardenDb.find({"type": "user_config_version"}, function (err, result) {
         if (result.length === 0){
            callback(err, -1);
         }
         else{
            callback(err, result[0].user_config_version);
         }
      });
   };
   
   LocalDB.prototype.saveUserSensorsStatus = function (sensorStatuses, saveUserCallback) {
      var self = this;
      
      async.each(sensorStatuses, function(sensorStatus, callback){
         self.updateSensor(sensorStatus, callback);
      }, function(){
         self.getSensors(function(err, sensors){
            if (err !== null){
               console.log(err);
            } else {
               self.emit('sensors_updated', sensors);
            }
            saveUserCallback(err);
         });
      });
   };

   
   module.exports = new LocalDB();
   
}());