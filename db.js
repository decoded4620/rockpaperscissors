
Db = {
        Collections:{
            Games : null,
            Players : null,
            Rooms : null
        },
        Cache:{
            PlayerCache:{
                //
            },
            
        },
        
        // The Game Database
        GameDB:{
            findGame:function(gameId){
                
                var game;
                with(Db.Collections)
                {
                    game = Games.findOne({_id: gameId});
                }
                return game;
            },
            saveGame:function(game){
                
                with(Db.Collections)
                {
                    if(this.findGame(game._id) == null){
                        Games.insert(game);
                    }
                    else{
                        Games.update(game,{$set:{}})
                    }
                }
            },
            joinGame:function(game, playerId){
                
                if(findGame(game._id) != null){
                    if(game.player_ids.indexOf(playerId) == -1){
                        game.player_ids[game.player_ids.length] = playerId;
                        
                        if(game.player_ids > game.min_players){
                            // set game 'in progress' for all players
                            // who are 'waiting'
                            game.status = 1;
                        }
                        // save it to make it 'react'
                        this.saveGame(game);
                    }
                    else{
                        // already joined
                    }
                }
            }
        },
        PlayerDB : {
            findPlayer:function(playerId, cacheBust){
                var player;
                
                with(Db.Collections){
                    
                    if( !Db.Cache.PlayerCache[playerId] || cacheBust){
                        player = Players.findOne({_id: playerId});
                    }
                    
                    if(player){
                        // store in the cache
                        Db.Cache.PlayerCache[playerId] = player;
                    }
                    
                }
                
                return player;
            },
            
            hasPlayer(playerId){
                with(Db.Cache){
                    if(PlayerCache[playerId] != null){
                        return true;
                    }
                }
                
                return this.findPlayer(playerId) != null;
            },
            
            savePlayer:function(playerObj){
                
                if(playerObj != null &&  playerObj._id){
                    with(Db.Collections){
                        player = this.findPlayer(playerObj._id);
                        
                        if(player == null){
                            Players.insert(playerObj)
                        }
                        else
                        {
                            var opponent = Players.findOne({_id:Session.get('opponent_id')});
                            Players.update(
                                {_id:playerObj._id},
                                {
                                    $set: {
                                        in_game: Session.get('in_game'),
                                        in_lobby: Session.get('in_lobby'),
                                        opponent_id: Session.get('opponent_id')
                                    }
                                }
                            );
                        }
                    }
                }
            }
        },
        Objects:{
            Player:function() {
                this._id = null;
                this.in_game = false;
                this.in_lobby = false;
                this.game_id = 0;
                this.opponent_id = 0;
                this.wins = 0;
                this.losses = 0;
                
                this.getPlayerName = function(){
                    return this._id;
                };
            },
            Game:function(){
                this._id = null;
                this.game_name = "";
                this.min_players=2;
                this.player_ids = [];
                this.winner_id = "";
                this.status = 0; // 0 = waiting for players 1 = in progress, 2 = complete
                this.isComplete = function(){
                    return status == 2;
                };
                
                this.isInProgress = function(){
                    return status == 1;
                };
            }
        }
    }
