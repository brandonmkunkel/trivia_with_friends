from src.config import load_game_config
from src.models import GameState, Player, Question


class GameManager:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.state: GameState = load_game_config(config_path)

    def join_player(self, player_id: str, name: str, team: str | None = None) -> Player:
        """Adds a player to the lobby, or reconnects an existing player."""
        existing = self.get_player(player_id)
        if existing:
            existing.name = name
            existing.team = team
            existing.connected = True
            return existing

        # Check if name is already taken by a connected player, add suffix if so
        base_name = name
        suffix = 1
        while any(p.name == name and p.connected for p in self.state.players):
            name = f"{base_name} ({suffix})"
            suffix += 1

        new_player = Player(id=player_id, name=name, team=team, score=0, connected=True)
        self.state.players.append(new_player)
        return new_player

    def disconnect_player(self, player_id: str):
        """Marks a player as disconnected."""
        player = self.get_player(player_id)
        if player:
            player.connected = False
            # If the disconnected player was holding the buzzer, unlock it
            if self.state.current_buzzer == player_id:
                self.state.current_buzzer = None
                self.state.buzzer_locked = False
                self.state.status = "question"

    def start_game(self) -> bool:
        """Starts the game, transitioning from lobby to the board view."""
        if self.state.status == "lobby":
            self.state.status = "board"
            return True
        return False

    def select_question(self, question_id: str) -> bool:
        """Selects a question from the board."""
        if self.state.status != "board":
            return False

        question = self.get_question(question_id)
        if not question or question.completed:
            return False

        self.state.current_question_id = question_id
        self.state.current_buzzer = None
        self.state.buzzer_locked = False
        self.state.buzzed_players = []
        self.state.status = "question"
        return True

    def buzz_in(self, player_id: str) -> bool:
        """Handles a player buzzing in."""
        if self.state.status != "question" or self.state.buzzer_locked:
            return False

        player = self.get_player(player_id)
        if not player or not player.connected:
            return False

        if player_id in self.state.buzzed_players:
            return False  # Player already buzzed incorrectly for this question

        self.state.current_buzzer = player_id
        self.state.buzzer_locked = True
        self.state.status = "buzzed"
        return True

    def mark_answer(self, correct: bool) -> bool:
        """Marks the current buzzer's answer as correct or incorrect."""
        if self.state.status != "buzzed" or not self.state.current_buzzer:
            return False

        player = self.get_player(self.state.current_buzzer)
        question = self.get_question(self.state.current_question_id)
        if not player or not question:
            return False

        if correct:
            player.score += question.points
            question.completed = True
            self.state.current_question_id = None
            self.state.current_buzzer = None
            self.state.buzzer_locked = False
            self.state.buzzed_players = []

            # Check if all questions are completed to auto-end game
            if self.check_all_completed():
                self.state.status = "ended"
            else:
                self.state.status = "board"
        else:
            player.score -= question.points
            self.state.buzzed_players.append(player.id)
            self.state.current_buzzer = None
            self.state.buzzer_locked = False
            self.state.status = "question"

            # If all connected players have buzzed and answered incorrectly, automatically reveal
            eligible_players = [
                p.id for p in self.state.players if p.connected and p.id not in self.state.buzzed_players
            ]
            if not eligible_players:
                self.reveal_answer()

        return True

    def reveal_answer(self) -> bool:
        """Reveals the answer, transitions state to 'revealed'."""
        if self.state.status not in ["question", "buzzed"] or not self.state.current_question_id:
            return False

        question = self.get_question(self.state.current_question_id)
        if not question:
            return False

        question.completed = True
        self.state.status = "revealed"
        return True

    def return_to_board(self) -> bool:
        """Returns to board after answer is revealed."""
        if self.state.status != "revealed":
            return False

        self.state.current_question_id = None
        self.state.current_buzzer = None
        self.state.buzzer_locked = False
        self.state.buzzed_players = []

        if self.check_all_completed():
            self.state.status = "ended"
        else:
            self.state.status = "board"
        return True

    def end_game(self) -> bool:
        """Ends the game, showing the final scoreboard."""
        self.state.status = "ended"
        return True

    def restart_game(self) -> bool:
        """Resets the game state and returns to the lobby."""
        # Reload configuration
        fresh_state = load_game_config(self.config_path)

        # Keep the existing players, but reset their scores
        players = []
        for p in self.state.players:
            p.score = 0
            players.append(p)

        self.state = fresh_state
        self.state.players = players
        self.state.status = "lobby"
        return True

    # Helper methods
    def get_player(self, player_id: str) -> Player | None:
        for p in self.state.players:
            if p.id == player_id:
                return p
        return None

    def get_question(self, question_id: str) -> Question | None:
        if not question_id:
            return None
        for cat in self.state.categories:
            for q in cat.questions:
                if q.id == question_id:
                    return q
        return None

    def check_all_completed(self) -> bool:
        for cat in self.state.categories:
            for q in cat.questions:
                if not q.completed:
                    return False
        return True
