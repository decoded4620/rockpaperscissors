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
            lastLogin:function(){
                return (new Date(Session.get(SessionKeys.LAST_LOGIN_TIME))).toString();
            },
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
                            linkList[linkList.length] = {href:"/rooms/" + Session.get(SessionKeys.PLAYER_ROOM_ID), name:"Play Again!"};
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
        },
        gamesInProgress:function(){
            return Db.Collections.Games.find({$or:[{status:Db.Constants.GameStatus.IN_PROGRESS}, {status:Db.Constants.GameStatus.WAITING_FOR_PLAYERS}]}, {limit:20, sort:{status:1}});
        },
        hasGamesInProgress:function(){
            return Db.Collections.Games.find({$or:[{status:Db.Constants.GameStatus.IN_PROGRESS}, {status:Db.Constants.GameStatus.WAITING_FOR_PLAYERS}]}).fetch().length > 0;
        },
        gamesCompleted:function(){
            return Db.Collections.Games.find({status:Db.Constants.GameStatus.COMPLETE});
        },
        hasCompletedGames:function(){
            return Db.Collections.Games.find({status:Db.Constants.GameStatus.COMPLETE}).fetch().length > 0;
        },
        gamesAbandoned:function(){
            return Db.Collections.Games.find({status:Db.Constants.GameStatus.ABANDONED});
        },
        hasAbandonedGames:function(){
            return Db.Collections.Games.find({status:Db.Constants.GameStatus.ABANDONED}).fetch().length > 0;
        }
    });
    Template.lobby.rendered = function(){
        console.log("Template.lobby.rendered: " + this.rendered);
        if(this.rendered == true){
            return;
        }
        this.rendered = true;
        /*var autoJoinInterval = */
        Meteor.setTimeout(function(){
            
            var gip  = Db.Collections.Games.find({status:Db.Constants.GameStatus.WAITING_FOR_PLAYERS}, {limit:3}).fetch();
            var gLen = gip.length;
            console.log("create or join a game, " + gLen + " games in progress");
            for(var i = 0; i < gLen; ++i){
                console.log("create ");
                console.log(gip);
                // SANITY check in case someone joined while we fetched.
                if(gip[i].status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS){
                    
                    console.log("Found a game!");
                    // stop checking
//                    Meteor.clearInterval(autoJoinInterval)
                    Router.go('/game/' + gip[i]._id );
                    return;
                }
            }
            
            var playerId    = Session.get(SessionKeys.PLAYER_ID);
            var token       = Session.get(SessionKeys.TOKEN);
            
            var newGameName = playerId + "'s Game";

            var game = Db.GameDB.findGame(newGameName);
            if(game == null || game.status != Db.Constatns.GameStatus.WAITING_FOR_PLAYERS){
                // create the game with the same ID, using 'auto-gen' to generate a new id
                // for a game with the same name.
                //
                Db.Auth.createGame( newGameName, playerId, token);
            }
            else {
                if(game.status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS){
                    
                    if(game.player_ids.indexOf(playerId) == -1){
                            
                        // we can join automatically
                        Session.set(SessionKeys.WAIT_FOR_GAME_ID,game._id);
                        Session.set(SessionKeys.CURRENT_GAME_NAME,game.game_name);
                        Router.go('/game/' + game._id);
                    }
                }
                else{
                    // this will look for a new game.
                    Router.go('/lobby');
                }
            }
        }, 1000);
      };
    /**
     * Lobby Template Events
     */
    Template.lobby.events({
        'submit form':function(event){
            event.preventDefault();
            
            var gameName    = event.target.gameName.value;
            var minPlayers  = 2;
            var maxTurns    = 1;
            
            var gameId      = gameName.toLowerCase().replace(/ /g, "");
            
            var playerId    = Session.get(SessionKeys.PLAYER_ID);
            var token       = Session.get(SessionKeys.TOKEN);
            
            console.log("Create Game Form Submit(" + gameName + ", " + gameId + ","  + playerId + ", " + token + ")");
            console.log("submitting new game");
            
            // precheck if game is available.
            var game = Db.GameDB.findGame(gameName);
            if(game == null){
                Db.Auth.createGame( gameName, playerId, token);
            }
            else {
                if(game.status == Db.Constants.GameStatus.WAITING_FOR_PLAYERS){
                    // we can join automatically
                    Session.set(SessionKeys.WAIT_FOR_GAME_ID,game._id);
                    Session.set(SessionKeys.CURRENT_GAME_NAME,game.game_name);
                    Router.go('/game/' + game._id);
                }
                else{
                    // this will look for a new game.
                    Router.go('/lobby');
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
    
    
    
    gameTurnHelpers = {
        opponentPlayer:function(){
            var game = Db.GameDB.findGame(Session.get(SessionKeys.CURRENT_GAME_ID));
            if(game != null){
                console.log("getOPponentPlayer: " + game.player_ids)
                for(var i = 0; i < game.player_ids.length; ++i){
                    if(game.player_ids[i] == Session.get(SessionKeys.PLAYER_ID)){
                        continue;
                    }
                    
                    return game.player_ids[i];
                }
            }
            return "";
        },
        playerName:function(){
            return Session.get(SessionKeys.PLAYER_ID);
        },
        gameName:function(){
            return Session.get(SessionKeys.CURRENT_GAME_NAME);
        }
    };
    Template.inGameTheirTurn.helpers(gameTurnHelpers);
    Template.inGameMyTurn.helpers(gameTurnHelpers);
    
    Template.inGameMyTurn.events({
        'click img':function(event){
            event.preventDefault();
            
            var gameId = Session.get(SessionKeys.CURRENT_GAME_ID);
            if(gameId != null && gameId !== undefined){
                switch(event.currentTarget.id){
                    case 'rock':
                    case 'paper':
                    case 'scissors':
                        Router.go('/game/' + gameId + '/' + event.currentTarget.id.charAt(0));
                    break;
                    default:
                        break;
                }
            }
        },
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
        results:function(){
            console.log("results:");
            console.log(game.results);
            return game.results;
        }
    });
    Template.myGameResults.events({ 
        'submit form':function(event){
            console.log("back to default room: " + Db.RoomDB.DEFAULT_ROOM_ID);
            event.preventDefault();
            console.log(event);
            switch(event.currentTarget.id){
                case 'playAgain':
                    Router.go('/rooms/' + Db.RoomDB.DEFAULT_ROOM_ID);
                    break;
                case 'leaderboard':
                    Router.go('/leaderboard');
                    break;
                 default:
                     break;
            }
        }
    })
  
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
            
            // logs in.
            Router.go('/' + playerName);
            
            console.log("registerMe::submit form(" + playerName + ")");
        }
    });
    
}
console.log("Templates setup!");