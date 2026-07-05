import yaml

from src.models import Category, GameState, Question


def load_game_config(config_path: str) -> GameState:
    """Loads a game configuration from a YAML file and initializes the game state."""
    with open(config_path) as f:
        data = yaml.safe_load(f)

    categories = []
    for cat_idx, cat_data in enumerate(data.get("categories", [])):
        questions = []
        for q_idx, q_data in enumerate(cat_data.get("questions", [])):
            q_id = f"q_{cat_idx}_{q_idx}"
            question = Question(
                id=q_id,
                question=q_data["question"],
                answer=q_data["answer"],
                points=q_data["points"],
                actual_points=q_data.get("actual_points"),
                completed=False,
            )
            questions.append(question)
        category = Category(name=cat_data["name"], questions=questions)
        categories.append(category)

    return GameState(
        name=data.get("name", "Trivia"),
        game_type=data.get("game_type", "jeopardy"),
        categories=categories,
        status="lobby",
    )
