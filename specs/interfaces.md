# User Interfaces

These user interfaces are implemented in the `ui/` directory and are served by the backend. 

## Interface Types

- `lobby_screen`: The main menu of the application, this is where users see a code to enter to join a game. This screen is displayed on the TV. This shows the name of all players that have joined the game and lets them know when the game is starting.
- `game_screen`: The screen that shows the main game. This screen is displayed on the TV. It will show the current question, the answers, the current scores for all players, and the current round and category. 
- `player_screen`: The screen that the player sees on their phone. They will use this screen to enter their name, choose a team, and answer questions and buzz in. 
- `host_screen`: The screen that only the host sees, allows the host to control the game, such as starting the game, ending the game, revealing answers, acknowledging correct/incorrect answers, etc.

## Lobby

All games use the same lobby screen, but show the game name from the active game in the lobby. 

## Game Screen

Each game type will use its own game screen which has characteristics unique to that game type that shows the current state of the game, player scores. 

Some games will have different features than others, and the game screen will reflect the current state needed for the game flow. 

## Player Screen

Each player while in an active game will use the same player screen to view questions, buzz in, and answer questions. This screen will change dynamically based on the game type that is being played.

## Host Screen

The host will get a screen to control the game, including progressing the game to the next question, revealing answers, and ending the game, restarting the game. 
