# Game Types

For seeing game schemas and config options, see `specs/game_configs.md`.

## Jeopardy

A Jeopardy style game with multiple rounds and categories. Players buzz in to answer questions, first person to buzz in gets to answer. If they get it right, they get points. If they get it wrong, they lose points. 

Details:
- The host can choose to reveal the answer after a certain amount of time or after all players have answered.
- The host can also choose to allow all players to answer at once. This is called "open buzzer" mode.
- When a question is selected, it should show the question on the question screen. Then players can buzz in to answer. The first player to buzz in will get to answer. If they get it right, they get points. If they get it wrong, they lose points.
- A question may be a trap that deducts points, in which case the `actual_points` field in the config will be negative and used to deduct points from the player that selects it. 
