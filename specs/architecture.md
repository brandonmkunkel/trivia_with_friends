# Architecture

## Overview

This game is designed to be played with friends in person on the same wifi. This is not a cloud hosted game. The backend will serve the frontend and manage the game state using FastAPI.

## Components

### Backend

The backend is a Python app that uses FastAPI to serve the frontend and manage the game state. It will run on a host computer and serve the game to players over the local wifi.

For more details about the backend implementation see `specs/backend.md`.


### Frontend 

The backend will parse the game configs and provide the frontend with the necessary data to display the game. 

For more details about the backend implementation see `specs/frontend.md`.


### Networking

The game is designed to be played with friends in person on the same wifi. The host computer runs the backend and serves the frontend to players over the local wifi. 

For more information on the networking, see `specs/networking.md`

### Game Configs

See `specs/game_configs.md` for more information about game configs.


### Game Types

For information about the game types, see `specs/game_types.md`. Instances of these game types will be defined via config files, for more information about game configs, see `specs/games_configs.md`


### Game State

For information about game state, see `specs/game_state.md`
