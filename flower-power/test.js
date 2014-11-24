/* jslint node: true */

var async = require('async');
var util = require('util');

var FlowerPower = require('./index');
var startIdx = 0;

FlowerPower.discover(function(flowerPower) {
  async.series([
    function(callback) {
      flowerPower.on('disconnect', function() {
        console.log('disconnected!');
        process.exit(0);
      });

      flowerPower.on('sunlightChange', function(sunlight) {
        console.log('sunlight = ' + sunlight.toFixed(2));
      });

      flowerPower.on('temperatureChange', function(temperatureC, temperatureF) {
        console.log('temperature = ' + temperatureC + '°C, ' + temperatureF + '°F');
      });

      flowerPower.on('soilMoistureChange', function(soilMoisture) {
        console.log('soil moisture = ' + soilMoisture + '%');
      });

      console.log('connect');
      flowerPower.connect(callback);
    },
    function(callback) {
      console.log('discoverServicesAndCharacteristics');
      flowerPower.discoverServicesAndCharacteristics(callback);
    },
    function(callback) {
      console.log('readSystemId');
      flowerPower.readSystemId(function(error, systemId) {
        console.log('\tsystem id = ' + systemId);
        callback();
      });
    },
    function(callback) {
      console.log('readSerialNumber');
      flowerPower.readSerialNumber(function(error, serialNumber) {
        console.log('\tserial number = ' + serialNumber);
        callback();
      });
    },
    function(callback) {
      console.log('readFirmwareRevision');
      flowerPower.readFirmwareRevision(function(error, firmwareRevision) {
        console.log('\tfirmware revision = ' + firmwareRevision);
        callback();
      });
    },
    function(callback) {
      console.log('readHardwareRevision');
      flowerPower.readHardwareRevision(function(error, hardwareRevision) {
        console.log('\thardware revision = ' + hardwareRevision);
        callback();
      });
    },
    function(callback) {
      console.log('readBatteryLevel');
      flowerPower.readBatteryLevel(function(error, batteryLevel) {
        console.log('battery level = ' + batteryLevel);

        callback();
      });
    },
     
    function(callback) {
      console.log('getHistoryContext');
      flowerPower.getHistoryContext(function(error, historyContext) {
        startIdx = historyContext.lastEntryIdx - 200;
        console.log('history context' + util.inspect(historyContext));
        callback();
      });
    }, 
     
    function(callback) {
      console.log('getHistory');
      flowerPower.getHistory(startIdx, function(error, history) {
        console.log(error, 'history received:' + history);
        callback();
      });
    }, 
    function(callback) {
      console.log('readFriendlyName');
      flowerPower.readFriendlyName(function(error, friendlyName) {
        console.log('\tfriendly name = ' + friendlyName);
        callback();
      });
    },
    function(callback) {
      console.log('readColor');
      flowerPower.readColor(function(color) {
        console.log('\tcolor = ' + color);

        callback();
      });
    },
    function(callback) {
      console.log('readSunlight');
      flowerPower.readSunlight(function(error, sunlight) {
        console.log('sunlight = ' + sunlight.toFixed(2));

        callback();
      });
    },
    function(callback) {
      console.log('readTemperature');
      flowerPower.readTemperature(function(error, temperatureC, temperatureF) {
        console.log('temperature = ' + temperatureC + '°C, ' + temperatureF + '°F');

        callback();
      });
    },
    function(callback) {
      console.log('readSoilMoisture');
      flowerPower.readSoilMoisture(function(error, soilMoisture) {
        console.log('soil moisture = ' + soilMoisture + '%');

        callback();
      });
    },
    function(callback) {
      console.log('enableLiveMode');
      flowerPower.enableLiveMode(callback);
    },
    function(callback) {
      console.log('live mode');
      setTimeout(callback, 5000);
    },
    function(callback) {
      console.log('disableLiveMode');
      flowerPower.disableLiveMode(callback);
    },
    function(callback) {
      console.log('disconnect');
      flowerPower.disconnect(callback);
    }
  ]);
});
