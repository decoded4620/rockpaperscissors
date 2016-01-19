if(Meteor.isServer){

    Meteor.methods({
        
        // Server method to login
        /**
         * @param playerCredentials
         * a JSON object with _id, and 'pwd' properties
         * to find the player on the db and match his credentials.
         * pwd is optional, however if passed, will validate against db pass.
         */
        playerMethods_login:function(playerCredentials){
            
            console.log("playerMethods_login(" + playerCredentials._id + ", " + playerCredentials.pwd + ")");
            
            var player     = Db.PlayerDB.findPlayer( playerCredentials._id );
            
            if(!Db.HeartbeatDB.isPlayerOnline(player._id)){
                
                if( player == null || playerCredentials.pwd != null && player.pwd != playerCredentials.pwd){
                    player = null;
                }
                
                if(player != null){
                    
                    // returns a 32 character token for login
                    token = Random.id(32);
                    
                    var now = (new Date()).getTime(); 
                    if(player.this_login == null){
                        player.last_login = now;
                    }
                    else{
                        player.last_login = player.this_login;
                    }
                    
                    player.this_login = now;
                    
                    if(!Db.PlayerDB.savePlayer(player)){
                        console.error("Couldn't save the player");
                    }
                    
                    console.log("playerMethods_login - creating token: " + token);
                    
                    // this will 'create' the players heartbeat
                    var hb = Db.HeartbeatDB.heartBeat(player._id, token);
                    
                    // if heartbeat fails for some reason, return a not-authorized
                    if(hb == null){
                        console.log("playerMethods_login - heartbeat fail");
                        return {status:HTTPStatusCodes.NOT_AUTHORIZED};
                    }
                    
                    console.log("playerMethods_login - heartbeat success");
                    
                    return {status:HTTPStatusCodes.OK, token:token, player:player};
                }
            }
            else {
                console.log("playerMethods_login - Player " + player._id + " already online!");
                hb = Db.HeartbeatDB.findHeartbeat(player._id);
                return {status:HTTPStatusCodes.OK, token:hb.player_token, player:player};
            }
            
            return {status:HTTPStatusCodes.NOT_FOUND };
        },
        /**
         * Log the player out.
         * 
         * @param playerId,
         * @param playerToken
         */
        playerMethods_logout:function(playerId, playerToken){
    
            if(playerId){
                console.log("playerMethods_logout(" + playerId + ", " + playerToken + ")");
                player  = Db.PlayerDB.findPlayer(playerId);
                
                if(player){
                    if(Db.HeartbeatDB.isPlayerOnline(playerId)){
                        if(player.in_game){
                            //return this.playerMethods_leaveGame(player.game_id);
                            
                            return {status:HTTPStatusCodes.INTERNAL_ERROR, errorCode:GameErrorCodes.GAME_NOT_COMPLETE }
                        }
                        
                        if(Db.Auth.isPlayerTokenValid(playerId, playerToken, false)){

                            // clear this so its guaranteed to be 'expired' upon next
                            //check
                            Db.Collections.Heartbeat.update({_id:hb._id}, {$set:{player_token:"", time:0}});
                            return {status:HTTPStatusCodes.OK, token:playerToken }
                        }
                    }
                    return {status:HTTPStatusCodes.NOT_AUTHORIZED };
                }
                else {
                    return {status:HTTPStatusCodes.NOT_AUTHORIZED };
                }
            }
            
            return {status:HTTPStatusCodes.NOT_AUTHORIZED };
        },
        
        /**
         * Creates a Player 
         * @param playerId
         * @param pwd
         */
        playerMethods_createPlayer:function(playerId, pwd=null){
            var result = null;
            
            console.log("playerMethods_createPlayer(" + playerId + ") in db: " + Db.PlayerDB + "(Collection: " + Db.Collections.Players + ")");
            
            player              = Db.PlayerDB.createPlayer(playerId, pwd);
            
            if(player != null)
            {  
                result          = {status : HTTPStatusCodes.OK, result:player };
            }
            else{
                // ?
                result          = {status:HTTPStatusCodes.NOT_AUTHORIZED }
            }
                
            console.log("playerMethods_createPlayer - results:" + result.status)
            return result;
        },
        
        /**
         * Player Heartbeat
         * 
         * @param playerId
         * @param playerToken
         */
        playerMethods_heartBeat:function(playerId, playerToken){
            //console.log("playerMethods_heartBeat(" + playerId + ", " + playerToken +")");
            
            if(Db.Auth.isPlayerTokenValid(playerId, playerToken, true)){
                return {status:HTTPStatusCodes.OK, token:playerToken };
            }
            else{
                return {status:HTTPStatusCodes.NOT_AUTHORIZED};
            }
        },
        
        /**
         * Joins the players to a room 
         * 
         * @param roomId
         * @param playerId
         * @param playerToken
         */
        playerMethods_joinRoom:function(roomId, playerId, playerToken){
            console.log("playerMethods_joinRoom(" + roomId + ", " + playerId + ",  " + playerToken);
            return Db.RoomDB.joinRoom(roomId, playerId, playerToken);
        },
        
        /**
         * Leave a room
         * @param roomId
         * @param playerId
         * @param playerToken
         */
        playerMethods_leaveRoom:function(roomId, playerId, playerToken){
            console.log("playerMethods_leaveRoom(" + roomId + ", " + playerId + ", " + playerToken);
            return result.Db.RoomDB.leaveRoom(roomId, playerId, playerToken);
        },
        
        /**
         * @param gameName
         * @param playerId
         * @param playerToken
         */
        gameMethods_createGame:function(gameName, minPlayers, maxTurns,playerId, playerToken){
            console.log("gameMethods_createGame(" + gameName + ", minPlayers: " + minPlayers + ", maxTurns: " + maxTurns + ", owner: " + playerId + ", token: " + playerToken + ")");
            
            game = Db.GameDB.createGame(gameName, minPlayers, maxTurns, playerId, playerToken);

            if(game != null){
                return {status:HTTPStatusCodes.OK, token:playerToken, game:game };
            }
            
            console.log("gameMethods_createGame - complete: NOT_AUTHORIZED");
            return {status:HTTPStatusCodes.NOT_AUTHORIZED };
        },
        /**
         * Server method to join a game by id
         * 
         * @param gameId
         */
        gameMethods_joinGame:function(gameId, playerId, playerToken){
            console.log("gameMethods_joinGame(" + gameId + ", " + playerId + ", " + playerToken);
            var result = Db.GameDB.joinGame(gameId, playerId, playerToken);
            return result;
        },
        gameMethods_leaveGame:function(gameId, playerId, playerToken){
            console.log("gameMethods_leaveGame(" + gameId + ", " + playerId + ", " + playerToken);
            return Db.GameDB.leaveGame(gameId, playerId, playerToken);
        },
        gameMethods_makeMove:function(gameId, playerId, move, playerToken){
            console.log("gameMethods_makeMove(" + gameId + ", " + playerId + ", " + move + ", " + playerToken);
            // moves count as heartbeats
            game = Db.GameDB.findGame(gameId);
            var result = null;
            
            if(game){
                result = Db.GameDB.submitMove(game, playerId, move, playerToken);
            }
            else{
                result = {status:HTTPStatusCodes.INTERNAL_ERROR}
            }
            
            return result;
        },
        siteMethods_viewProfile:function(viewPlayerId, playerId, playerToken){
            if( Db.Auth.isPlayerTokenValid(playerId, playerToken)){
                user = Db.PlayerDB.findPlayer(viewPlayerId);
                if(user != null && user !== undefined){
                    result = {status:HTTPStatusCodes.OK, user:user}
                }
                else{
                    result = {status:HTTPStatusCodes.NOT_FOUND, userId:viewPlayerId};
                }
                
                return result;
            }
        }
    });
}
console.log("Meteor methods setup!");