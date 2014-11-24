/*jslint indent:3, node: true, vars: true, nomen: true, regexp: true */
"use strict";
var events = require('events');
var util   = require('util');
var async  = require('async');

var noble = require('noble');

function flowerPowerUuid(shortUuid) {
   return '39e1' + shortUuid + '84a811e2afba0002a5d5c51b';
}


var LIVE_SERVICE_UUID                           = flowerPowerUuid('fa00');

var SYSTEM_ID_UUID                              = '2a23';
var SERIAL_NUMBER_UUID                          = '2a25';
var FIRMWARE_REVISION_UUID                      = '2a26';
var HARDWARE_REVISION_UUID                      = '2a27';

var BATTERY_LEVEL_UUID                          = '2a19';

var LIVE_MODE_UUID                              = flowerPowerUuid('fa06');
var SUNLIGHT_UUID                               = flowerPowerUuid('fa01');
var TEMPERATURE_UUID                            = flowerPowerUuid('fa04');
var SOIL_MOISTURE_UUID                          = flowerPowerUuid('fa05');


var FRIENDLY_NAME_UUID                          = flowerPowerUuid('fe03');
var COLOR_UUID                                  = flowerPowerUuid('fe04');

var UPLOAD_SERVICE_UUID                         = flowerPowerUuid('fb00');
var UPLOAD_TX_BUFFER_CHAR_UUID                  = flowerPowerUuid('fb01');
var UPLOAD_TX_STATUS_CHAR_UUID                  = flowerPowerUuid('fb02');
var UPLOAD_RX_STATUS_CHAR_UUID                  = flowerPowerUuid('fb03');

var HISTORY_SERVICE_UUID                        = flowerPowerUuid('fc00');
var HISTORY_NB_ENTRIES_CHAR_UUID                = flowerPowerUuid('fc01');
var HISTORY_LASTENTRY_IDX_CHAR_UUID             = flowerPowerUuid('fc02');
var HISTORY_TRANSFER_START_IDX_CHAR_UUID        = flowerPowerUuid('fc03');
var HISTORY_CURRENT_SESSION_ID_CHAR_UUID        = flowerPowerUuid('fc04');
var HISTORY_CURRENT_SESSION_START_IDX_CHAR_UUID = flowerPowerUuid('fc05');
var HISTORY_CURRENT_SESSION_PERIOD_CHAR_UUID    = flowerPowerUuid('fc06');

var CLOCK_SERVICE_UUID                          = flowerPowerUuid('fd00');
var CLOCK_CURRENT_TIME_UUID                     = flowerPowerUuid('fd01');

var SUNLIGHT_VALUE_MAPPER                   = require('./data/sunlight.json');
var TEMPERATURE_VALUE_MAPPER                = require('./data/temperature.json');
var SOIL_MOISTURE_VALUE_MAPPER              = require('./data/soil-moisture.json');

function FlowerPower(peripheral) {
   this._peripheral = peripheral;
   this._services = {};
   this._characteristics = {};

   this.uuid = peripheral.uuid;
   this.name = peripheral.advertisement.localName;
   var flags = peripheral.advertisement.manufacturerData.readUInt8(0);
   this.flags={};
   this.flags.hasEntry   = ((flags & (1<<0)) !== 0);
   this.flags.hasMoved   = ((flags & (1<<1)) !== 0);
   this.flags.isStarting = ((flags & (1<<2)) !== 0);
   
   this._peripheral.on('disconnect', this.onDisconnect.bind(this));
}

util.inherits(FlowerPower, events.EventEmitter);

FlowerPower.discover = function (delay, callback) {
   var startScanningOnPowerOn = function () {
      var sensors = [];
      if (noble.state === 'poweredOn') {
         var onDiscover = function (peripheral) {
            console.log ("discovered: " +peripheral.uuid);
            sensors.push(new FlowerPower(peripheral));
         };

         noble.on('discover', onDiscover);
         console.log("start scanning");
         noble.startScanning([LIVE_SERVICE_UUID]);
         setTimeout(function(){
               console.log("scanning finished");
               noble.removeListener('discover', onDiscover);
               noble.stopScanning();
               callback(null, sensors);
            }, delay);
         
      } else {
         noble.once('stateChange', startScanningOnPowerOn);
      }
   };

   startScanningOnPowerOn();
};

