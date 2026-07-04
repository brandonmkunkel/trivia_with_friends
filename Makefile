.PHONY: install run fmt fmt-py fmt-chrome test test-chrome

install:
	uv sync

run:
	uv run main.py

test:
	uv run pytest

fmt:
	uv run ruff check --fix .
	uv run ruff format .
