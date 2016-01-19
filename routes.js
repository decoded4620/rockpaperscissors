console.log("Setting up routes...");
Router.configure({
    // the default layout
    layoutTemplate: 'main'
});

// Router Setup

// Path based routes
Router.route('/home', function(){
    Router.go('/register');
});
// Default page is 'register'
Router.route('/', function () {
    Router.go('/register');
});
//register page
Router.route('/register', function(){
    console.log("rendering register...");
    // clear this each time we revisit the register page
    Session.set(SessionKeys.PLAYER_ID,null);
 // set the layout programmatically
    this.render('registerMe');
});


/**
 * Attempts to join a room
 */
Router.route('/rooms/:roomId', function(){
    
    // player is in session if and only if he has logged in.
    var playerId    = Session.get(SessionKeys.PLAYER_ID);
    var token       = Session.get(SessionKeys.TOKEN);
    var roomId      = this.params.roomId;
    
    if(playerId == null || playerId === undefined || token == null || token === undefined){
        // send them packing..
        Router.go('/register');
    }
    else {
        console.log("Route:/rooms/" + roomId);
        var thisRenderer = this;

        Meteor.call("playerMethods_joinRoom", roomId, playerId, token, function(error, results){
            if(!error || error === undefined){
                Delegates.Route.on_playerMethods_joinRoom(results);
                
                // render the data into the 'lobby' template
                thisRenderer.render("lobby");
            }
            else{
                Delegates.Errors.failover("Failed to join room");
            }
        });
    }
});

//register page
Router.route('/game/', function(){
  console.log('Router.route(/game)');
  // set the layout programmatically
  
  if(!Session.get(SessionKeys.CURRENT_GAME_ID)){
      if(!Session.get(SessionKeys.PLAYER_ID) || !Session.get(SessionKeys.TOKEN)){
          Router.go('/register');
      }
      else{
          // rejoin the game?
          var currentGameId = Session.get(SessionKeys.CURRENT_GAME_ID);
          if(!currentGameId || currentGameId === undefined){
              currentGameId = Session.get(SessionKeys.WAIT_FOR_GAME_ID);
          }
          
          if(currentGameId != null && currentGameId !== undefined){
              Router.go('/game/' + currentGameId);
          }
      }
  }
});


// Variable based routes
Router.route('/game/:gameId/waitForPlayers', function(){
    console.log("Router.route(/game/" + this.params.gameId + "/waitForPlayers)");
    Delegates.Route.waitForPlayers(this.params.gameId);
});


Router.route('/player/:playerName',function()
{
  console.log("Router.Route(/player/" + this.params.playerName + ")");
  
  player = Db.PlayerDB.findPlayer(this.params.playerName);
      
  if(!player){
      // create a player object.
      playerObj = {_id:this.params.playerName, pwd:null};
      Meteor.call(
          "playerMethods_createPlayer", 
          playerObj,
          function(error, result){
              console.log("playerMethods_createPlayer::result() - " + error + ", " + result);
              if(!error || error  === undefined){
                  Delegates.Route.on_playerMethods_createPlayer(result, playerObj);
              }
              else{
                  console.log("there was an error with creating player" + error);
                  // fail
                  Router.go('/register');
              }
          }
      );
  }
  else {
      Meteor.call(
          "playerMethods_login",
          {_id:this.params.playerName, pwd:null},
          // handles async result of calling the server method 'playerMethods_login'
          function(error, result){
              
              if(!error || error === undefined){
                  // have the delegate handle the result
                  Delegates.Route.on_playerMethods_login(result);
              }
              else{
                  console.log("Error: " + error);
                  // fail
                  Router.go('/register');
              }
          }
      );
  }
  
}/*, {where:"server"}*/);
Router.route('/logout',function(){
    var playerId = Session.get(SessionKeys.PLAYER_ID);
    var token = Session.get(SessionKeys.TOKEN);
    console.log("client::logout()");
    
    Meteor.call('playerMethods_logout', playerId, token, function(error,result){
        
        console.log("client::logout::result() - " + error + ", " + result);
        if(!error || error === undefined){
            Delegates.Route.on_playerMethods_logout(result);
        }
        else{
            console.log("fail");
            Router.go('/register');
        }
    });
});

