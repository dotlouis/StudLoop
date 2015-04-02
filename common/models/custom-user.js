var Promise = require('bluebird');
var request = require('request');
var cheerio = require('cheerio');
var ical = require('ical');
var _ = require('lodash');
var s = require('underscore.string');

Promise.promisifyAll(request);
Promise.promisifyAll(cheerio);
Promise.promisifyAll(ical);

String.prototype.capitalize = function(lowercase, all){
    if(all){
        return this.split(" ").map(function(currentValue, index, array){
            return currentValue.capitalize(lowercase);
        }, this).join(" ").split("-").map(function(currentValue, index, array){
            return currentValue.capitalize(false);
        }, this).join("-");
    }
    else{
        return lowercase ? this.charAt(0).toUpperCase() + this.slice(1).toLowerCase() : this.charAt(0).toUpperCase() + this.slice(1);
    }
};

module.exports = function(CustomUser) {

    // Wrap the model to make it Promise enabled
    // https://github.com/strongloop/loopback/issues/418
    // once a model is attached to the data source
    CustomUser.on('dataSourceAttached', function( obj ){
        // wrap the whole model in Promise but avoid the 'validate' method
        CustomUser = Promise.promisifyAll( CustomUser, {filter: function(name, func, target){
            return !( name == 'validate');
        }} );
    });

    CustomUser.scrapeResourceId = function(user){
        return request.getAsync({
            url: 'http://www.univ-orleans.fr/EDTWeb/edt',
            qs: {
                project: '2014-2015',
                action: 'displayWeeksPeople',
                person: user.username
            }
        })
        .then(function(response){
            var head = response[0];
            var body = response[1];

            if(head.statusCode != 200)
                throw new Error("ENT is unreacheable ("+head.statusCode+")");

            // we look for the export url to get the resources and project number
            var startOfUrl = body.indexOf('href=\"http://www.univ-orleans.fr/EDTWeb/export?');
            var endOfUrl = body.indexOf('\u0026amp;type=ical\" target=\"Export\"');
            if(startOfUrl == -1 || endOfUrl == -1)
                throw new Error("ResourceId not found in page");

            var exportUrl = body.substring(startOfUrl,endOfUrl);
            var project = exportUrl.substring(exportUrl.indexOf('project=')+8, exportUrl.indexOf('\u0026amp;resources='));
            var resourceId = exportUrl.substring(exportUrl.indexOf('resources=')+10);
            return user.updateAttributeAsync("resourceId", resourceId);
        });
    };

    CustomUser.scrapeName = function(user){
        return request.getAsync({
            url: 'https://aderead6.univ-orleans.fr/jsp/custom/modules/infos/members.jsp',
            qs: {
                uniqueId: user.resourceId,
                login: 'etuWeb',
                password: '',
                projectId: '2'
            }
        })
        .then(function(response){
            var head = response[0];
            var body = response[1];

            if(head.statusCode != 200)
                throw new Error("ADE is unreacheable ("+head.statusCode+")");

            var $ = cheerio.load(body);
            var name = $('span.title').text();
            if(name == '')
                throw new Error("Name not found in page");
            return user.updateAttributeAsync('name', name.capitalize(true, true));
        });
    };

    CustomUser.scrapeCalendar = function(user){
        return request.getAsync({
            url: 'http://www.univ-orleans.fr/EDTWeb/export',
            qs: {
                type: 'ical',
                project: '2014-2015',
                resources: user.resourceId
            }
        })
        .then(function(response){
            var head = response[0];
            var body = response[1];

            if(head.statusCode != 200)
                throw new Error("Problem fetching ical ("+head.statusCode+")");
            // convert the object in array and return
            return _.values(ical.parseICS(body));
        });
    }

    CustomUser.identity = function(id, callback){
        return this.findByIdAsync(id)
        .then(function(user){
            return CustomUser.scrapeResourceId(user);
        })
        .then(function(user){
            return CustomUser.scrapeName(user);
        })
        .nodeify(callback);
    };

    CustomUser.calendar = function(id, callback){
        return this.findByIdAsync(id)
        .then(function(user){
            return CustomUser.scrapeCalendar(user);
        })
        .then(function(calendar){
            var strippedCalendar = [];
            var Event = CustomUser.app.models.Event;
            var Course = CustomUser.app.models.Course;

            // For now only proceed with 20 events
            // when safely tested remove the strippedCalendar bits;
            for(var event = 0; event<20; event++){
                strippedCalendar[event] = calendar[event];
            }

            // Sequentially loop through all ical events and format them to
            // a proper Event instance
            Promise.each(strippedCalendar, Event.format)
            .catch(function(error){console.log(error);});

            return strippedCalendar;
        })
        .nodeify(callback);
    };

    // Create a chunk of data based on a raw string
    CustomUser.chunkFromString = function(str){
        var lines = s.lines(str.toLowerCase());
        // remove the starting empty line
        lines.shift();
        var chunk = {
            speakers: [],
            attendees: []
        };

        for(l in lines){
            // if the string contains iut_info then it's a group of attendees
            var groupIndex = lines[l].indexOf('iut_info-');
            if(groupIndex == -1)
                chunk.speakers.push(s.titleize(lines[l]));
            else
                chunk.attendees.push(lines[l].substring(groupIndex+9));
        }
        return chunk;
    };

    CustomUser.remoteMethod('identity', {
        description: "Scrapes user identity (based on his username)",
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
        returns: {arg: 'calendar', type: 'object'},
        http: {verb: 'get', path: '/:id/calendar'}
    });

};
