
Router.configure({
    // the default layout
    layoutTemplate: 'main'
 });
 
// Router Setup

Router.route('/home')
// Default page is 'register'
Router.route('/', function () {
    this.render("registerMe");
});
//register page
Router.route('/register', function(){
    console.log("rendering register...");
 // set the layout programmatically
    this.render('registerMe');
});
Router.route('/lobby', function(){
    var playerId = Session.get('playerId');
    
    if(playerId == null){
        Router.go('/register');
    }
    else {
        this.render("lobby");
    }
});
Router.route('/player/:playerName',function(){
    
   console.log("Route:/player/:playerName=" + this.params.playerName + "");
   var player;
   
   with(Db.Collections){
       player = Players.findOne({_id: this.params.playerName});
   }
   if(!player){
       Router.go('/register');
   }
   else{
       // if not in a game, send to lobby
       if(player.in_game == false)
       {
           Router.go('/lobby');
       }
       else {
           // send to rejoin
           Router.go('/rejoinGame');
       }
   }
});

//register page
Router.route('/game/:gameName', function(){
    console.log("rendering register...");
 // set the layout programmatically
    this.render('inGame');
});