FlowerPower.prototype.onDisconnect = function () {
   this.emit('disconnect');
};

FlowerPower.prototype.toString = function () {
   return JSON.stringify({
      uuid: this.uuid,
      name: this.name
   });
};

FlowerPower.prototype.connect = function (callback) {
   this._peripheral.connect(callback);
};

FlowerPower.prototype.disconnect = function (callback) {
   this._peripheral.disconnect(callback);
};

FlowerPower.prototype.discoverServicesAndCharacteristics = function (callback) {
   this._peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics) {
      if (error === null) {
         for (var i in services) {
            if (services.hasOwnProperty(i)) {
               var service = services[i];
               this._services[service.uuid] = service;
            }
         }
         for (var j in characteristics) {
            if (characteristics.hasOwnProperty(j)) {
               var characteristic = characteristics[j];

               this._characteristics[characteristic.uuid] = characteristic;
            }
         }
      }

      callback(error);
   }.bind(this));
};

FlowerPower.prototype.writeDataCharacteristic = function (uuid, data, callback) {
   this._characteristics[uuid].write(data, false, callback);
};

FlowerPower.prototype.notifyCharacteristic = function (uuid, notify, listener, callback) {
   var characteristic = this._characteristics[uuid];
   characteristic.notify(notify, function (err) {
      if (err !== null){
         callback(err);
      } else {
         if (notify) {
            characteristic.addListener('read', listener);
         } else {
            characteristic.removeListener('read', listener);
         }
         callback(null);
      }      
   });
};

FlowerPower.prototype.readDataCharacteristic = function (uuid, callback) {
   this._characteristics[uuid].read(callback);
};

FlowerPower.prototype.readStringCharacteristic = function (uuid, callback) {
   this.readDataCharacteristic(uuid, function (error, data) {
      if (error === null) {
         var i;
         for (i = 0; i < data.length; i = i + 1) {
            if (data[i] === 0x00) {
               data = data.slice(0, i);
               break;
            }
         }
         data = data.toString();
      }
      callback(error, data);
   });
};

FlowerPower.prototype.readSystemId = function (callback) {
   this.readDataCharacteristic(SYSTEM_ID_UUID, function (error, data) {
      if (error === null) {
         var systemId = data.toString('hex').match(/.{1,2}/g).reverse().join('').toUpperCase();
         callback(null, systemId);
      } else {
         callback(error, null);
      }
   });
};

FlowerPower.prototype.readSerialNumber = function (callback) {
   this.readStringCharacteristic(SERIAL_NUMBER_UUID, callback);
};

FlowerPower.prototype.readFirmwareRevision = function (callback) {
   this.readStringCharacteristic(FIRMWARE_REVISION_UUID, callback);
};

FlowerPower.prototype.readHardwareRevision = function (callback) {
   this.readStringCharacteristic(HARDWARE_REVISION_UUID, callback);
};

FlowerPower.prototype.readBatteryLevel = function (callback) {
   this.readDataCharacteristic(BATTERY_LEVEL_UUID, function (error, data) {
      if (error === null) {
         callback(null, data.readUInt8(0));
      } else {
         callback(error, null);
      }
   });
};

FlowerPower.prototype.readFriendlyName = function (callback) {
   this.readStringCharacteristic(FRIENDLY_NAME_UUID, callback);
};

FlowerPower.prototype.writeFriendlyName = function (friendlyName, callback) {
   var data = new Buffer('00000000000000000000000000000000000000', 'hex');
   var i;
   for (i = 0; (i < friendlyName.length) && (i < data.length); i = i + 1) {
      data[i] = friendlyName[i];
   }

   this.writeDataCharacteristic(FRIENDLY_NAME_UUID, data, callback);
};

FlowerPower.prototype.readColor = function (callback) {
   this.readDataCharacteristic(COLOR_UUID, function (error, data) {
      if (error === null) {
         var colorCode = data.readUInt16LE(0);

         var COLOR_CODE_MAPPER = {
            4: 'brown',
            6: 'green',
            7: 'blue'
         };

         var color = COLOR_CODE_MAPPER[colorCode] || 'unknown';
         callback(null, color);
      } else {
         callback(error, null);
      }
   }.bind(this));
};

