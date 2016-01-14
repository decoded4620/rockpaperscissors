// client only
if (Meteor.isClient) {
    
    /**
     * Lobby Helper Events and Data
     */
    Template.lobby.helpers({
        playerName:function(){
            return Session.get('playerId');
        },
        games:function(){
            return Db.Collections.Games.find({});
        }
    });
    
    
    /**
     * Lobby Template Events
     */
    Template.lobby.events({
        'submit form':function(){
            event.preventDefault();
            
            var gameName = event.target.gameName.value;
            var playerName = Session.get('playerId');
            console.log("submitting new game");
            var game = Db.GameDB.findGame(gameName)
            if(game == null){
                game = new Db.Objects.Game();
                game._id = gameName.toLowerCase();
                game.game_name = gameName;
                Db.GameDB.saveGame( game);
                Session.set('gameId',game._id);
                Session.set('gameName',game.game_name)
                Router.go('/game/'+game._id);
            }
            else {
                if(game.status == 0){
                    // we can join
                    Session.set('gameId',game._id);
                    Router.go('/game/' + game._id);
                }
            }
        }
    });
    
    
}