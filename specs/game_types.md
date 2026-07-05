# Game Types

For seeing game schemas and config options, see `specs/game_configs.md`.

## Jeopardy

A Jeopardy style game with multiple rounds and categories. Players buzz in to answer questions, first person to buzz in gets to answer. If they get it right, they get points. If they get it wrong, they lose points. 

Details:
- The host can choose to reveal the answer after a certain amount of time or after all players have answered.
- The host can also choose to allow all players to answer at once. This is called "open buzzer" mode.
- When a question is selected, it should show the question on the question screen. Then players can buzz in to answer. The first player to buzz in will get to answer. If they get it right, they get points. If they get it wrong, they lose points.
- A question may be a trap that deducts points, in which case the `actual_points` field in the config will be negative and used to deduct points from the player that selects it. 

When a user is buzzed in: 
- the host screen should show the question + answer to be able to confirm when the answer is correct
- The lobby screen should still show the player + the question. The player name should not hide the question. 
- When the player selects the correct question, show the answer on the screen (below the question)

After successfully answering a question, the lobby screen and player screen should show: "$PLAYER is choosing a question from the board". The game should keep track of the active player selecting the next question, so that questions with unique effects (like instant point loss - as shown by `actual_points < 0`) can apply to that player. 
