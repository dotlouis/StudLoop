module.exports = function(server) {
    console.log('inserting dummy data');
    var CustomUser = server.models.CustomUser;
    CustomUser.create({
        email: "2131700@dev.null",
        password: "2131700",
        username: "2131700"
    },function(err, user){
        if(err)
            console.log(err);
        console.log(user);
    });
};
