// Collection container for convenience

// startup methods
Startup = {
    init : function(){
        
        console.log("initialize collections");
        // games in action
        Db.Collections.Games = new Mongo.Collection("games");

        // players known
        Db.Collections.Players = new Mongo.Collection("players");

        // room
        Db.Collections.Rooms = new Mongo.Collection("rooms");
    }
}

// ===================================================== START EXECUTION
Startup.init();

// client only
if (Meteor.isClient) {
  console.log("Client started");
  // counter starts at 0
  Session.setDefault('counter', 0);

  Meteor.startup (function(){
  });
  
  
  
  Template.registerMe.events({
      'submit form': function () {
          
          // prevent any shenanigans.
          event.preventDefault(); 
          
          var playerName = event.target.playerName.value;
          console.log("submitting registry for player: " + playerName);
          
          if(!Db.PlayerDB.hasPlayer(playerName)){
              var player = new Db.Objects.Player();
              player._id = playerName;
              Db.PlayerDB.savePlayer( player);
              
          }
          else {
              player = Db.PlayerDB.findPlayer(player);
          }
          Session.set('playerId',playerName);
          Router.go('/player/' + playerName);
      }
  });
}


// server only
if (Meteor.isServer) {
  Meteor.startup(function () {
      console.log("Server Started");
     // code to run on server at startup
  });
  
}
// code runs on both
