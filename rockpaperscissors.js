console.log("Main Application Start");

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
        
        // heartbeat
        Db.Collections.Heartbeat = new Mongo.Collection("heartbeat");
    }
}

// ===================================================== START EXECUTION
Startup.init();

// client only
if (Meteor.isClient) {
  // defined in global objects
  Client = {
     pollingIntervalId:-1,
     gameWaitIntervalId:-1,
     moveWaitIntervalId:-1,
     
     startHeartbeat:function(pollingTime=6000){
         if(Client.pollingIntervalId == -1){
             console.log("Client.startHeartbeat(" + pollingTime + ")");
             Client.pollingIntervalId = setInterval(Delegates.Intervals.heartBeat, pollingTime);
         }
     },
     restartHeartbeat:function(pollingTime=6000){
         Client.stopHeartbeat();
         Client.startHeartbeat(pollingTime);
     },
     stopHeartbeat:function(){
         if(Client.pollingIntervalId != -1){
             console.log("Client.stopHeartbeat()");
             clearInterval(Client.pollingIntervalId);
             Client.pollingIntervalId = -1;
         }
     },
     
     startGameWait:function(waitTime=1000, gameId){
         if(Client.gameWaitIntervalId == -1){
             console.log("Client.startGameWait(waitTime: " + waitTime + ", id: " + gameId + ")");
             Session.set(SessionKeys.WAIT_FOR_GAME_ID, gameId);
             Client.gameWaitIntervalId = setInterval(Delegates.Intervals.gameWait, waitTime);
         }
     },
     stopGameWait:function(){
         if(Client.gameWaitIntervalId != -1){
             console.log("Client.stopGameWait()");
             Session.set(SessionKeys.WAIT_FOR_GAME_ID, undefined);
             clearInterval(Client.gameWaitIntervalId);
             Client.gameWaitIntervalId = -1;
         }
     },
     
     startMoveWait:function(waitTime=2000){
         if(Client.moveWaitIntervalId == -1){
             console.log("startMoveWait");
             Client.moveWaitIntervalId = setInterval(Delegates.Intervals.moveWait, waitTime);
         }
     },
     stopMoveWait:function(){
         if(Client.moveWaitIntervalId != -1){
             console.log("stopMoveWait");
             clearInterval(Client.moveWaitIntervalId);
             Client.moveWaitIntervalId = -1;
         }
     },
     clearSessionKeys:function(session_keys){
         console.log("Client.clearSessionKeys(" + session_keys.join(",") + ")");
         var sLen = session_keys.length;
         
         for(var i = 0; i < sLen; ++i){
            console.log("Client.clearSessionKeys - clear key: " + session_keys[i]);
            Session.set(session_keys[i], undefined);
         }
     },
     clearSession:function(){
         console.log("Client.clearSession()");
         this.stopMoveWait();
         this.stopGameWait();
         this.stopHeartbeat();
         // Clear all session keys
         Object.keys(Session.keys).forEach(
             function(key){ 
                 console.log("Client.clearSession - clearing session key: " + key);
                 Session.set(key, undefined); 
             }
         );
         Session.keys = {};
     }
  };

  Meteor.startup (function(){
  });
}


// server only
if (Meteor.isServer) {
    Server = {
        mgInterval:-1,
        rmgInterval:-1,
        removeMarkedGames:function(){
            //every x minutes, the db will remove all abandoned games (up to a limit)
            result = Db.Collections.Games.remove({status:Db.Constants.GameStatus.ABANDONED});
            if(result == 0){
                return;
            }
            
            console.log("Server.removeMarkedGames(" + result + ")");
        },
        markGames:function(){
            //every x minutes, the db will remove all abandoned games (up to a limit)
            result = Db.Collections.Games.find({$or:[{status:Db.Constants.GameStatus.IN_PROGRESS}, {status:Db.Constants.GameStatus.WAITING_FOR_PLAYERS}]}, {limit:20}).fetch();

            var rLen =result.length;
            if(rLen > 0){
                console.log("Server.markGames(" + result.length + ")");
                
                for(var i:int = 0; i < rLen; i++){
                    // wash games
                    Db.GameDB.washGame(result[i]);
                }
            }
        }
    }
    Meteor.startup(function () {
      console.log("Meteor Server Started");
  
      // if the collection is empty
      if(Db.Collections.Rooms.findOne() == null){
          Db.Collections.Rooms.insert(new Db.Objects.Room("The Lobby","lobby"));
      }
    });
  // insure that the db stays clean
  Server.mgInterval     = Meteor.setInterval(Server.markGames, 120000);
  Server.rmgInterval    = Meteor.setInterval(Server.removeMarkedGames, 175000);
    
}
// code runs on both
