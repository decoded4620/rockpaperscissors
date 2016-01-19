// client only
if (Meteor.isClient) {
    var playerHelpers = {
        playerName:function(){
            return this._id;
        },
        playerElo:function(){
            return this.elo;
        },
        gamesWon:function(){
            return this.games_won;
        },
        roundsWon:function(){
            return this.rounds_won;
        },
        remoteProfile:function(){
            var remId = Session.get(SessionKeys.PLAYER_PROFILE_ID);
            if(remId){
                player = Db.PlayerDB.findPlayer(Session.get(SessionKeys.PLAYER_PROFILE_ID));
                return player;
            }
        }
    };
    
    
    // shared with several helpers
    var gameHelpers = {
        waitingForPlayers:function(){
            return this.status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS;
        },
        ownerName:function(){
            return this.game_owner;
        },
        gameName:function(){
            return this.game_name;
        },
        winnerName:function(){
            return this.winner_id;
        },
        bestOutOf:function(){
            return this.max_turns;
        },
        players:function(){
            // find players in this game
            return Db.PlayerDB.findAll(this.player_ids);
        },
        gameResults:function(){
            return this.results;
        },
        gameRounds:function(){
            var r= this.rounds;
            console.log(r);
            return r;
        },
        gameStatusLabel:function(){
            switch(this.status){
                case Db.Constants.GameStatus.WAITING_FOR_PLAYERS:
                    return "Waiting For Players";
                case Db.Constants.GameStatus.IN_PROGRESS:
                    return "In Progress";
                case Db.Constants.GameStatus.COMPLETE:
                    return "Completed!";
                default:
                    return "Game Not ready";
            }
            
            return "";
        }
    };
    
    var navHelpers = {
            localPlayerName:function(){
                return Session.get(SessionKeys.PLAYER_ID);
            },
            localPlayerInGame:function(){
                var currGameId = Session.get(SessionKeys.CURRENT_GAME_ID);
                var waitForGameId = Session.get(SessionKeys.WAIT_FOR_GAME_ID);
                
                console.log("isLocalPlayerInGame? (" + waitForGameId + ", " + currGameId + ")");
                if(currGameId !== undefined || waitForGameId !== undefined){
                    return true;
                }
                
                return false;
            },
            links:function(){
                var linkList = [];
                
                if(Session.get(SessionKeys.PLAYER_ID)){
                    linkList[linkList.length] = {href:"/logout", name:"Logout"};
                    
                    if(navHelpers.localPlayerInGame() == false){
                        linkList[linkList.length] = {href:"/leaderboard", name:"Leaderboard"};
                        linkList[linkList.length] = {href:"/profile", name:"My Profile"};
                    
                        if(Session.get(SessionKeys.PLAYER_ROOM_ID) != null){
                            linkList[linkList.length] = {href:"/rooms/" + Session.get(SessionKeys.PLAYER_ROOM_ID), name:"Go to: " + Session.get(SessionKeys.PLAYER_ROOM_ID)};
                        }
                    }
                }
                
                return linkList;
            }
        };
    Template.navigation.helpers(navHelpers);
    
    /**
     * Lobby Helper Events and Data
     */
    Template.lobby.helpers({
        lastLogin:function(){
            return (new Date(Session.get(SessionKeys.LAST_LOGIN_TIME))).toUTCString();
        },
        playerName:function(){
            return Session.get(SessionKeys.PLAYER_ID);
        },
        roomName:function(){
            return Session.get(SessionKeys.PLAYER_ROOM_ID);
        },
        // only returns games that are ready for players to join. as soon as all players are there,
        gamesInProgress:function(){
            return Db.Collections.Games.find({$or:[{status:Db.Constants.GameStatus.IN_PROGRESS}, {status:Db.Constants.GameStatus.WAITING_FOR_PLAYERS}]}, {limit:20, sort:{status:1}});
        },
        hasGamesInProgress:function(){
            return Db.Collections.Games.find({$or:[{status:Db.Constants.GameStatus.IN_PROGRESS}, {status:Db.Constants.GameStatus.WAITING_FOR_PLAYERS}]}).fetch().length > 0;
        },
        // only returns games that are ready for players to join. as soon as all players are there,
        gamesCompleted:function(){
            return Db.Collections.Games.find({status:Db.Constants.GameStatus.COMPLETE});
        },
        hasCompletedGames:function(){
            return Db.Collections.Games.find({status:Db.Constants.GameStatus.COMPLETE}).fetch().length > 0;
        },
        // only returns games that are ready for players to join. as soon as all players are there,
        gamesAbandoned:function(){
            return Db.Collections.Games.find({status:Db.Constants.GameStatus.ABANDONED});
        },
        hasAbandonedGames:function(){
            return Db.Collections.Games.find({status:Db.Constants.GameStatus.ABANDONED}).fetch().length > 0;
        }
    });
    
    Template.leaderboardPlayer.helpers({
        lastLoginDate:function(){
            if(!this.last_login){
                return "Unknown";
            }
            return (new Date(this.last_login)).toUTCString();
        }
    });
    Template.leaderboard.helpers({
        leaderboardPlayers:function(){
            lbPlayers = Db.Collections.Players.find({},{sort: {elo:-1}, limit:200}).fetch();
            console.log("Leaderboard players: ");
            console.log(lbPlayers);
            return lbPlayers;
        }
    });
    
    /**
     * Lobby Template Events
     */
    Template.lobby.events({
        'submit form':function(event){
            event.preventDefault();
            
            var gameName    = event.target.gameName.value;
            var minPlayers  = event.target.minPlayers.value;
            var maxTurns    = event.target.maxTurns.value;
            
            var gameId      = gameName.toLowerCase().replace(/ /g, "");
            
            var playerId    = Session.get(SessionKeys.PLAYER_ID);
            var token       = Session.get(SessionKeys.TOKEN);
            
            console.log("Create Game Form Submit(" + gameName + ", " + gameId + ","  + playerId + ", " + token + ")");
            console.log("submitting new game");
            
            // precheck if game is available.
            var game = Db.GameDB.findGame(gameName);
            if(game == null){
                Meteor.call("gameMethods_createGame", gameName, minPlayers, maxTurns, playerId, token, function(error,results){
                    if(!error || error === undefined){
                        var game = results.game;
                        
                        if(game != null && game !== undefined){
                            Session.set(SessionKeys.WAIT_FOR_GAME_ID,game._id);
                            Session.set(SessionKeys.CURRENT_GAME_NAME,game.game_name);
                            
                            // enters the game
                            Router.go('/game/'+game._id);
                        }
                    }
                    else{
                        // back to default room
                        Router.go('/rooms/'+ Db.RoomDB.DEFAULT_ROOM_ID);
                    }
                });
            }
            else {
                if(game.status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS){
                    // we can join automatically
                    Session.set(SessionKeys.WAIT_FOR_GAME_ID,game._id);
                    Session.set(SessionKeys.CURRENT_GAME_NAME,game.game_name);
                    Router.go('/game/' + game._id);
                }
                else{
                    console.warn("** TODO: implement **");
                }
            }
        }
    });
    
    Template.myProfile.helpers({
        playerProfile:function(){
            player = Db.PlayerDB.findPlayer(Session.get(SessionKeys.PLAYER_ID));
            console.log(player);
            return player;
        }
    });
    
 
    Template.theirProfile.helpers(playerHelpers); 
    
    Template.inGameTheirTurn.helpers({
        opponent:function(){
            var game = Db.GameDB.findGame(Session.get(SessionKeys.CURRENT_GAME_ID));
            if(game != null){
                return game.current_player;
            }
            
            return "";
        },
        gameName:function(){
            return Session.get(SessionKeys.CURRENT_GAME_NAME);
        }
    });
    
    Template.inGameMyTurn.helpers({
        gameName:function(){
            return Session.get(SessionKeys.CURRENT_GAME_NAME);
        }
    });
    
    Template.inGameMyTurn.events({
        
        'submit form':function(event){
            
            console.log("inGameMyTurn Submit Form!");
            event.preventDefault();
            
            //making a move
            var radios = document.getElementsByName('moveChoice');

            for (var i = 0, length = radios.length; i < length; i++) {
                if (radios[i].checked) {
                    
                    var gameId = Session.get(SessionKeys.CURRENT_GAME_ID);
                    if(gameId != null && gameId !== undefined){
                        Router.go('/game/' + gameId + '/' + radios[i].value);
                    }
                    break;
                }
            }
        }
    });
    
    Template.myGameResults.helpers({
       gameName:function(){
           return Session.get(SessionKeys.CURRENT_GAME_NAME);
       },
       losers:function(){
           console.log("getLosers()");
           console.log(this);
           
           return [{lname:"Bobby", lscore:69}];
       }
    });
    Template.myGameResults.events({ 
        'submit form':function(event){
            console.log("back to default room: " + Db.RoomDB.DEFAULT_ROOM_ID);
            event.preventDefault();
            
            Router.go('/rooms/' + Db.RoomDB.DEFAULT_ROOM_ID);
        }
    })
    Template.loser.helpers({
        name:function(){
            console.log(this);
            return this.lname;
        },
        score:function(){
            console.log(this);
            return this.lscore;
        }
    });
  
    Template.gameAbandoned.helpers(gameHelpers);
    Template.gameComplete.helpers(gameHelpers);
    Template.game.helpers(gameHelpers);
    Template.gameRound.helpers({
       roundWinnerNames:function(){
           return this.winners.join(",");
       }
    });
    Template.game.events({
        'click button':function(event){
            console.log("Click join game: " + this.game_name);
            console.log(this);
            
            // join the game :).
            Router.go('/game/'+ this._id );
        }
    });

    Template.registerMe.events({
        'submit form': function (event) {
            // prevent any shenanigans.
            event.preventDefault();
            
            var playerName = event.target.playerName.value;
            console.log("registerMe::submit form(" + playerName + ")");
            
            Meteor.call("playerMethods_createPlayer", playerName, function(error, results){
               if(!error || error === undefined){
                   console.log("playerMethods_createPlayer::result() " + results);
                   if(results.status === HTTPStatusCodes.OK){
                      // redirect to players page
                      Router.go('/player/' + playerName);
                   }
                   else{
                       console.log("Error creating Player:");
                       console.log(results);
                   }
               }
               else{
                   console.log("playerMethods_createPlayer::error() " + error);
               }
            });
        }
    });
    
}
console.log("Templates setup!");