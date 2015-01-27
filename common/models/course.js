var Promise = require('bluebird');
var s = require("underscore.string");

module.exports = function(Course) {

    Course.on('dataSourceAttached', function( obj ){
        // wrap the whole model in Promise but avoid the 'validate' method
        Course = Promise.promisifyAll( Course, {filter: function(name, func, target){
            return !( name == 'validate');
        }} );
    });

    // Find (or create if not found) the Course record matching the chunk data
    Course.matchFromChunk = function(chunk){
        return Course.findOrCreateAsync({
            where: {
                keywords: chunk.keywords
            }
        },
        {
            name: chunk.name,
            keywords: chunk.keywords
        });
    };

    // Create a chunk of data based on a raw string
    Course.chunkFromString = function(str){
        var words = s.words(str.toLowerCase());
        var chunk = {
            name: '',
            type: '',
            keywords: []
        };

        TYPES = ["cours","td","formation","tp"];

        // we check each words
        for(w in words){
            // remove any useless digits
            words[w] = words[w].replace(/\d+/g, '');

            // if the type is not determined yet, we check if the word is a type
            if(chunk.type == ''){
                var bestLevScore = -1;
                for(t in TYPES){
                    // we determine each type's levenshtein score with the word
                    // to find the closest match
                    var levScore = s.levenshtein(words[w], TYPES[t]);

                    // we allow types that are close of 2 permutations
                    if(levScore < 2){

                        // we keep the best lev score
                        if((levScore < bestLevScore) || bestLevScore == -1){
                            bestLevScore = levScore;

                            // we assign the type
                            chunk.type = TYPES[t];

                            // if exact match we get out the loop
                            if(bestLevScore == 0)
                            break;
                        }
                    }
                }

                // if the word still is not a type then it's a course
                if(chunk.type == '')
                chunk.name += ' '+words[w];
            }
            // if the type is already determined it's a course
            else
            chunk.name += ' '+words[w];

        }

        // clean the name of unwanted chars
        chunk.name = chunk.name.replace(/[\|&;\$%@"<>\(\)\+,]/g, "");
        // camel case, trim spaces, remove dashes and underscores
        chunk.name = s.humanize(chunk.name);
        // sort the keywords array to avoid distinction between 'mcd bd' and 'bd mcd'
        chunk.keywords = s.words(chunk.name.toLowerCase()).sort();

        return chunk;
    };

    // Sugar to chain chunkFromString() and matchFromChunk()
    Course.matchFromString = function(str){
        var chunk = Course.chunkFromString(str);
        return Course.matchFromChunk(chunk);
    };

    /******* START DEPRECIATED ***********/

    /*
    This part is depreciated because it was used before using sequential promises
    However this method is way faster because it does not wait for the course to be
    created in the DataSource before creating others.
    But it's a bit hacky and uses more queries: 1 to find() and 1 more to create()
    Besides the code is way less intuitive.
    Maybe later we can find a compromise between the speed of the "cache" method
    and the cleaner way of the "sequential" one.
    */

    Course.buffer = [];

    // Get the matching course from keywords from DS or cache
    Course.matchFromChunkWithCache = function(chunk){
        // we first check the DS for matching occurences
        return Course.findOneAsync({
            where: {
                keywords: chunk.keywords
            }
        })
        .then(function(course){

            if(!course){
                // Course not in DS
                // we check the cache for matching occurence
                var cachedCourse = Course.isCached(chunk);
                if(!cachedCourse){
                    // and not in Cache, Creating new instance
                    var courseData = new Course({
                        name: chunk.name,
                        keywords: chunk.keywords
                    });
                    // we push the new Course into the buffer;
                    Course.buffer.push(courseData);
                    return Course.create(courseData);
                }
                else{
                    // but in Cache, Retreiving existing instance
                    return cachedCourse;
                }
            }
            else
                return course;
        });
    };

    Course.isCached = function(chunk){
        var buff = Course.buffer;
        // We transform the keyword array into a string for easier matching
        var target = chunk.keywords.join(' ');

        for(b in buff){
            var keywords = buff[b].keywords.join(' ');
            if(keywords == target)
                return buff[b];
        }
        return false;
    };

    // bulk create the objects and clear the buffer
    Course.flush = function(){
        Course.buffer = [];
    };

    /******* END DEPRECIATED ***********/
};