Router.route('/game/:gameId', function(){
    console.log("Route:/game/" + this.params.gameId);
    
    var playerId = Session.get(SessionKeys.PLAYER_ID);
    var token = Session.get(SessionKeys.TOKEN);
    var thisRef = this;
    console.log("Route:/game/" + this.params.gameId + "/");
    
    var waitingForGame = Session.get('waitFormGameId');
    
    console.log("check waiting for game: " + waitingForGame);
    
    if(waitingForGame != null){
        this.render('waitingForGame');
        return;
    }
    
    var currentGameId = Session.get(SessionKeys.CURRENT_GAME_ID);
    console.log("check current game: " + currentGameId);
    
    if(currentGameId != null){
        
        var game = Db.GameDB.findGame(currentGameId);
        if(game.current_player == playerId){
            // show the in game template.
            thisRef.render('inGameMyTurn');
            Client.stopMoveWait();
        }
        else{
            Session.set(SessionKeys.CURRENT_GAME_ID, game._id);
            Client.startMoveWait(1500);
            thisRef.render('inGameTheirTurn');
        }
        return;
    }
    
    Meteor.call(
        'gameMethods_joinGame', 
        this.params.gameId, playerId, token, 
        function(error,result){
            if(!error || error === undefined){
                Delegates.Route.on_gameMethods_joinGame(result, thisRef, playerId );
            }
            else{
                Delegates.Route.on_playerMethods_logout(result);
            }
        }
    );
});

Router.route('game/:gameId/results', function(){
    this.render("myGameResults");
    Client.restartHeartbeat(10000);
});

Router.route('/leaderboard', function(){
    this.render("leaderboard");
});

Router.route('/profile', function(){
    console.log("profile!");
    this.render("myProfile");
});
Router.route('/profiles/:userId', function(){
    
    var playerId    = Session.get(SessionKeys.PLAYER_ID);
    var token       = Session.get(SessionKeys.TOKEN);
    
    var userId = this.params.userId;
    var thisRef     = this;
    Meteor.call(
        'siteMethods_viewProfile', 
        this.params.userId, playerId, token, 
        function(error,result){
            if(!error || error === undefined){
                if(result.status == HTTPStatusCodes.OK){
                    Session.set(SessionKeys.PLAYER_PROFILE_ID, userId);
                    thisRef.render("theirProfile");
                }
            }
            else{
                Router.go('rooms/' + Db.RoomDB.DEFAULT_ROOM_ID);
            }
        }
    );
});

Router.route('game/:gameId/leaderboard', function(){
    this.render("gameLeaderboard");
});
/**
 * Route for making a move in the game
 */
Router.route('/game/:gameId/:move', function(){
    
    var playerId = Session.get(SessionKeys.PLAYER_ID);
    var move = this.params.move;
    var gameId = this.params.gameId;
    console.log("Route:/game/" + gameId + "/" + move);
    
    if(move === undefined || gameId === undefined){
        console.log("incorrect move or game");
        Router.go('rooms/'+ Db.RoomDB.DEFAULT_ROOM_ID);
        return;
    }
    
    Meteor.call(
        "gameMethods_makeMove",
        gameId, playerId, move, Session.get(SessionKeys.TOKEN),
        function(error, result){
            if(!error || error === undefined){
                console.log("Route:/game/" + gameId + "/" + move + " result: " + result);
                
                if(result.winnerId != null && result.winnerId !== undefined){
                   Client.stopMoveWait();
                   Router.go('/game/' + gameId + '/results'); 
                }
                else{
                    // once we've made our move, start the move wait again by going back to the game
                    Router.go('/game/' + gameId);
                }
            }
            else
            {
               console.log("Route:/game/" + gameId + "/" + move + " failed: " + error);
               Delegates.Route.on_playerMethods_logout(result);
            }
        }
    );
});

console.log("Routes setup!");