FlowerPower.prototype.convertSunlightData = function (data) {
   var value = Math.round(data.readUInt16LE(0) / 10.0) * 10; // only have 10% of mapping data

   if (value < 0) {
      value = 0;
   } else if (value > 65530) {
      value = 65530;
   }

   var sunlight = SUNLIGHT_VALUE_MAPPER[value];

   return sunlight;
};

FlowerPower.prototype.readSunlight = function (callback) {
   this.readDataCharacteristic(SUNLIGHT_UUID, function (error, data) {
      if (error === null) {
         var sunlight = this.convertSunlightData(data);

         callback(null, sunlight);
      } else {
         callback(error, null);
      }
   }.bind(this));
};

FlowerPower.prototype.onSunlightChange = function (data) {
   var sunlight = this.convertSunlightData(data);

   this.emit('sunlightChange', sunlight);
};

FlowerPower.prototype.notifySunlight = function (callback) {
   this.notifyCharacteristic(SUNLIGHT_UUID, true, this.onSunlightChange.bind(this), callback);
};

FlowerPower.prototype.unnotifySunlight = function (callback) {
   this.notifyCharacteristic(SUNLIGHT_UUID, false, this.onSunlightChange.bind(this), callback);
};

FlowerPower.prototype.convertTemperatureData = function (data) {
   var value = data.readUInt16LE(0);

   if (value < 210) {
      value = 210;
   } else if (value > 1372) {
      value = 1372;
   }

   var temperatureC = TEMPERATURE_VALUE_MAPPER.C[value];
   var temperatureF = TEMPERATURE_VALUE_MAPPER.F[value];

   return {
      C: temperatureC,
      F: temperatureF
   };
};

FlowerPower.prototype.readTemperature = function (callback) {
   this.readDataCharacteristic(TEMPERATURE_UUID, function (error, data) {
      if (error === null) {
         var temperature = this.convertTemperatureData(data);
         callback(null, temperature.C, temperature.F);
      } else {
         callback(error);
      }
   }.bind(this));
};

FlowerPower.prototype.onTemperatureChange = function (data) {
   var temperature = this.convertTemperatureData(data);

   this.emit('temperatureChange', temperature.C, temperature.F);
};

FlowerPower.prototype.notifyTemperature = function (callback) {
   this.notifyCharacteristic(TEMPERATURE_UUID, true, this.onTemperatureChange.bind(this), callback);
};

FlowerPower.prototype.unnotifyTemperature = function (callback) {
   this.notifyCharacteristic(TEMPERATURE_UUID, false, this.onTemperatureChange.bind(this), callback);
};


FlowerPower.prototype.convertSoilMoistureData = function (data) {
   var value = data.readUInt16LE(0);

   if (value < 210) {
      value = 210;
   } else if (value > 700) {
      value = 700;
   }

   var soilMoisture = SOIL_MOISTURE_VALUE_MAPPER[value];

   return soilMoisture;
};

FlowerPower.prototype.readSoilMoisture = function (callback) {
   this.readDataCharacteristic(SOIL_MOISTURE_UUID, function (error, data) {
      var soilMoisture = this.convertSoilMoistureData(data);
      callback(error, soilMoisture);
   }.bind(this));
};

FlowerPower.prototype.onSoilMoistureChange = function (data) {
   var soilMoisture = this.convertSoilMoistureData(data);

   this.emit('soilMoistureChange', soilMoisture);
};

FlowerPower.prototype.notifySoilMoisture = function (callback) {
   this.notifyCharacteristic(SOIL_MOISTURE_UUID, true, this.onSoilMoistureChange.bind(this), callback);
};

FlowerPower.prototype.unnotifySoilMoisture = function (callback) {
   this.notifyCharacteristic(SOIL_MOISTURE_UUID, false, this.onSoilMoistureChange.bind(this), callback);
};

FlowerPower.prototype.enableLiveMode = function (callback) {
   this.notifySunlight(function () {
      this.notifyTemperature(function () {
         this.notifySoilMoisture(function () {
            this.writeDataCharacteristic(LIVE_MODE_UUID, new Buffer([0x01]), callback);
         }.bind(this));
      }.bind(this));
   }.bind(this));
};

