token = "1wOMLPKtI84ikvsc4v1fGGuiy6UGaVS8mXuhF1ZUDh8v8SqW"

var requestify  = require('requestify');

requestify.get('https://apiflowerpower.parrot.com/user/v4/profile', {
      "headers": {
         'Authorization' : "Bearer " + token
}}).then(function(response){
   user = response.getBody();
   console.log(user.user_config_version);
});

var apiList = {
   'get_user_profile': 'user/v4/profile',
   'test': 'test'

}