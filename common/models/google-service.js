var Promise = require('bluebird');
var googleapis = require('googleapis');

// Allow to require from the app entry file
// See https://gist.github.com/branneman/8048520 (7. The Wrapper)
var gConf = require.main.require('./google-config.json');

Promise.promisifyAll(googleapis.auth);

module.exports = function(GoogleService) {

    var jwt;
    var tokens;

    GoogleService.on('attached', function(obj){
        GoogleService = Promise.promisifyAll( GoogleService, {filter: function(name, func, target){
            return !( name == 'validate');
        }} );
        // Authorize app to service account at init
        GoogleService.authorize();
    });

    GoogleService.authorize = function(){

        jwt = new googleapis.auth.JWT(
            gConf.serviceEmail,
            gConf.serviceKeyFile,
            null,
            gConf.serviceScope
        );

        // Good idea to store tokens ?
        return jwt.authorizeAsync().then(function(tokens){
            return GoogleService.tokens = tokens;
        }, function(error){console.log(error);});
    };

    GoogleService.promisifyAPI = function(api){
        // Because googleapis are nested object we need to go through the
        // object properties to promisify all functions of the api
        for(object in api)
            api[object] = Promise.promisifyAll(api[object]);
        return api;
    };

    GoogleService.API = function(api){
        var apiObject;

        switch (api) {
            case "calendar":
                apiObject = googleapis.calendar({ version: 'v3', auth: jwt });
                break;
            default:
                apiObject = new Error("No valid api provided");
        };

        // return the promisified API object ready to be consumed
        return GoogleService.promisifyAPI(apiObject);
    };
};
