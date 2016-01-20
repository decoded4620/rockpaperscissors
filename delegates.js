if(Meteor.isClient){
    // Client Delegate Methods
    Delegates = {
        Errors:{
            // if we have a failure and need to reset our session, etc.
            failover:function(msg=""){
                console.log("Delegates.Errors.failover() " + msg);
                
                // attempt to logout
                Meteor.call("playerMethods_logout",Session.get(SessionKeys.PLAYER_ID), Session.get(SessionKeys.TOKEN), function(error, results){
                    Delegates.Route.on_playerMethods_logout(results);
                });
            }
        },
        
        // Delegates for Client Intervals
        Intervals:{
            heartBeat:function(){
                var playerId = Session.get(SessionKeys.PLAYER_ID);
                var token = Session.get(SessionKeys.TOKEN);
                
                //console.log("Delegates.Intervals.heartBeat(" + playerId + ", " + token + ")");
                if(playerId && token){
                    
                    Meteor.call('playerMethods_heartBeat', playerId, token, function(error,results){
                       if(!error || error === undefined){
                           // delegate the result
                           Delegates.Route.on_playerMethods_heartBeat(results);
                       } 
                       else {
                           console.log("Delegates.Intervales.heartBeat.FAIL");
                       }
                    });
                }
            },
            gameWait:function(){
                var gameId = Session.get(SessionKeys.WAIT_FOR_GAME_ID);
                var game = Db.GameDB.findGame(gameId);
    //            console.log("Delegates.Intervals.gameWait(" + gameId + ")");
                
                // ping the server to see if the game is ready yet
                // and auto redirect.
                if(game != null ){
                    if(Db.GameDB.isInProgress(game)){
                        
                        // get the game we're waiting on
                        var readyGameId = Session.get(SessionKeys.WAIT_FOR_GAME_ID);
                        
                        console.log("Delegates.Intervals.gameWait - game is now in progress: " + gameId + ", status: " + game.status);
                        
                        // clears the session value above
                        Client.stopGameWait();
                        
                        // set that id as current
                        Session.set(SessionKeys.CURRENT_GAME_ID, readyGameId);
                        
                        // reload game screen
                        Router.go('/game/' + readyGameId);
                    }
                    else{
                        console.log("is game complete: " + Db.GameDB.isComplete(game));
                        if(Db.GameDB.isComplete(game)){
                            console.log("go back to lobby");
                            // back to lobby
                            Router.go('/rooms/lobby');
                        }
                    }
                }
            },
            
            // poll the game to see if its status has changed.
            moveWait:function(){
                var gameId = Session.get(SessionKeys.CURRENT_GAME_ID);
                
                console.log("Delegates.Intervals.moveWait(" + gameId + ")");
                
                if(gameId == null || gameId === undefined){
                    console.log("Delegates.Intervals.moveWait - gameId not received!");
                    // stop waiting for moves if the game id is a fail.
                    Client.stopMoveWait();
                    Router.go('/rooms/' + Db.RoomDB.DEFAULT_ROOM_ID);
                    return;
                }
                
                var game = Db.GameDB.findGame(gameId);
                
                // ping the server to see if the game is ready yet
                // and auto redirect.
                if(game != null && game !== undefined ){
                    // if the game is in progress still
                    if(Db.GameDB.isInProgress(game)){
                    
                        Session.set(SessionKeys.CURRENT_TURN_PLAYER, game.current_player);
                        
                        // if the current player is me
                        if(game.current_player === Session.get(SessionKeys.PLAYER_ID)){
                            
                            console.log("Its my turn! " + game.current_player);
                            // stop waiting for the move and go to 'my turn'
                            Client.stopMoveWait();
                            if(Db.GameDB.isComplete(game)){
                                // if this happens, it means that something bad happenend. not likely.
                                // clear any game session keys
                                Client.clearSessionKeys([SessionKeys.CURRENT_GAME_NAME, SessionKeys.CURRENT_GAME_ID, SessionKeys.WAIT_FOR_GAME_ID, SessionKeys.CURRENT_TURN_PLAYER])
                                Router.go('/lobby');
                            }
                            else{
                                // reload game screen for our move
                                Router.go('/game/' + game._id);
                            }
                        }
                        
                    }
                    else{
                        if(Db.GameDB.isComplete(game)){
                            // stop waiting for the move and go to 'my turn'
                            Client.stopMoveWait();
                            // back to default room
                            Router.go('/game/' + game._id + '/results');
                        }
                        else{
                            console.log("Game NOT in progress, status is DERPED:" + game.status);
                        }
                    }
                }
                else {
                    Delegates.Errors.failover("Something went wrong: " + gameId);
                }
            }
        },
        // Delegates for Route functions (client side only)
        Route:{
            //=======================================================================================
            // Game Methods
            //=======================================================================================
            /**
             * @param result
             * @param thisRef
             * @param playerId
             * @param playerToken
             */
            on_gameMethods_joinGame:function(result, thisRef, playerId ){
                console.log("Delegates.Route.on_gameMethods_joinGame(status" + result.status + ")");
                Client.stopHeartbeat();
                var game = result.game;
                if(game){
                    // keeps the token updated on a more granular level
                    Client.startHeartbeat(2000);
                    if(game.status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS){
                        // start a wait cycle for this game
                        // this will auto stop if the game is 'ready'
                        Client.startGameWait(3000, game._id);
                        // poll now
                        thisRef.render('waitingForPlayers');
                    }
                    else if(game.status == Db.Constants.GameStatus.IN_PROGRESS){
    
                        console.log("Delegates.Route.on_gameMethods_joinGame - game in progress, stopping wait.");
                        
                        // stop waiting on the game.
                        Client.stopGameWait();
                        
                        Session.set(SessionKeys.CURRENT_GAME_ID, game._id);
                        Session.set(SessionKeys.CURRENT_GAME_NAME, game.game_name);
                        
                        // show the in game template.
                        if(game.current_player == playerId){
                            Client.stopMoveWait();
                            thisRef.render('inGameMyTurn');
                        }
                        // show the 'their turn' template
                        else{
                            Client.startMoveWait(1500);
                            thisRef.render('inGameTheirTurn');
                        }
                    }
                    else if(game.status == Db.Constants.GameStatus.COMPLETE){
                        if(game.winner_id != null){
                            console.log("game has a winner." + game.winner_id);
                        }
                        else{
                            console.log("game has no winner!");
                        }
                    }
                    
                    console.log("****client::gameMethods_joinGame::result(" + playerId + ") -   " + result);
                }
                else {
                    console.log("Error: Game not found, status was !" + result.status);
                }
            },
            
            //=======================================================================================
            // Player Methods
            //=======================================================================================
            on_playerMethods_createPlayer:function(result, playerObj){
                console.log("on_playerMethods_createPlayer()");
                // Success
                // rerun this route and we should get a player
                Route.go('/player/'+playerObj._id);
            },
            
            on_playerMethods_heartBeat:function(results){
                if(results.status != HTTPStatusCodes.OK){
                    console.log("on_playerMethods_heartBeat(status:" + results.status + ")");
                    console.log(results);
                }
            },
    
            on_playerMethods_login:function(loginResult){
                if(Meteor.isClient){
                    console.log("on_playerMethods_login(status: " + loginResult.status + ")");
                    if(loginResult.status != 404){
                        var player = loginResult.player;
                        console.log("on_playerMethods_login - token: " + loginResult.token);
                        if(player != null){
                            
                            console.log("player start: " + player.in_game);
                            Session.set(SessionKeys.PLAYER_ID, player._id);
                            Session.set(SessionKeys.TOKEN, loginResult.token);
                            Session.set(SessionKeys.LAST_LOGIN_TIME, player.last_login);
                            // start the heartbeat (10 seconds if not in game)
                            // this simply updates the clients 'online' status automatically
                            // as long as his browser is open
                            Client.startHeartbeat(10000);
                            
                            // if not in a game, send to lobby
                            if(player.in_game == false)
                            {
                                console.log("player is going to lobby");
                                Router.go('/rooms/' + Db.RoomDB.DEFAULT_ROOM_ID);
                            }
                            else {
                                var game = Db.GameDB.findGame(player.game_id);
                                
                                if(game != null && game !== undefined){
                                    
                                    console.log("Player is in a game..." + player.game_id);
                                    // if the game is not abandonded
                                    // attempt to rejoin
                                        
                                    Session.set(SessionKeys.CURRENT_GAME_NAME, game.game_name);
                                    
                                    if(game.status == Db.Constants.GameStatus.ABANDONED || game.status == Db.Constants.GameStatus.COMPLETE){
                                        console.log("")
                                        Router.go('/rooms/' + Db.RoomDB.DEFAULT_ROOM_ID);
                                    }
                                    else{
                                        console.log("Player in a game that is not complete,  nor is it abandoned (yet)");
                                        if(game.status == Db.Constants.GameStatus.IN_PROGRESS){
                                            Session.set(SessionKeys.CURRENT_GAME_ID, game._id);
                                        }
                                        else if(game.status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS){
                                            Session.set(SessionKeys.WAIT_FOR_GAME_ID, game._id);
                                        }
                                        //graceful rejoin?
                                        Router.go('/game/' + game._id);
                                    }
                                }
                                else{
                                    // just go to lobby, saving our player state may be good too.
                                    Router.go('/rooms/' + Db.RoomDB.DEFAULT_ROOM_ID);
                                }
                            }
                        }
                        else{
                            console.log("on_playerMethods_login - Something wen't wrong, could not find player!" );
                            Router.go('/register');
                        }
                    }
                    else{
                        console.log("on_playerMethods_login - Player does not exist" + player._id);
                    }
                }
            },
            
            
            on_playerMethods_logout:function(logoutResult){
                if(Meteor.isClient){
                    if(logoutResult != null && logoutResult !== undefined){
                        console.log("on_playerMethods_logout(status: " + logoutResult.status + ")");
                    }
                    // stops all client timers
                    Client.clearSession();
                    
                    // send them back to the register / login page
                    Router.go('/register');
                }
            },
           
            on_playerMethods_leaveRoom:function(results){
                console.log("on_playerMethods_leaveRoom");
                
                Session.set(SessionKeys.PLAYER_ROOM_ID, undefined);
                
                console.log(results);
            },
            
            on_playerMethods_joinRoom:function(results){
                console.log("on_playerMethods_joinRoom");
                console.log(results);
                
                var room = results.room;
                if(room != null){
                    Session.set(SessionKeys.PLAYER_ROOM_ID, room._id);
                }
            }
        }
    }
    
    console.log("Delegates setup!");
}