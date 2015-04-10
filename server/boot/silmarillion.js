module.exports = function(server) {
    server.models.CustomUser.create([
        {username: 'sauron', name:'Sauron', email: 'sauron@mordor.com', password: 'maiar'}
    ], function(err, users) {
        if(err) return console.error('%j', err);

        // Create the admin role
        server.models.Role.create({
            name: 'god'
        }, function(err, role) {
            if(err) return console.error(err);
            console.log(role);

            // Make Sauron a god
            role.principals.create({
                principalType: server.models.RoleMapping.USER,
                principalId: users[0].id
            }, function(err, principal) {
                if(err) return console.error(err);
                console.log(principal);
            });
        });
    });
};
