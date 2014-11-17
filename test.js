
var FlowerApi = require('./FlowerApi');

//base = 'https://parrot-hawaii-valid-api.herokuapp.com/' 
base = 'https://apiflowerpower.parrot.com/' 

fApi = new FlowerApi( base);

setTimeout(function(){
	fApi.getVersion();
	}, 1000);

