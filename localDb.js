
var Datastore = require('nedb')
  , tokenDb = new Datastore({ filename: 'db/tokenDb' });

var events = require('events')
  , util = require('util');




var TokenDB = function (){
	tokenDb.loadDatabase(function (err) {
		tokenDb.ensureIndex({ fieldName: 'access_token', unique: true }, function (err) {
			self.getToken( function( err, token){
				if ((null === err) && (token !== undefined)){
					self.emit('token_set', token);
				}
			})
		});
	});
	self = this;
}

TokenDB.prototype = new events.EventEmitter;

TokenDB.prototype.getToken = function( callback){
	tokenDb.find({access_token: {$exists:true}}, function(err, docs){
		if (err){
			callback(err, null);
		}
		else{
			callback( null, docs[0]);
		}
	});		 
};

TokenDB.prototype.saveToken = function( token, callback){
	var tokenDoc = {
		access_token: token.access_token,
		expires_at: token.expires_at
	}
	tokenDb.update({access_token: {$exists:true}}, token, {upsert: true}, function(err, numReplace, newDoc){
		if (callback){
			callback( err, newDoc);	
			try {
				self.emit('token_set', newDoc);
			} catch(e) {
				self.emit('error', e);
			}
		}
	});
};



module.exports = TokenDB;