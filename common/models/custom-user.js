var request = require('request');
var cheerio = require('cheerio');

module.exports = function(CustomUser) {

    CustomUser.beforeCreate = function(next, user) {

        next();
    };

    CustomUser.scrapeResourceNumber = function(univId, callback){
        request({
            url: 'http://www.univ-orleans.fr/EDTWeb/edt',
            qs: {
                project: '2014-2015',
                action: 'displayWeeksPeople',
                person: univId
            }},
            function(error, response, body){
                if (error)
                    callback(error);
                else if (response.statusCode != 200)
                    callback(response.statusCode);
                else {
                    // we look for the export url to get the resources and project number
                    var startOfUrl = body.indexOf('href=\"http://www.univ-orleans.fr/EDTWeb/export?');
                    var endOfUrl = body.indexOf('\u0026amp;type=ical\" target=\"Export\"');
                    if(startOfUrl == -1 || endOfUrl == -1)
                        callback("resource number not found");
                    else{
                        var exportUrl = body.substring(startOfUrl,endOfUrl);
                        var project = exportUrl.substring(exportUrl.indexOf('project=')+8, exportUrl.indexOf('\u0026amp;resources='));
                        var resource = exportUrl.substring(exportUrl.indexOf('resources=')+10);
                        CustomUser.scrapeName(resource, callback);
                    }
                }
            }
        );
    };

    CustomUser.scrapeName = function(resourceNumber, callback){
        request({
            url: 'https://aderead6.univ-orleans.fr/jsp/custom/modules/infos/members.jsp',
            qs: {
                uniqueId: resourceNumber,
                login: 'etuWeb',
                password: '',
                projectId: '2'
            }},
            function(error, response, body){
                if (error)
                    callback(error);
                else if (response.statusCode != 200)
                    callback(response.statusCode);
                else {
                    var $ = cheerio.load(body);
                    var name = $('span.title').text();
                    if(name == '')
                        callback("problem with the name");
                    else
                        callback(null, name);
                }
            }
        );
    };

    CustomUser.identity = function(id, callback){
        this.findById(id, function(error, user){
            if(error)
                callback(error);
            else{
                console.log(user);
                CustomUser.scrapeResourceNumber(user.username, callback);
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

};
