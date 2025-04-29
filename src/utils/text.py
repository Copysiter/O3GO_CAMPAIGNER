def safe_replace(text: str | None) -> str | None:
    text.replace('\'', ' ') if text else None
