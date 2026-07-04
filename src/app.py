import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from src.game import GameManager

app = FastAPI(
    title="Games with Friends",
    description="A phone-based game server API.",
    version="0.1.0",
)

# Initialize GameManager with default config
config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "chunky.yaml")
game_manager = GameManager(config_path)

# Connection manager for WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # Create a copy of the connections list to prevent concurrency modification issues
        connections = list(self.active_connections)
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might be dead, manager will clean it up on close/error
                pass

manager = ConnectionManager()

async def broadcast_state():
    """Helper to broadcast current game state to all websocket clients."""
    state_dict = game_manager.state.model_dump()

    # Enrich state with detailed current question data for easy consumption
    current_q = game_manager.get_question(game_manager.state.current_question_id)
    state_dict["current_question"] = current_q.model_dump() if current_q else None

    await manager.broadcast({
        "type": "state_update",
        "state": state_dict
    })

@app.get("/")
async def root():
    """Redirect root to UI home page."""
    return RedirectResponse(url="/ui/index.html")

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, player_id: str | None = None):
    await manager.connect(websocket)

    # Send current state to newly connected client immediately
    state_dict = game_manager.state.model_dump()
    current_q = game_manager.get_question(game_manager.state.current_question_id)
    state_dict["current_question"] = current_q.model_dump() if current_q else None
    try:
        await websocket.send_json({
            "type": "state_update",
            "state": state_dict
        })
    except Exception:
        manager.disconnect(websocket)
        return

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "join":
                pid = data.get("player_id")
                name = data.get("name")
                team = data.get("team")
                if pid and name:
                    player_id = pid  # Link connection to player_id
                    game_manager.join_player(pid, name, team)
                    await broadcast_state()

            elif action == "start_game":
                game_manager.start_game()
                await broadcast_state()

            elif action == "select_question":
                qid = data.get("question_id")
                if qid:
                    game_manager.select_question(qid)
                    await broadcast_state()

            elif action == "buzz":
                pid = data.get("player_id") or player_id
                if pid:
                    game_manager.buzz_in(pid)
                    await broadcast_state()

            elif action == "mark_answer":
                correct = data.get("correct", False)
                game_manager.mark_answer(correct)
                await broadcast_state()

            elif action == "reveal_answer":
                game_manager.reveal_answer()
                await broadcast_state()

            elif action == "next_question":
                game_manager.return_to_board()
                await broadcast_state()

            elif action == "end_game":
                game_manager.end_game()
                await broadcast_state()

            elif action == "restart_game":
                game_manager.restart_game()
                await broadcast_state()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        if player_id:
            game_manager.disconnect_player(player_id)
            await broadcast_state()
    except Exception:
        manager.disconnect(websocket)

# Mount the ui folder to serve static frontend files
ui_dir = os.path.join(os.path.dirname(__file__), "..", "ui")
os.makedirs(ui_dir, exist_ok=True)
app.mount("/ui", StaticFiles(directory=ui_dir, html=True), name="ui")
