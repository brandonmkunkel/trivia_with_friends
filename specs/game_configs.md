# Game Configs

The game configs for individual games are defined as YAML in the `configs/` directory and are loaded by the backend.

## Schemas

### Base game config

All games inherit from this base config schema.

```yaml
name: string
game_type: string
```

### Jeopardy

```yaml
categories:
  - name: string
    questions:
      - question: string
        answer: string
        points: int
        actual_points: Optional[int] # Optional, used for deducting points in special cases 
```
