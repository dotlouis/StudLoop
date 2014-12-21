var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');
var ical = require('ical');

String.prototype.capitalize = function( lowercase, all ) {
    if( all ) {
        return this.split( " " ).map( function( currentValue, index, array ) {
            return currentValue.capitalize( lowercase );
        }, this ).join( " " ).split( "-" ).map( function( currentValue, index, array ) {
            return currentValue.capitalize( false );
        }, this ).join( "-" );
    }
    else {
        return lowercase ? this.charAt( 0 ).toUpperCase() + this.slice( 1 ).toLowerCase() : this.charAt( 0 ).toUpperCase() + this.slice( 1 );
    }
};

module.exports = function(CustomUser) {

    CustomUser.beforeCreate = function(next, user) {

        next();
    };

    CustomUser.scrapeResourceId = function(user, callback){
        request({
            url: 'http://www.univ-orleans.fr/EDTWeb/edt',
            qs: {
                project: '2014-2015',
                action: 'displayWeeksPeople',
                person: user.username
            }},
            function(error, response, body){
                if (error)
                    callback(error);
                else if (response.statusCode != 200)
                    callback("ENT is unreacheable ("+response.statusCode+")");
                else {
                    // we look for the export url to get the resources and project number
                    var startOfUrl = body.indexOf('href=\"http://www.univ-orleans.fr/EDTWeb/export?');
                    var endOfUrl = body.indexOf('\u0026amp;type=ical\" target=\"Export\"');
                    if(startOfUrl == -1 || endOfUrl == -1)
                        callback("ResourceId not found in page");
                    else{
                        var exportUrl = body.substring(startOfUrl,endOfUrl);
                        var project = exportUrl.substring(exportUrl.indexOf('project=')+8, exportUrl.indexOf('\u0026amp;resources='));
                        var resourceId = exportUrl.substring(exportUrl.indexOf('resources=')+10);
                        user.updateAttribute("resourceId", resourceId, function(error, user){
                            CustomUser.scrapeName(user, callback);
                            // CustomUser.scrapeCalendar(user, project, callback);
                        });
                    }
                }
            }
        );
    };

    CustomUser.scrapeName = function(user, callback){
        request({
            url: 'https://aderead6.univ-orleans.fr/jsp/custom/modules/infos/members.jsp',
            qs: {
                uniqueId: user.resourceId,
                login: 'etuWeb',
                password: '',
                projectId: '2'
            }},
            function(error, response, body){
                if (error)
                    callback(error);
                else if (response.statusCode != 200)
                    callback("ADE is unreacheable ("+response.statusCode+")");
                else {
                    var $ = cheerio.load(body);
                    var name = $('span.title').text();
                    if(name == '')
                        callback("Name not found in page");
                    else{
                        user.updateAttribute('name', name.capitalize(true, true), function(error, user){
                            callback(null, user.name);
                        });
                    }
                }
            }
        );
    };

    CustomUser.scrapeCalendar = function(user, projectNumber){
        request({
            url: 'http://www.univ-orleans.fr/EDTWeb/export',
            qs: {
                type: 'ical',
                project: projectNumber,
                resources: user.resourceId
            }},
            function(error, response, body){
                if(error)
                    console.log(error);
                else if(response.statusCode != 200)
                    console.log("problem fetching ical");
                else
                    console.log(body);
            }
        );
    }

    CustomUser.identity = function(id, callback){
        this.findById(id, function(error, user){
            if(error)
                callback(error);
            else
                CustomUser.scrapeName(user, callback);
        });

    };

    CustomUser.calendar = function(id, callback){
        fs.readFile('/Users/louis/Drive/EDT-Univ-Orleans.ics', 'utf8', function (err,data) {
            if (err) {
                console.log(err);
                callback(err);
            }
            else{
                var schedule = ical.parseICS(data);
                callback(null, schedule);
            }
        });
    };

    CustomUser.remoteMethod('identity', {
        description: "Scrapes user identity (base on his username)",
        accepts:[
            {
                arg: 'id',
                type: 'any',
                required: true,
                description: "Model id"
                // optional see: http://docs.strongloop.com/display/public/LB/Remote+methods#Remotemethods-HTTPmappingofinputarguments
                // http: {source: 'path'}
            }
        ],
        returns: {arg: 'name', type: 'string'},
        http: {verb: 'get', path: '/:id/identity'}
    });

    CustomUser.remoteMethod('calendar', {
        description: "Scrapes user's calendar",
            accepts:[
            {
                arg: 'id',
                type: 'any',
                required: true,
                description: "Model id"
            }
        ],
        returns: {arg: 'plop', type: 'string'},
        http: {verb: 'get', path: '/:id/calendar'}
});

};
