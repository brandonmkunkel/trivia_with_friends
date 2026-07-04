import os

import pytest

from src.game import GameManager


@pytest.fixture
def game_mgr():
    # Use configs/chunky.yaml for testing
    config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "chunky.yaml")
    return GameManager(config_path)

def test_initial_state(game_mgr):
    assert game_mgr.state.name == "Chunky"
    assert game_mgr.state.game_type == "jeopardy"
    assert game_mgr.state.status == "lobby"
    assert len(game_mgr.state.categories) == 5
    assert len(game_mgr.state.categories[0].questions) == 5

def test_player_join(game_mgr):
    # Join player 1
    p1 = game_mgr.join_player("p1", "Alice", "Team A")
    assert p1.id == "p1"
    assert p1.name == "Alice"
    assert p1.team == "Team A"
    assert len(game_mgr.state.players) == 1

    # Reconnect player 1 with new team and name
    p1_reconnect = game_mgr.join_player("p1", "Alice Reborn", "Team B")
    assert p1_reconnect.id == "p1"
    assert p1_reconnect.name == "Alice Reborn"
    assert p1_reconnect.team == "Team B"
    assert len(game_mgr.state.players) == 1

    # Prevent duplicate name for connected players
    p2 = game_mgr.join_player("p2", "Alice Reborn", "Team C")
    assert p2.name == "Alice Reborn (1)"

def test_game_flow(game_mgr):
    # Join players
    game_mgr.join_player("p1", "Alice")
    game_mgr.join_player("p2", "Bob")

    # Start game
    assert game_mgr.start_game() is True
    assert game_mgr.state.status == "board"

    # Select question
    q_id = "q_0_0" # First question of first category (points: 100)
    assert game_mgr.select_question(q_id) is True
    assert game_mgr.state.status == "question"
    assert game_mgr.state.current_question_id == q_id

    # Buzz in
    assert game_mgr.buzz_in("p1") is True
    assert game_mgr.state.status == "buzzed"
    assert game_mgr.state.current_buzzer == "p1"

    # Alice answers incorrectly
    assert game_mgr.mark_answer(correct=False) is True
    assert game_mgr.get_player("p1").score == -100
    assert game_mgr.state.status == "question"
    assert game_mgr.state.current_buzzer is None
    assert "p1" in game_mgr.state.buzzed_players

    # Bob buzzes in
    assert game_mgr.buzz_in("p2") is True
    assert game_mgr.state.status == "buzzed"
    assert game_mgr.state.current_buzzer == "p2"

    # Bob answers correctly
    assert game_mgr.mark_answer(correct=True) is True
    assert game_mgr.get_player("p2").score == 100
    assert game_mgr.state.status == "board"
    assert game_mgr.get_question(q_id).completed is True

def test_reveal_answer(game_mgr):
    game_mgr.join_player("p1", "Alice")
    game_mgr.start_game()
    q_id = "q_0_1"
    game_mgr.select_question(q_id)

    assert game_mgr.reveal_answer() is True
    assert game_mgr.state.status == "revealed"
    assert game_mgr.get_question(q_id).completed is True

    assert game_mgr.return_to_board() is True
    assert game_mgr.state.status == "board"
