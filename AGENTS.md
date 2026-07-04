# Agents

This repo uses a Python FastAPI backend to serve a trivia game for multiple players. The front end is a web application that can be run locally or hosted on a server.

## Structure

- `configs`: Configuration files for specific versions of the trivia game. 
- `media`: Media files used by the trivia game, images, audio, etc.
- `src`: Source code for the trivia server application. Uses FastAPI to serve the trivia game, manages game state, and handles business logic. This is where the core logic of the trivia game lives.
- `ui`: Source code for the web application

## Specs

Specs are documents that describe how the game should be implemented and are used to generate code. All specs can be found in the `specs/` directory.

- `backend.md`: Backend specifications
- `game_configs.md`: Game config specifications
- `game_types.md`: Game type specifications
- `personas.md`: Persona specifications
- `interfaces.md`: User interface specifications