FlowerPower.prototype.disableLiveMode = function (callback) {
   this.writeDataCharacteristic(LIVE_MODE_UUID, new Buffer([0x00]), function () {
      this.unnotifySunlight(function () {
         this.unnotifyTemperature(function () {
            this.unnotifySoilMoisture(function () {
               callback();
            }.bind(this));
         }.bind(this));
      }.bind(this));
   }.bind(this));
};


FlowerPower.prototype.getHistoryContext = function (callback) {
   var self = this;
   async.parallel({
      nbEntries: function (callback) {
         self.readDataCharacteristic(HISTORY_NB_ENTRIES_CHAR_UUID, function (error, data) {
            if (error !== null) {
               callback(error, null);
            } else {
               callback(null, data.readUInt16LE(0));
            }
         });
      },
      lastEntryIdx: function (callback) {
         self.readDataCharacteristic(HISTORY_LASTENTRY_IDX_CHAR_UUID, function (error, data) {
            if (error !== null) {
               callback(error, null);
            } else {
               callback(null, data.readUInt32LE(0));
            }
         });
      },
      currentSessionId: function (callback) {
         self.readDataCharacteristic(HISTORY_CURRENT_SESSION_ID_CHAR_UUID, function (error, data) {
            if (error !== null) {
               callback(error, null);
            } else {
               callback(null, data.readUInt16LE(0));
            }
         });
      },
      sessionStartIdx: function (callback) {
         self.readDataCharacteristic(HISTORY_CURRENT_SESSION_START_IDX_CHAR_UUID, function (error, data) {
            if (error !== null) {
               callback(error, null);
            } else {
               callback(null, data.readUInt32LE(0));
            }
         });
      },
      sessionPeriod: function (callback) {
         self.readDataCharacteristic(HISTORY_CURRENT_SESSION_PERIOD_CHAR_UUID, function (error, data) {
            if (error !== null) {
               callback(error, null);
            } else {
               callback(null, data.readUInt16LE(0));
            }
         });
      }
   }, function (err, results) {
      if (err !== null) {
         callback(err, null);
      } else {
         callback(null, results);
      }
   });
};

FlowerPower.prototype.writeTxStartIdx = function (startIdx, callback) {
   console.log("write start idx:" + startIdx);
   var startIdxBuff = new Buffer(4);
   startIdxBuff.writeUInt32LE(startIdx, 0);
   this.writeDataCharacteristic(HISTORY_TRANSFER_START_IDX_CHAR_UUID, startIdxBuff, callback);
};

FlowerPower.prototype.getStartupTime = function (callback) {
   this.readDataCharacteristic(CLOCK_CURRENT_TIME_UUID, function (error, data) {
      if (error !== null){
         callback(error, null);
      } else {
         var startupTime = new Date();
         startupTime.setTime (startupTime.getTime() - data.readUInt32LE(0)*1000);         
         callback(null, startupTime);
      }
   });
};


function UploadBuffer(buffer) {
   this.idx  = buffer.readUInt16LE(0);
   this.data = new Buffer(buffer.slice(2));
   return this;
}

function Upload(fp, callback) {
   this.fp = fp;
   this.buffers = [];
   
   this.currentIdx = 0;
   
   this.RxStatusEnum = {
      STANDBY: 0,
      RECEIVING: 1,
      ACK: 2,
      NACK: 3,
      CANCEL: 4,
      ERROR: 5
   };
   
   this.TxStatusEnum = {
      IDLE: 0,
      TRANSFERING: 1,
      WAITING_ACK: 2
   };
   
   this.rxStatus = this.RxStatusEnum.STANDBY;
   this.TxStatus = this.TxStatusEnum.IDLE;
   
   this.finishCallback = callback;
   
   this.startUpload(function(err){
      if (err !== null) {
         this.finishCallback(err, null);
      }
   });
   
   this.fileLength = null;
   this.bufferLength = null;
   this.nbTotalBuffers = null;
   
   return this;
}

