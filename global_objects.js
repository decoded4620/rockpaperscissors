console.log("Setting up global_objects...");
//=======================
// Client Only
//=======================
Client = null;
Server = null;
//=======================
// Both CLient and Server
//=======================
HTTPStatusCodes = {
    // RFC-2616 Http Status codes
    // https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
    OK : 200,
    CREATED : 201,
    ACCEPTED : 202,
    NO_CONTENT : 204,
    BAD_REQUEST : 400,
    NOT_AUTHORIZED : 401,
    FORBIDDEN: 403,
    NOT_FOUND : 404,
    INTERNAL_ERROR : 500
}

SessionKeys = {
    // the current game in prog
    CURRENT_GAME_ID:'currentGameId',
    
    // the game we're waiting on (we've joined, but game is not yet in prog)
    WAIT_FOR_GAME_ID:'waitForGameId',
    
    // name of current or in prog game
    CURRENT_GAME_NAME:'currentGameName',
    
    // id of local player
    PLAYER_ID:'playerId',
    
    // id of the current remote player profile
    PLAYER_PROFILE_ID:'playerProfileId',
    
    PLAYER_ROOM_ID:'playerRoomId',
    
    // access local player's token
    TOKEN:'token',
    
    // the last login time for the player
    LAST_LOGIN_TIME:'lastLoginTimeMs',
    
    // id of the current player in game
    CURRENT_TURN_PLAYER:'currentTurnPlayer'
}

GameErrorCodes = {
    GAME_NOT_COMPLETE:1000,
    GAME_NOT_FOUND:1001,
    GAME_FULL:1002,
    GAME_SAVE_ERROR:1003,
    PLAYER_IN_OTHER_GAME:2000
}
console.log("global_objects setup!");