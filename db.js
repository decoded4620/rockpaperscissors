
Db = {
    //=======================================================================================
    Constants:{
        GameStatus:{
            NONE:-1,                                    // upon creation
            WAITING_FOR_PLAYERS:0,                      // waiting for more players to join (i.e. some players have joined)
            IN_PROGRESS:1,                              // in progress
            COMPLETE:2,                                 // completed normally
            ABANDONED:3,                                 // abandoned prior to completion
            getLabel:function(status){
                switch(status){
                case this.NONE:
                    return "None";
                case this.WAITING_FOR_PLAYERS:
                    return "Waiting For Players";
                case this.IN_PROGRESS:
                    return "In Progress";
                case this.COMPLETE:
                    return "Complete";
                case this.ABANDONDED:
                    return "Abandoned";
                }
            }
        }
    },
    //=======================================================================================
    Collections:{
        Games : null,
        Players : null,
        Rooms : null,
        Heartbeat : null
    },

    //=======================================================================================
    Objects:{
        /**
         * Heartbeat Object
         * represents a player's online status
         */
        Heartbeat:function(){
            this._id = null;            // matches the player's id.
            this.player_token = null;
            this.time = (new Date()).getTime();
        },
        Room : function(roomName, roomId = null){
            
            if(roomId == null && roomName !==  "" && roomName != null && roomName != undefined){
                roomId = roomName.replace(/ /g, "");
            }
            
            this._id            = roomId;
            this.room_name      = roomName;
        },
        Player:function() {
            this._id            = null;
            this.game_id        = null;
            this.opponent_id    = null;
            this.room_id        = null;
            this.this_login     = null;
            this.last_login     = null;
            this.elo            = 1000;
            this.wins           = 0;
            this.losses         = 0;
            this.rounds_won     = 0;
            this.rounds_lost    = 0;
            this.in_game        = false;
        },
        Game:function(){
            this._id            = null;
            this.player_ids     = [];
            // all moves over all rounds
            this.moves          = [];
            
            // record of who won each round (a round is 1 move for each player)
            this.rounds         = [];
            this.roundWinners   = [];
            // table of scores (updated after each round)
            this.scores         = {};
            this.results        = {winnerId:null, isTie:false};
            this.game_name      = null;
            this.winner_id      = null;
            this.game_owner     = null;
            this.current_player = null;
            this.min_players    = 2;
            this.max_players    = 2;
            this.max_turns      = 2;
            this.min_turns      = 1;
            this.status         = Db.Constants.GameStatus.NONE; // 0 = waiting for players 1 = in progress, 2 = complete
            this.player_idx     = 0;
        }
    },
    //=======================================================================================
    Auth:{
        isPlayerTokenValid:function(playerId, playerToken, update=true){
                
            var retVal = false;

            if(Meteor.isServer){
                
                // record a new heartbeat
                if(update){
                    hb = Db.HeartbeatDB.heartBeat(playerId, playerToken);
                }
                // find the current heartbeat, but don't update
                else{
                    hb = Db.HeartbeatDB.findHeartbeat(playerId );
                }

                // validate the token
                if(hb != null && hb.player_token === playerToken){
                    retVal = true;
                }
            }
            
            if(!retVal){
                console.log("Auth.isPlayerTokenValid - complete: player token (" + playerToken + ") INVALID!")
            }
            return retVal;
        }
    },
    //=======================================================================================
    HeartbeatDB:{
        /**
         * returns the max time in 'milliseconds' to wait for a heartbeat prior to 
         * wiping out the player's heartbeat record.
         */
        getMaxHeartbeatWaitTime:function(){
            return 515000;
        },
        
        /**
         * Find a players 'heartbeat' record.
         * 
         * @param playerId
         */
        findHeartbeat:function(playerId ){
            if(playerId == null){
                return null;
            }
            hb = Db.Collections.Heartbeat.findOne({_id:playerId});
            return hb;
        },
        
        /**
         * Returns true if player is online
         * 
         * @param playerId
         */
        isPlayerOnline:function(playerId){
            
            console.log("Db.HeartbeatDB.isPlayerOnline(" + playerId + ")");
            hb = this.findHeartbeat(playerId);
            
            // player has never logged in
            if(hb == null){
                console.log("Db.HeartbeatDB.isPlayerOnline - player " + playerId + " has never logged in");
                return false;
            }
            
            // player has logged in before, check the last
            // time a heartbeat was reported.
            var lastHbTime  = hb.time;
            var now         = (new Date()).getTime();
            var delta       = now - lastHbTime;
            
            var isOnline = delta <= this.getMaxHeartbeatWaitTime();
            
            console.log("Db.HeartbeatDB.isPlayerOnline - last seen: " + delta + " ms ago, is online: " + isOnline);
            if(!isOnline){
                console.log("player no longer online");
                if(hb.player_token != null){
                    console.log("Db.HeartbeatDB.heartBeat -  reset heartbeat values now");
                    hb.player_token = null;
                    Db.Collections.Heartbeat.update({_id:playerId}, {$set:{player_token:null, time:0}});
                }
            }
            
            return isOnline;
        },
        
        
        /**
         * Invoke the heartbeat for this player, and player token
         * 
         * @param playerId
         * @param playerToken
         */
        heartBeat:function(playerId, playerToken){
//            console.log("Db.Heartbeat.heartBeat(" + playerId + ", " + playerToken + ")");
            if(Meteor.isServer){
                hb = this.findHeartbeat(playerId);
                
                if(hb == null){
//                    console.log("Db.Heartbeat.heartBeat( create entry for: " + playerId +")");
                    hb = new Db.Objects.Heartbeat();
                    hb._id = playerId;
                    hb.time = (new Date()).getTime();
                    hb.player_token = playerToken;
                    Db.Collections.Heartbeat.insert(hb);
                }
                else{
//                    console.log("Db.HeartbeatDB.heartBeat(found entry for" + playerId + ")");
                // update locally
                    var now = (new Date()).getTime();
                    hb.player_token = playerToken;
                    hb.time = now;
                    // update remotely
                    Db.Collections.Heartbeat.update({_id:playerId}, {$set:{player_token:playerToken, time:now}});
                }
                
                return hb;
            }
        }
    },
    //=======================================================================================
    GameDB:{
        findGame:function(gameId){
            var game = null;
//            console.log("Db.GameDB.findGame: " + gameId );
            with(Db.Collections)
            {
                game = Games.findOne({_id: gameId});
            }
            
            if(game == null){
                console.log("DB.GameDB.findGame - complete: game (" + gameId + ") not found");
            }
            return game;
        },
        
        washGame:function(game){
            // run by the system
            if(Meteor.isServer){
                if(game != null){
                    console.log("Db.GameDB.washGame(try to wash game: " + game._id + ", status: " + Db.Constants.GameStatus.getLabel(game.status) + ")");
                    if(game.status == Db.Constants.GameStatus.IN_PROGRESS || game.status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS){
                        var pLen:int            = game.player_ids.length;

                        // eval to true if game owner is missing.
                        var reassignOwner = !Db.HeartbeatDB.isPlayerOnline(game.game_owner);
                        // suppose true if owner is not around
                        var allPlayersOffline   = reassignOwner;
                        
                        // eval to true if game needed to be reassigned.
                        var reassigned          = false;
                        var currId              = null;
//                        console.log("DB.GameDB.washGame - is owner online?: " + (!reassignOwner));
                        
                        for(var i:int = 0; i < pLen; ++i)
                        {
                            currId = game.player_ids[i];
//                            console.log("DB.GameDB.washGame - checking player online status: " + currId);
                            if(currId !== game.game_owner){
                                var player = Db.PlayerDB.findPlayer(currId);
                                
                                // if the player is fake or gone.
                                if(player == null){
                                    game.player_ids.splice(i,1);
                                    --i;
                                }
                                
                                // at least one of the players is online
                                // if so, player will be in game, or redirected there immediately.
                                if(Db.HeartbeatDB.isPlayerOnline(currId)){
//                                   console.log("DB.GameDB.washGame - player: " + currId + " is online");
                                   allPlayersOffline = false;
                                   break;
                                }
                                else{
                                    if(player != null && player.game_id == game._id){
                                        console.log("Db.GameDB.washGame - clean player game flags: " + player._id);
                                        player.game_id = null;
                                        player.in_game = false;
                                        
                                        if(!Db.PlayerDB.savePlayer(player)){
                                            console.log("Db.GameDB.washGame - could not save player after cleaning");
                                        }
                                    }
                                }
                                
                                if(reassignOwner && !reassigned){
                                    console.log("DB.GameDB.washGame - Owner: " + game.game_owner + " was offline, reassign owner to next player in line: " + currId);
                                    game.game_owner = currId;
                                    reassigned = true;
                                }
                            }
                            else {
                                if(reassignOwner){
                                    // remove and step back
                                    game.player_ids.splice(i,1);
                                    
                                    if(game.player_ids.length == 0){
                                        i = 0;
                                        pLen = 0;
                                        game.status == Db.Constants.GameStatus.ABANDONED;
                                    }
                                    else{
                                        // backtep
                                        // correct the index for the players
                                        --i;
                                        --pLen;
                                        --game.player_idx;
                                        if(game.player_idx < 0){
                                            game.palyer_idx = 0;
                                        }
                                        else{
                                            game.palyer_idx = game.player_ids.length % game.player_idx;
                                        }
                                        game.current_player= game.player_ids[game.player_idx];
                                        
                                        console.log("Db.GameDB.washGame - new current player: " + game.current_player);
                                    }
                                    
                                    console.log("Db.GameDB.washGame - removing offline owner from player_ids, new palyer idx: " + game.player_idx);
                                }
                            }
                        }
                        
                        if(allPlayersOffline){
                            console.log("Db.GameDB.washGame - all players are offline for game: " + game._id);
                            
                            // set this game up for deletion on the major job
                            game.status = Db.Constants.GameStatus.ABANDONED;
                            
                            // update the game
                            if(!Db.GameDB.saveGame(game)){
                                console.log("Could not set game to abandoned.")
                            }
                        }
                        else{
                            if(reassignOwner ){
                                if(reassigned)
                                {
                                    console.log("Db.GameDB.washGame - try to reassign owner... and save game");
                                    if(!Db.GameDB.saveGame(game)){
                                        console.log("Db.GameDB.washGame - Could not modify game to new owner");
                                    }
                                }
                            }
                            else{
//                            console.log("Db.GameDB.washGame - players are online, and in game");
                                
                            }
                        }
                    }
                }
            }
        },
        /**
         * Creates a game and sets this player as the owner
         */
        createGame:function(gameName, minPlayers, maxTurns, playerId, playerToken){
            
            var retVal = null;
//          console.log("Db.GameDB.createGame(" + gameName + ", " + playerId + "," + playerToken + ")");
            
            // just check the token, no update for now
            if(Db.Auth.isPlayerTokenValid(playerId, playerToken, true)){
                
                var gameId  = gameName.toLowerCase().replace(/ /g, "");
                var game    = this.findGame(gameId);
                
                if(game == null){
//                    console.log("Db.GameDB.createGame - game " + gameId + " doesn't exist, creating it!");
                    game            = new Db.Objects.Game();
                    game.game_name  = gameName;
                    game._id        = gameId;
                    game.min_players = minPlayers;
                    if(game.max_players < game.min_players){
                        game.max_players = game.min_players;
                    }
                    game.max_turns = maxTurns;
                    if(this.saveGame( game)){
                        retVal = game;
                    }
                    else{
                        console.log("Db.GameDB.createGame - complete: saving game failed.");
                        retVal = null;
                    }
                }
                else{
                   console.log("Db.GameDB.createGame - complete: game " + gameId + "already exists, attempting to join this game");
                   retVal = game;
                }
            }
            else{
                retVal = null;
                console.log("Db.GameDB.createGame - complete: NOT AUTHORIZED.");
            }
            return retVal;
        },
        saveGame:function(game){
            console.log("Db.GameDB.saveGame(" + game + ")");
            var result = false;
            with(Db.Collections)
            {
                if(this.findGame(game._id) == null){
                    Games.insert(game);
                    result = true;
                }
                else{
                    Games.update({_id:game._id},{ $set : game });
                    result = true;
                }
            }
            
            return result;
        },

        /**
         * Join a game (using the game object)
         * 
         * @param game 
         * a game object from the 'games' collection
         * @param playerId 
         * the players id
         * 
         * @param playerToken
         * a valid player token. If invalid, join will fail.
         */
        joinGame:function(gameId, playerId, playerToken){
            console.log("Db.GameDB.joinGame(" + gameId + "," + playerId +  ", " + playerToken + ")");
            
            if(Db.Auth.isPlayerTokenValid(playerId, playerToken, false)){
                
                game    = this.findGame(gameId);
                player  = Db.PlayerDB.findPlayer(playerId);
                
                // ifs are nested (rather than and'ed) to allow individual errors to be returned
                // for failure cases.
                if(player != null){
                    if(game != null){
                        console.log("Db.GameDB.joinGame - player and game are valid, playergame: " + player.game_id + ", game: " + game._id);
                        // if a new game or rejoin
                        if(player.game_id != null && player.game_id !==undefined && player.game_id !== game._id){
                            console.log("Db.GameDB.joinGame - complete:  player already in a nother game, attempting to leave!");
                            // leave any existing game
                            this.leaveGame(player.game_id, playerId, playerToken);
                        }
                        else{
                            console.log("Db.GameDB.joinGame - Player is either in THIS game or no game:" + player.game_id);
                        }
                        
                        var existingPlayers = game.player_ids;
                        var eLen = existingPlayers.length;
                        console.log("Db.GameDB.joinGame - existing players are: " + existingPlayers);
                        if(eLen == 0 || existingPlayers.indexOf(playerId) == -1){
                            console.log("Db.GameDB.joinGame - player not in this game, joining");
                            if(eLen < game.max_players){
                                
                                if(game.game_owner == null){
                                    console.log("Db.GameDB.joinGame - setting game owner: " + playerId);
                                    game.game_owner = playerId;
                                }
                                
                                // add a score for this player
                                game.scores[playerId] = 0;
                                game.player_ids[game.player_ids.length] = playerId;
                                
                                if(game.player_ids.length >= game.min_players){
                                    // set game 'in progress' for all players
                                    // who are 'waiting'
                                    game.status         = Db.Constants.GameStatus.IN_PROGRESS;
                                    game.player_idx     = 0;
                                    game.current_player = game.player_ids[game.player_idx];
                                    
                                    // leave the lobby once the game starts.
                                    Db.RoomDB.leaveRoom('lobby', playerId, playerToken);
                                    
                                    console.log("All Players have arrived, current turn is for: " + game.current_player);
                                }
                                else{
                                    game.status = Db.Constants.GameStatus.WAITING_FOR_PLAYERS; 
                                    console.log("Waiting for more players to arrive");
                                }
                                
                                // save it to make it 'react'
                                if(this.saveGame(game)){
                                    // save the player's game
                                    player.game_id  = game._id;
                                    player.in_game  = true;
                                    
                                    if(Db.PlayerDB.savePlayer(player)){
                                        console.log("Db.GameDB.joinGame - complete:  save success! game status: " + Db.Constants.GameStatus.getLabel(game.status));
                                        return {status:HTTPStatusCodes.OK, game:game };
                                    }
                                    else{
                                        return {status:HTTPStatusCodes.INTERNAL_ERROR };
                                    }
                                }

                                console.log("Db.GameDB.joinGame - complete:  save failed!");
                                return {status:HTTPStatusCodes.INTERNAL_ERROR, errorCode:GameErrorCodes.GAME_SAVE_ERROR};
                            
                            }
                            else
                            {
                                console.log("Db.GameDB.joinGame - complete:  game is full!");
                                return {status:HTTPStatusCodes.INTERNAL_ERROR, errorCode:GameErrorCodes.GAME_FULL };
                            }
                        }
                        else{
                            // already joined
                            console.log("Db.GameDB.joinGame - complete:  already joined!");
                            return {status:HTTPStatusCodes.OK, game:game }
                        }
                    }
                    else{
                        console.log("Db.GameDB.joinGame - complete: Couldnt find game: " + game._id + " for player " + playerId);
                        return {status:HTTPStatusCodes.NOT_FOUND, errorCode:GameErrorCodes.GAME_NOT_FOUND }
                    }
                }
                else{
                    console.log("Db.GameDB.joinGame - complete: Player not found: " + playerId);
                    return {status:HTTPStatusCodes.NOT_FOUND, errorCode:GameErrorCodes.PLAYER_NOT_FOUND }
                }
            }
            else{
                console.log("Db.GameDB.joinGame - Not Authorized to join this game");
                return {status:HTTPStatusCodes.NOT_AUTHORIZED};
            }
        },
        leaveGame:function(gameId, playerId, playerToken){
            console.log("Db.GameDB.leaveGame: " + gameId + ", " + playerId + ",  " + playerToken);
            // leave a game
            if(Db.Auth.isPlayerTokenValid(playerId, playerToken, false)){
                game = this.findGame(gameId);
                player = Db.PlayerDB.findPlayer(playerId);
                
             // ifs are nested (rather than and'ed) to allow individual errors to be returned
                // for failure cases.
                if(player != null){
                    if(game != null){
                        console.log("Db.GameDB.leaveGame - player and game are valid, playergame: " + player.game_id + ", game: " + game._id);
                        // if a new game or rejoin
                        if(player.game_id == game._id){
                            
                            console.log("Db.GameDB.leaveGame - Player is in game:" + player.game_id);
                            var existingPlayers     = game.player_ids;
                            var eLen                = existingPlayers.length;
                            var exIdx               = existingPlayers.indexOf(playerId);
                            
                            console.log("Db.GameDB.leaveGame - existing players are: " + existingPlayers);
                            if(eLen > 0 && exIdx > -1){
                                console.log("Db.GameDB.leaveGame - player in this game, leaving");
                                
                                game.player_ids.splice(exIdx, 1);
                                
                                player.game_id      = null;
                                
                                if(game.status == Db.Constants.GameStatus.IN_PROGRESS){
                                    
                                    if(game.current_player == playerId){
                                        
                                        // auto move to the next player
                                        if(game.player_ids.length > 0){
                                            game.current_player = game.player_ids[game.player_idx%game.player_ids.length];
                                        }
                                        // game is toast
                                        else{
                                            console.log("game is toast");
                                        }
                                    }
                                    console.log("Db.GameDB.leaveGame - you've forfeited the game!");
                                    game.scores[playerId] = 0;
                                    
                                }

                                if(!Db.GameDB.saveGame(game)){
                                    console.log("Error saving game!");
                                }
                                
                                if(!Db.PlayerDB.savePlayer(player)){
                                    console.log("Error saving player: " + player);
                                }
                                
                                return {status:HTTPStatusCodes.OK, scoreForfeit:game.scores[playerId] }; 
                            }
                            else{
                                // already joined
                                console.log("Db.GameDB.leaveGame - complete:  already left!");
                                return {status:HTTPStatusCodes.OK, game:game }
                            }
                        }
                        else{
                            console.log("Db.GameDB.leaveGame - complete:  player not in this game!");
                            return {status:HTTPStatusCodes.INTERNAL_ERROR, errorCode:GameErrorCodes.PLAYER_IN_OTHER_GAME};
                        }
                    }
                    else{
                        console.log("Db.GameDB.leaveGame - complete: couldnt find game" + gameId + " for player " + playerId);
                        return {status:HTTPStatusCodes.NOT_FOUND, errorCode:GameErrorCodes.GAME_NOT_FOUND }
                    }
                }
                else{
                    console.log("Db.GameDB.leaveGame - complete: player not found: " + playerId);
                    return {status:HTTPStatusCodes.NOT_FOUND, errorCode:GameErrorCodes.PLAYER_NOT_FOUND }
                }
            }
        },
        
        
        // get the winning move
        getWinningMove:function(move1, move2){
            var retVal = -1;
            if(move1.move === move2.move){
                console.log("The moves are " + move1.move + ", " + move2.move + " a tie!");
                retVal = 0;
            }
            if(move1.move === 'r'){
                retVal = move2.move === 's' ? 1 : 2;
            }
            else if(move1.move === 'p'){
                retVal = move2.move === 'r' ? 1 : 2;
            }
            else if(move1.move === 's'){
                retVal = move2.move === 'p' ? 1 : 2;
            }
            else{
                console.log("Bad Move made!");
                //bad move
                retVal = -1;
            }
            
            console.log("Db.GameDB.getWinningMove(" + move1.move + ", " + move2.move +") - move" + retVal + " = " + (retVal == 1 ? move1.move : (retVal == 2 ? move2.move : retVal)));
            return retVal;
        },
        
        submitMove:function(game, playerId, value, playerToken){
            
            console.log("Db.GameDB.submitMove(GAME:[" + game + "] PLAYER:[" + playerId + "] MOVE:[" + value + "] AUTH:[" + playerToken + "]");
            
            if(!game){
                // LOGOUT
                return {status:HTTPStatusCodes.INTERNAL_ERROR};
            }
            
            if(!playerId || !playerToken || !value){
                //ERROR
                return {status:HTTPStatusCodes.INTERNAL_ERROR};
            }
            
            if(Db.Auth.isPlayerTokenValid(playerId, playerToken, true)){
                
                if(game && game.status == Db.Constants.GameStatus.IN_PROGRESS){
                    
                    var moveData = {num:game.moves.length+1, playerId:playerId, move:value, rec:false, isWin:true};
                    game.moves[game.moves.length] = moveData;
                    
                    // every time a move happens check to see if a score has been created for a specific player
                    if(game.scores[playerId] === undefined){
                        game.scores[playerId] = 0;
                    }
                    // round reconciliation
                    if(game.player_idx % game.player_ids.length == game.player_ids.length-1 ){
                        console.log("Reconcile Round: " + (game.rounds.length+1));
                        var movesCopy = game.moves.concat();
                        var losersFound = true;
                        var winnerIds = [];
                        while(losersFound){
                            losersFound = false;
                            for(var i = 0; i < movesCopy.length-1; i++){
                                
                                //find which player won THIS round
                                var move1 = movesCopy[i];
                                var move2 = movesCopy[i+1];
                                
                                var compareValue = this.getWinningMove(move1,move2);
                                
                                console.warn("Db.GameDB.submitMove - compare to  unmatched: " + compareValue);
                                if(compareValue != 0){
                                    
                                    // this means the unmatched move (previous player)
                                    // was the winner
                                    if(compareValue == 1){
                                        losersFound = true;
                                        movesCopy.splice(movesCopy.indexOf(move2),1);
                                    }
                                    else{
                                        losersFound = true;
                                        movesCopy.splice(movesCopy.indexOf(move1),1);
                                    }
                                }
                            }
                            
                            if(losersFound==false){
                                var winningMove = null;
                                for(var i = 0; i<movesCopy.length; ++i){
                                    //winning moves
                                    if(game.roundWinners.indexOf(movesCopy[i].playerId)==-1){
                                        game.scores[movesCopy[i].playerId]++;
                                        game.roundWinners[game.roundWinners.length] = movesCopy[i].playerId;
                                        
                                        if(winningMove == null || this.getWinningMove(movesCopy[i],winningMove) == 1){
                                            winningMove = movesCopy[i];
                                            console.log('wmove; ');
                                            console.log(winningMove);
                                        }
                                    }
                                }
                                game.rounds[game.rounds.length] = { winners:game.roundWinners.concat(), num:game.rounds.length+1, winningMove:(winningMove != null?winningMove.move:"tie") };
                                console.log("Round winners");
                                console.log(game.roundWinners);
                            }
                            game.roundWinners = [];
                        }
                        console.log("Db.GameDB.submitMove - Scores at this round of the game are: ");
                        console.log(game.scores);
                    }
                    
                    // carousel
                    game.player_idx         = (game.player_idx+1)%game.player_ids.length;
                    game.current_player     = game.player_ids[game.player_idx];
                    
                    console.log("Db.GameDB.submitMove - appending move: " + value + ", next player is: " + game.current_player);
                   
                    var result          = null;
                    var moveCnt         = game.moves.length;
                    var pCnt            = game.player_ids.length;
                    
                    // if we've wrapped, check for a winner.
                    // if the entire thing is a tie...
                    // the game is over, with no winner.
                    if(game.player_idx == 0 && moveCnt == pCnt * game.max_turns){
                        
                        console.log("Db.GameDB.submitMove - Game " + game._id + " is over, evalutating");
                        
                        //evaluate
                        var winnerId    = this.findWinnerId(game);
                        
                        //winner!
                        if(winnerId != null && winnerId !== undefined){
                            result      = {status:HTTPStatusCodes.OK, winnerId:winnerId, gameIsTie:false, winningScore:null, players:game.player_ids};
                        }
                        //tie
                        else{
                            result      = {status:HTTPStatusCodes.OK, winnerId:null, gameIsTie:true, winningScore:game.scores[winnerId], players:game.player_ids};
                        }
                        
                        // set the final values
                        game.winner_id          = result.winnerId;
                        
                        Db.GameDB.endGame( game );
                        
                        result.gameStatus       = game.status;
                        game.results            = result;
                        game.current_player     = null;
                        game.player_idx         = 0;

                        console.log("Final Values");
                        console.log(game);
                        // save the game as 'complete' or 'abandonded'
                        if(!this.saveGame(game)){
                            console.log("Db.GameDB.move - Game could not be persisted to the database");
                            return {status:HTTPStatusCodes.INTERNAL_ERROR, msg:"could not save game"};
                        }
                        
                        return result;
                    }
                    else{
                        // save the state of the game
                        if(this.saveGame(game)){
                            return {status:HTTPStatusCodes.OK, gameStatus: game.status };
                        }
                        else{
                            console.log("Db.GameDB.move - Game could not be persisted to the database");
                            return {status:HTTPStatusCodes.INTERNAL_ERROR, msg:"could not save game"};
                        }
                    }
                }
                else{
                    console.log("Db.GameDB.move - Game is no longer running");
                    return {status:HTTPStatusCodes.INTERNAL_ERROR, msg:"game not running!"};
                }
            }
            else{
                console.log("Db.GameDB.move - Not Authorized to perform this action");
                return {status:HTTPStatusCodes.NOT_AUTHORIZED};
            }
        },
        
        
        findWinnerId:function(game){
            
            console.log("Db.GameDB.findWinnerId(" + game + ")");
            var winnerId = null;
            if(game != null){
                
                var hiScore = -1000000;
                for (var property in game.scores) {
                    if (game.scores.hasOwnProperty(property)) {
                        console.log("Db.GameDB.findWinnerId - Player Id: " + property + " score: " + game.scores[property]);
                        if(game.scores[property] > hiScore && !isNaN(game.scores[property])){
                            hiScore = game.scores[property];
                            winnerId = property;
                            console.log("Db.GameDB.findWinnerId - winner found: " + winnerId);
                        }
                        else if(game.scores[property] == hiScore){
                            // null out the winner, but keep the high score
                            // it means we have a tie 'currently'
                            console.log("Db.GameDB.findWinnerId - hiScore tied, removing winner: " + game.scores[property]);
                            winnerId = null;
                        }
                    }
                }
            }
            
            // if winnerId is null, it means either no one broke the tie
            // or we haven't created enough moves to find a winner.
            return winnerId;
        },
        
        
        endGame:function(game){
            
            if(!this.isDormant(game)){
                if(game.status == Db.Constants.GameStatus.IN_PROGRESS){
                    game.status = Db.Constants.GameStatus.COMPLETE;
                }
                else{
                    game.status = Db.Constants.GameStatus.ABANDONED;
                }
                
                var players = Db.PlayerDB.findAll(game.player_ids);
                
                if(players == null){
                    console.log("Db.GameDB.endGame - Players were not present in the game!");
                }
                else {
                    console.log("Db.GameDB.endGame - Players returned from Db");
                    var currPlayer = null;
                    var pLen = players.length;
                    for(var i = 0; i < pLen; i++){
                        currPlayer = players[i];
                        
                        currPlayer.game_id = null;
                        currPlayer.in_game = false;
                        
                        if(game.winner_id == currPlayer._id){
                            currPlayer.wins++;
                            Db.PlayerDB.updateElo(currPlayer, players, game.scores, true, false);
                        }else{
                            currPlayer.losses++;
                            Db.PlayerDB.updateElo(currPlayer, players, game.scores, false, false);
                        }
                        currPlayer = null;
                    }
                    
                    var currRound   = null;
                    var rLen        = game.rounds.length;
                    
                    for(var i = 0; i < rLen; i++){
                        
                        currRound = game.rounds[i];
                        
                        if(currRound.winners != null && currRound.winners !== undefined){
                            
                            // for every player in the round, mark their win / loss rate
                            for(var j = 0; j < pLen; j++){
                                var comparePlayer = players[j];
                                if(currRound.winners.indexOf(comparePlayer.playerId) != -1){
                                    comparePlayer.rounds_won++;
                                }
                                else{
                                    comparePlayer.rounds_lost++;
                                }
                            }
                        }
                        else{
                            console.log("Db.GameDB.endGame - Round-" + (i+1) + " has no winner");
                        }
                        
                        currRound = null
                    }
                    
                    // save all teh players
                    for(var i = 0; i < players.length; ++i){
                        if(!Db.PlayerDB.savePlayer(players[i])){
                            console.log("Db.GameDB.endGame - couldn't save player:"  + players[i]);
                        }
                    }
                }
            }
        },
        
        isDormant : function(game){
            return game == null || game.status == Db.Constants.GameStatus.NONE;
        },
        isComplete : function(game){
            return game != null && game.status == Db.Constants.GameStatus.COMPLETE;
        },
        isInProgress:function(game){
            return game != null && game.status == Db.Constants.GameStatus.IN_PROGRESS;
        },
        isWaitingForPlayers:function(game){
            return game != null && game.status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS;
        }
    },
    //=======================================================================================
    PlayerDB : {
        /**
         * Just for fun.
         * Basic Elo rating :P.
         * 
         * @param player
         * @param opponents
         * @param scoreTable
         * @param winner
         * @param saveNow
         */
        updateElo:function(player, opponents, scoreTable, winner=true, saveNow=true){
            
            console.log("Db.PlayerDB.updateElo(" + player + ", against " + opponents.length + " opponents, is winner: " + winner + ", save now? " + saveNow);
            
            // a cap on elo jump / fall
            var kFactor     = 40;
            var dK          = 400;
            var eloC        = 32;
            
            for(var i = 0; i < opponents.length; i++){
                
                //if caller didn't splice the player from the 'list'
                // of opponents.
                if(opponents[i] == player){
                    continue;
                }
                
                
                // apply the elo based on all players, one at a time
                r1 = Math.pow(10, player.elo / dK);
                
                // get opponents elo
                r2 = Math.pow(10, opponents[i].elo / dK);
                
                // expected chance for player 1 to win
                e1 = r1 / (r1 + r2);
                
                // r' starts at 0 until we calculate it
                var r_1 = 0;
                // if player one wins
                if(winner){
                    r_1 = player.elo + eloC * (1 - e1);
                }
                else{
                    if(scoreTable[opponents[i]._id] > scoreTable[player._id]){
                        r_1 = player.elo + eloC * (0-e1);
                    }
                    else if(scoreTable[opponents[i]._id] < scoreTable[player._id]){
                        r_1 = player.elo + eloC * (1-e1);
                    }
                }

                // if a rating was calculated
                if(r_1 != 0)
                {
                    if(Math.abs(player.elo-r_1) < kFactor){
                        player.elo = Math.round(r_1);
                    }
                    else{
                        if(r_1 > player.elo){
                            r_1 = player.elo + kFactor;
                        }
                        else{
                            r_1 = player.elo - kFactor;
                        }
                        
                        player.elo = Math.round(r_1);
                    }
                }
                
            }
            console.log("Db.PlayerDB.updateElo - player " + player._id + " elo is now; " + player.elo);
            
            
            if(saveNow==true){
                Db.PlayerDB.savePlayer(player);
            }
        },
        /**
         * @param playerId
         */
        findPlayer:function( playerId){
//            console.log("Db.PlayerDB.findPlayer(" + playerId +")");
            var player;
            with(Db.Collections){
                player      = Players.findOne({_id: playerId});
            }
            
            return player;
        },
        findAll:function(player_ids){
//            console.log("Db.PlayerDB.findAll(" + player_ids +")");
            return Db.Collections.Players.find( {_id: { $in: player_ids} } ).fetch();
        },
        
        hasPlayer(playerId){
//            console.log("Db.PlayerDB.hasPlayer(" + playerId +  ")");
            return this.findPlayer(playerId) != null;
        },

        createPlayer:function(playerId, pwd=null){
            console.log("Db.PlayerDB.createPlayer()");
            
            var player      = this.findPlayer(playerId);
            
            if(player == null)
            {  
                player      = new Db.Objects.Player();
                player._id  = playerId;
                player.pwd  = pwd;
                
                // save and reassign
                if(this.savePlayer(player)){
                    return player;
                }
            }
            // this is just a login
            else if(player.pwd === pwd){
                return player;
            }
            
            return null;
        },
        savePlayer:function(playerObj){
            var player = null;
            if(playerObj != null &&  playerObj._id){
                with(Db.Collections){
                    player = this.findPlayer(playerObj._id);
                    
                    if(player == null){
                        console.log("Db.PlayerDB.savePlayer( insert " + playerObj._id + ")");
                        Players.insert(playerObj)
                        player = playerObj;
                    }
                    else
                    {
                        console.log("Db.PlayerDB.savePlayer( update " + playerObj._id + ")");
                        // update the player with the incoming data.
                        Players.update( {_id:playerObj._id}, { $set: playerObj } );
                    }
                }
                
                return player;
            }
            
            return null;
        }
    },
    RoomDB:{
        // default room players will join to find a game.
        DEFAULT_ROOM_ID:'lobby',
        
        /**
         * Find a room by id.
         */
        findRoom:function(roomId){
            console.log("Db.RoomDB.findRoom(" + roomId + ")");
            return Db.Collections.Rooms.findOne({_id:roomId});
        },
        
        /**
         * leave the room. This removes the association between the player
         * and  the room
         */
        leaveRoom:function(roomId, playerId, playerToken){
            
            console.log("Db.RoomDB.leaveRoom(" + roomId + ", " + playerId + ", " + playerToken + ")");
            
            // check if valid (no heartbeat)
            if(Db.Auth.isPlayerTokenValid(playerId, playerToken, false)){
                
                room = this.findRoom(roomId);
                
                if(room != null){
                    var player = Db.PlayerDB.findPlayer(playerId);
                    
                    // clear the players room if he's in this room
                    if(player != null && player.room_id === roomId){
                        player.room_id  = null;
                        player          = Db.PlayerDB.savePlayer(player);
                        console.log("Player left room: " + roomId);
                        return {status:HTTPStatusCodes.OK, roomId:roomId};
                    }
                }
            }
        },
        
        /**
         * Join a player to a room.
         * this just associates the player with that room by id.
         * 
         * @param roomId
         * @param playerId
         * @param playerToken
         */
        joinRoom:function(roomId, playerId, playerToken){

            console.log("Db.RoomDB.joinRoom(" + roomId + ", " + playerId + ", " + playerToken + ")");
            
            if(Db.Auth.isPlayerTokenValid(playerId, playerToken))
            {
                room = this.findRoom(roomId);
                
                if(room != null){
                    console.log("Db.RoomDB.joinRoom - room found(" + roomId + ")");
                    
                    player              = Db.PlayerDB.findPlayer(playerId);
                    player.room_id      = room._id;
                    
                    if(!Db.PlayerDB.savePlayer(player)){
                        return {status:HTTPStatusCodes.INTERNAL_ERROR };
                    }
                    
                    return {status:HTTPStatusCodes.OK, token:playerToken, room:room};
                }
                else{
                    console.log("Db.RoomDb.joinRoom - room not found(" + roomId + ")");
                    return {status:HTTPStatusCodes.NOT_FOUND };
                }
            }
            
            return {status:HTTPStatusCodes.NOT_AUTHORIZED };
        }
    }
}