Upload.prototype.onWaitingAck = function(callback) {
   var success = true;
   for (var idx=this.currentIdx; ((idx < this.currentIdx+128) && (idx < this.nbTotalBuffers)); idx++) {
      if (idx>0){
         if (!this.buffers.hasOwnProperty(idx)){
            console.log("buffer idx:" + idx + " not found");
            success = false;
            break;
         }
      }
   }
   if (success === true) {
      this.currentIdx += 128;
      if (this.currentIdx >= this.nbTotalBuffers){
         this.historyFile = Buffer.concat( this.buffers.slice(1), this.fileLength);
      }
      this.writeRxStatus(this.RxStatusEnum.ACK, callback);
   }
   else {
      this.writeRxStatus(this.RxStatusEnum.NACK, callback);
   }
};

Upload.prototype.onTxStatusChange = function (data) {
   this.txStatus = data.readUInt8(0);
   
   if(this.txStatus === this.TxStatusEnum.WAITING_ACK) {
      this.onWaitingAck();
   }
   if(this.txStatus === this.TxStatusEnum.IDLE) {
      console.log("transfer finished");
      this.finishUpload( function(){
            if (this.historyFile !== null) {
               this.finishCallback(null, this.historyFile.toString('base64'));
            }
            else {
               this.finishCallback(new Error("Transfer failed", null));
            }
         }.bind(this));
   }
};

Upload.prototype.setFileLength = function (fileLength) {
   this.fileLength = fileLength;
   this.nbTotalBuffers = Math.ceil(this.fileLength / this.bufferLength)+1;
};

Upload.prototype.readFirstBuffer = function (buffer) {
   this.bufferLength = buffer.length; 
   this.setFileLength(buffer.readUInt32LE(0));
};

Upload.prototype.onTxBufferReceived = function (data) {
   var buffer = new UploadBuffer(data);   
   this.buffers[buffer.idx] = buffer.data;
   if (buffer.idx === 0) {
      this.readFirstBuffer(buffer.data);
   }
   console.log("downloaded: " + Math.round(100 * (buffer.idx+1)/this.nbTotalBuffers) + " %");
};

Upload.prototype.notifyTxStatus = function (callback) {
   this.fp.notifyCharacteristic(UPLOAD_TX_STATUS_CHAR_UUID, true, this.onTxStatusChange.bind(this), callback);
};

Upload.prototype.notifyTxBuffer = function (callback) {
   this.fp.notifyCharacteristic(UPLOAD_TX_BUFFER_CHAR_UUID, true, this.onTxBufferReceived.bind(this), callback);
};

Upload.prototype.unnotifyTxStatus = function (callback) {
   this.fp.notifyCharacteristic(UPLOAD_TX_STATUS_CHAR_UUID, false, this.onTxStatusChange.bind(this), callback);
};

Upload.prototype.unnotifyTxBuffer = function (callback) {
   this.fp.notifyCharacteristic(UPLOAD_TX_BUFFER_CHAR_UUID, false, this.onTxBufferReceived.bind(this), callback);
};


Upload.prototype.writeRxStatus = function (rxStatus, callback) {
   var rxStatusBuff = new Buffer(1);
   rxStatusBuff.writeUInt8(rxStatus, 0);
   this.fp.writeDataCharacteristic(UPLOAD_RX_STATUS_CHAR_UUID, rxStatusBuff, callback);
};


Upload.prototype.startUpload = function (callback) {
   
   async.series([
      this.notifyTxStatus.bind(this),
      this.notifyTxBuffer.bind(this),
      this.writeRxStatus.bind(this, this.RxStatusEnum.RECEIVING) ],
      function (err, result) {
         callback(err, result);
      });
};

Upload.prototype.finishUpload = function (callback) {
   
   async.series([
      this.unnotifyTxStatus.bind(this),
      this.unnotifyTxBuffer.bind(this),
      this.writeRxStatus.bind(this, this.RxStatusEnum.STANDBY)],
      function (err, result) {
         callback(err, result);
      });
};


FlowerPower.prototype.getHistory = function (startIdx, callback) {
   this.writeTxStartIdx(startIdx, function(err) {
      if(err !== null){
         callback(err, null);
      }
      else{
         new Upload(this, callback);
      }
   }.bind(this));
};

module.exports = FlowerPower;
