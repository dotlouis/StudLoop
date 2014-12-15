module.exports = function(server) {
  console.log('inserting dummy data');
  var User = server.models.User;
  User.create({
      email: "2131700@dev.null",
      password: "2131700",
      username: "2131700"
  },function(err, user){
      console.log(user);
  })
};
