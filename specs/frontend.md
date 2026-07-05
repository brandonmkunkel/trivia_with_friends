# User Interfaces

These user interfaces are implemented in the `ui/` directory and are served by the backend. 

## Interface Types

- `lobby_screen`: The main menu of the application, this is where users see a code to enter to join a game. This screen is displayed on the TV. This shows the name of all players that have joined the game and lets them know when the game is starting.
- `game_screen`: The screen that shows the main game. This screen is displayed on the TV. It will show the current question, the answers, the current scores for all players, and the current round and category. 
- `player_screen`: The screen that the player sees on their phone. They will use this screen to enter their name, choose a team, and answer questions and buzz in. 
- `host_screen`: The screen that only the host sees, allows the host to control the game, such as starting the game, ending the game, revealing answers, acknowledging correct/incorrect answers, etc.
- `results_screen`: The screen that shows the results of the game, either mid-game (when the host chooses to show the results), or at the end of the game once all of the questions are answer.

## Host Screen

**URL:**: `/$HOST/host`

The host will get a screen to control the game, including progressing the game to the next question, revealing answers, and ending the game, restarting/resetting the game. 

## Lobby

**URL:**: `/$HOST`

All games use the same lobby screen, but show the game name from the active game in the lobby. This screen will show a random 4 character alphanumeric code that is used by players to join. 

The host will loading this page from `/$HOST`, and they will provide the URL to the players. Once the game starts, this page will switch to the Game Screen. 

## Game Screen

**URL:**: `/$HOST`

Each game type will use its own game screen which has characteristics unique to that game type that shows the current state of the game, player scores. 

Some games will have different features than others, and the game screen will reflect the current state needed for the game flow. 

## Player Screen

**URL:** `/$HOST/join`

Players will join from `/$HOST/join` and they will enter a 4 character alphanumeric code that is displayed on the lobby screen. 

Each player while in an active game will use the same player screen to view questions, buzz in, and answer questions (when multi-choice). This screen will change dynamically based on the game type and the active game state.

Requirements:
- A player should be able to leave and return to the player screen at will without affecting the game or losing their info. 
- The buttons and text should be easily legible.
- Everything should fit in a mobile aspect ratio. 

### Player Screen - On Reset

When the game is reset, the player should be returned to the `/$HOST/join` page and their state cleared from the game. They should have to rejoin. 

### Player Screen - End of Game

When the game ends, the player that wins should see that they win. 

The winner's screen should show:
  * Show confetti animation falling from the screen
  * Show the point total with “You are the winner with $POINTS"

## Results Screen

**URL:**  `/$HOST/results`

Once the game is over, the game screen will show the results of the game. This will include the final scores for all players, and the final standings of all players. 
