var Promise = require('bluebird');

module.exports = function(Event) {

    Event.on('dataSourceAttached', function( obj ){
        // wrap the whole model in Promise but avoid the 'validate' method
        Event = Promise.promisifyAll( Event, {filter: function(name, func, target){
            return !( name == 'validate');
        }} );
    });

    Event.format = function(rawEvent){
        var Course = Event.app.models.Course;
        var CustomUser = Event.app.models.CustomUser;

        // var course = Course.matchFromString(rawEvent.summary);
        // var contributors = CustomUser.matchFromString(rawEvent.description);

        var contributors = CustomUser.chunkFromString(rawEvent.description);

        return Promise.resolve(contributors);

        // return course.then(function(course){
        //     return new Event({
        //         start: rawEvent.start,
        //         end: rawEvent.end,
        //         location: rawEvent.location,
        //         course: course
        //         // type: course.type
        //         // attendees: contributors.attendees,
        //         // speakers: contributors.speakers
        //     });
        // });
    };
};
