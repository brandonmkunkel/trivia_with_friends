
from pydantic import BaseModel, Field


class Question(BaseModel):
    id: str
    question: str
    answer: str
    points: int
    completed: bool = False

class Category(BaseModel):
    name: str
    questions: list[Question]

class Player(BaseModel):
    id: str
    name: str
    team: str | None = None
    score: int = 0
    connected: bool = True

class GameState(BaseModel):
    name: str
    game_type: str
    status: str = "lobby"  # lobby, board, question, buzzed, revealed, ended
    categories: list[Category] = Field(default_factory=list)
    players: list[Player] = Field(default_factory=list)
    current_question_id: str | None = None
    current_buzzer: str | None = None
    buzzer_locked: bool = False
    open_buzzer: bool = False
    buzzed_players: list[str] = Field(default_factory=list)  # players who already answered incorrectly on current question
