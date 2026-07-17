import secrets

from typing import Any, Union, Optional, List, Dict  # noqa
from pydantic import Field, EmailStr, PostgresDsn, ValidationInfo, field_validator  # noqa
from pydantic_settings import BaseSettings

from logging import config as logging_config


class Settings(BaseSettings):
    API_VERSION: str = Field("1", env="API_VERSION")
    API_VERSION_PREFIX: str = Field("/api/v1", env="API_VERSION_PREFIX")

    EXT_API_VERSION_PREFIX: str = Field("/ext/api/v1", env="EXT_API_VERSION_PREFIX")
    EXT_API_KEY: Union[str, None] = Field(None, env="EXT_API_KEY")

    SECRET_KEY: str = "123456"
    DYNAMIC_SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 10
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30
    JWT_ALGORITHM: str = "HS256"

    PROJECT_NAME: str = Field("FastAPI", env="PROJECT_NAME")
    PROJECT_HOST: str = Field("127.0.0.1", env="PROJECT_HOST")
    PROJECT_PORT: int = Field(8080, env="PROJECT_PORT")

    BACKEND_CORS_ORIGINS: Union[str, List[str]] = Field("*", env="BACKEND_CORS_ORIGINS")

    STATS_ENABLE: bool = Field(False, env="STATS_ENABLE")
    STATS_SERVER_HOST: str = Field("host.docker.internal", env="STATS_SERVER_HOST")
    STATS_SERVER_PORT: int = Field(8125, env="STATS_SERVER_PORT")
    STATS_PREFIX: str = Field("queue_info_api", env="STATS_PREFIX")
    STATS_BLOCK_URLS: list = Field([], env="STATS_BLOCK_URLS")

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    POSTGRES_SERVER: str = Field("localhost", env="POSTGRES_SERVER")
    POSTGRES_PORT: int = Field(5432, env="POSTGRES_PORT")
    POSTGRES_USER: str = Field("postgres", env="POSTGRES_USER")
    POSTGRES_PASSWORD: str = Field("postgres", env="POSTGRES_PASSWORD")
    POSTGRES_DB: str = Field("postgres", env="POSTGRES_DB")

    POSTGRES_DSN: Optional[PostgresDsn] = Field(
        "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
        env="POSTGRES_DSN",
    )

    @field_validator("POSTGRES_DSN", mode="before")
    def assemble_db_connection(cls, v: Optional[str], values: ValidationInfo) -> Any:
        if isinstance(v, str):
            return v
        return PostgresDsn.build(
            scheme="postgresql+asyncpg",
            username=values.data.get("POSTGRES_USER"),
            password=values.data.get("POSTGRES_PASSWORD"),
            host=values.data.get("POSTGRES_SERVER"),
            port=values.data.get("POSTGRES_PORT"),
            path=f"{values.data.get('POSTGRES_DB') or ''}",
        )

    DATABASE_DELETE_ALL: bool = Field(False, env="DATABASE_DELETE_ALL")
    DATABASE_CREATE_ALL: bool = Field(True, env="DATABASE_CREATE_ALL")
    DATABASE_POOL_SIZE: int = Field(20, env="DATABASE_POOL_SIZE")
    DATABASE_MAX_OVERFLOW: int = Field(40, env="DATABASE_MAX_OVERFLOW")
    DATABASE_INSERT_BATCH_SIZE: int = Field(100, env="DATABASE_INSERT_BATCH_SIZE")
    DATABASE_UPDATE_BATCH_SIZE: int = Field(100, env="DATABASE_UPDATE_BATCH_SIZE")

    CELERY_BROKER_URL: str = Field("redis://redis:6379", env="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: str = Field(
        "redis://redis:6379", env="CELERY_RESULT_BACKEND"
    )

    LOG_PATH: Union[str, None] = Field(None, env="LOG_PATH")
    LOG_FORMAT: str = Field(
        "%(asctime)s.%(msecs)03d [%(levelname)s] %(name)s - %(message)s",
        env="LOG_DEFAULT_FORMAT",
    )
    LOG_LEVEL_DEFAULT: str = Field("INFO", env="LOG_LEVEL_DEFAULT")
    LOG_LEVEL_ACCESS: str = Field("INFO", env="LOG_LEVEL_ACCESS")
    LOG_LEVEL_SQLALCHEMY: str = Field("ERROR", env="LOG_LEVEL_SQLALCHEMY")

    ASGI_WORKERS: int = Field(1, env="ASGI_WORKERS")

    FIRST_SUPERUSER: str = Field("admin", env="FIRST_SUPERUSER")
    FIRST_SUPERUSER_PASSWORD: str = Field("admin", env="FIRST_SUPERUSER_PASSWORD")

    WAIT_STATUS_TIMEOUT: int = Field(30, env="WAIT_STATUS_TIMEOUT")

    ANDROID_API_URL: str = Field(None, env="ANDROID_API_URL")
    ANDROID_API_TIMEOUT: int = Field(30, env="ANDROID_API_TIMEOUT")

    AI_REWRITE_SYSTEM_PROMPT: str = Field(
        """
        Ты — профессиональный копирайтер и редактор рекламных сообщений.
        Твоя задача — переписать короткое рекламного или уведомительного сообщения (из рассылки, SMS, Telegram и т.п.), сохранив смысл и структуру, но улучшив стиль, ясность и привлекательность.

        Требования:
        1. Сохрани язык исходного сообщения (русский, английский, украинский и т.д.).
        2. Сохрани все ссылки (URL) без изменений.
        3. Сохрани все призывы к действию (CTA), например: “нажмите”, “перейдите”, “отправьте”, “перезайдите”, “активируйте”.
        4. Сохрани смысл, количество фактов и суть предложения — не добавляй ничего нового и не убирай важные шаги.
        5. Не сокращай текст чрезмерно — длина должна быть примерно сопоставима с оригиналом.
        6. Если исходник содержит эмодзи, стрелки или акцентное оформление — можно их переформатировать, но не удалять полностью.
        7. Не изменяй числовые значения, имена брендов, названия акций, бонусов, временные ограничения.
        8. Не добавляй вводных фраз (“вот ваш текст”, “переписано:” и т.п.).

        Выводи только готовый отредактированный текст, без комментариев.
        """,
        env="AI_REWRITE_SYSTEM_PROMPT",
    )

    # Ollama configuration
    AI_OLLAMA_URL: str = Field(
        "http://109.195.197.99:3001/api/chat", env="AI_OLLAMA_URL"
    )
    AI_OLLAMA_API_KEY: str = Field("", env="AI_OLLAMA_API_KEY")
    AI_OLLAMA_TIMEOUT: int = Field(60, env="AI_OLLAMA_TIMEOUT")
    AI_OLLAMA_MAX_TOKENS: int = Field(1000, env="AI_OLLAMA_MAX_TOKENS")
    AI_OLLAMA_TEMPERATURE: float = Field(0.7, env="AI_OLLAMA_TEMPERATURE")
    AI_OLLAMA_TOP_P: float = Field(0.9, env="AI_OLLAMA_TOP_P")

    # OpenRouter configuration
    AI_OPENROUTER_URL: str = Field(
        "https://openrouter.ai/api/v1/chat/completions", env="AI_OPENROUTER_URL"
    )
    AI_OPENROUTER_API_KEY: str = Field("", env="AI_OPENROUTER_API_KEY")
    AI_OPENROUTER_TIMEOUT: int = Field(60, env="AI_OPENROUTER_TIMEOUT")
    AI_OPENROUTER_MAX_TOKENS: int = Field(1000, env="AI_OPENROUTER_MAX_TOKENS")
    AI_OPENROUTER_TEMPERATURE: float = Field(0.7, env="AI_OPENROUTER_TEMPERATURE")
    AI_OPENROUTER_TOP_P: float = Field(0.9, env="AI_OPENROUTER_TOP_P")
    AI_OPENROUTER_TITLE: str = Field("O3GO Campaigner", env="AI_OPENROUTER_TITLE")
    AI_OPENROUTER_BATCH_SIZE: int = Field(10, env="AI_OPENROUTER_BATCH_SIZE")

    LINK_SHORTENER_URL: str = Field(
        "https://link.o3go.ru/api/v1/campaigner/generate", env="LINK_SHORTENER_URL"
    )
    LINK_SHORTENER_BATCH_SIZE: int = Field(
        500, ge=1, le=500, env="LINK_SHORTENER_BATCH_SIZE"
    )
    LINK_CLICKER_URL: str = Field(
        "https://link.o3go.ru/api/requests/create", env="LINK_CLICKER_URL"
    )

    # Phone checker service configuration
    PHONE_CHECKER_URL: str = Field(
        "http://176.9.3.222:8000", env="PHONE_CHECKER_URL"
    )
    PHONE_CHECKER_API_KEY: str = Field("", env="PHONE_CHECKER_API_KEY")
    PHONE_CHECKER_TIMEOUT: int = Field(60, env="PHONE_CHECKER_TIMEOUT")

    # Phone checker batch sizes
    PHONE_CHECKER_BATCH_SIZE: int = Field(1000, env="PHONE_CHECKER_BATCH_SIZE")  # For old single checks
    PHONE_CHECKER_WEBHOOK_WINDOW_SIZE: int = Field(50, env="PHONE_CHECKER_WEBHOOK_WINDOW_SIZE")  # Window size for webhook API
    PHONE_CHECKER_WEBHOOK_CHUNK_SIZE: int = Field(50, env="PHONE_CHECKER_WEBHOOK_CHUNK_SIZE")  # Results per callback
    PHONE_CHECKER_WEBHOOK_TIMEOUT: int = Field(120, env="PHONE_CHECKER_WEBHOOK_TIMEOUT")  # Timeout per phone for webhook
    PHONE_CHECKER_WEBHOOK_TOKEN: str = Field("", env="PHONE_CHECKER_WEBHOOK_TOKEN")  # Security token for webhook
    PHONE_CHECKER_WEBHOOK_BASE_URL: str = Field("http://localhost:5001", env="PHONE_CHECKER_WEBHOOK_BASE_URL")  # Base URL for webhook

    # Task batch configuration
    REWRITE_BATCH_SIZE: int = Field(10, env="REWRITE_BATCH_SIZE")  # AI rewrite batch

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
