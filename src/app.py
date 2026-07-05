import os
import socket

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from src.game import GameManager

app = FastAPI(
    title="Games with Friends",
    description="A phone-based game server API.",
    version="0.1.0",
)


def get_local_ip() -> str:
    """Helper to retrieve the host machine's actual local LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to an external address to resolve local interface (does not send packets)
        s.connect(("10.255.255.255", 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = "127.0.0.1"
    finally:
        s.close()
    return IP


def get_enriched_state() -> dict:
    """Helper to get enriched game state with current question and host IP."""
    state_dict = game_manager.state.model_dump()
    current_q = game_manager.get_question(game_manager.state.current_question_id)
    state_dict["current_question"] = current_q.model_dump() if current_q else None
    state_dict["host_ip"] = get_local_ip()
    return state_dict


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
    await manager.broadcast({"type": "state_update", "state": get_enriched_state()})


@app.get("/host")
@app.get("/host/")
async def admin():
    """Serve the host admin UI page."""
    admin_path = os.path.join(os.path.dirname(__file__), "..", "ui", "index.html")
    with open(admin_path) as f:
        return HTMLResponse(content=f.read())


@app.get("/join")
@app.get("/join/")
async def join():
    """Serve the player join UI page."""
    join_path = os.path.join(os.path.dirname(__file__), "..", "ui", "index.html")
    with open(join_path) as f:
        return HTMLResponse(content=f.read())


@app.get("/results")
@app.get("/results/")
async def results():
    """Serve the results page."""
    results_path = os.path.join(os.path.dirname(__file__), "..", "ui", "index.html")
    with open(results_path) as f:
        return HTMLResponse(content=f.read())


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, player_id: str | None = None):
    await manager.connect(websocket)

    # Send current state to newly connected client immediately
    try:
        await websocket.send_json({"type": "state_update", "state": get_enriched_state()})
    except Exception:
        manager.disconnect(websocket)
        return

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "ping":
                continue

            elif action == "join":
                pid = data.get("player_id")
                name = data.get("name")
                room_code = data.get("room_code", "").strip().upper()

                if room_code != game_manager.state.room_code:
                    try:
                        await websocket.send_json(
                            {"type": "error", "message": "Invalid Room Code. Please check the TV screen."}
                        )
                    except Exception:
                        pass
                    continue

                if pid and name:
                    player_id = pid  # Link connection to player_id
                    game_manager.join_player(pid, name)
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

            elif action == "show_results":
                game_manager.show_results()
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


ui_dir = os.path.join(os.path.dirname(__file__), "..", "ui")
app.mount("/", StaticFiles(directory=ui_dir, html=True), name="ui")
