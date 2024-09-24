import secrets

from typing import Any, Union, Optional, List, Dict  # noqa
from pydantic import Field, EmailStr, PostgresDsn, ValidationInfo, field_validator  # noqa
from pydantic_settings import BaseSettings

from logging import config as logging_config


class Settings(BaseSettings):
    API_VERSION: str = Field('1', env='API_VERSION')
    API_VERSION_PREFIX: str = Field('/api/v1', env='API_VERSION_PREFIX')

    EXT_API_VERSION_PREFIX: str = Field('/ext/api/v1', env='EXT_API_VERSION_PREFIX')
    EXT_API_KEY: Union[str, None] = Field(None, env='EXT_API_KEY')

    SECRET_KEY: str = '123456'
    DYNAMIC_SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 10
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30
    JWT_ALGORITHM: str = 'HS256'

    PROJECT_NAME: str = Field('FastAPI', env='PROJECT_NAME')
    PROJECT_HOST: str = Field('127.0.0.1', env='PROJECT_HOST')
    PROJECT_PORT: int = Field(8080, env='PROJECT_PORT')

    BACKEND_CORS_ORIGINS: Union[str, List[str]] = Field(
        '*', env='BACKEND_CORS_ORIGINS'
    )

    STATS_ENABLE: bool = Field(False, env='STATS_ENABLE')
    STATS_SERVER_HOST: str = Field(
        'host.docker.internal', env='STATS_SERVER_HOST'
    )
    STATS_SERVER_PORT: int = Field(8125, env='STATS_SERVER_PORT')
    STATS_PREFIX: str = Field('queue_info_api', env='STATS_PREFIX')
    STATS_BLOCK_URLS: list = Field([], env='STATS_BLOCK_URLS')

    @field_validator('BACKEND_CORS_ORIGINS', mode='before')
    def assemble_cors_origins(
        cls, v: Union[str, List[str]]
    ) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith('['):
            return [i.strip() for i in v.split(',')]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    POSTGRES_SERVER: str = Field('localhost', env='POSTGRES_SERVER')
    POSTGRES_PORT: int = Field(5432, env='POSTGRES_PORT')
    POSTGRES_USER: str = Field('postgres', env='POSTGRES_USER')
    POSTGRES_PASSWORD: str = Field('postgres', env='POSTGRES_PASSWORD')
    POSTGRES_DB: str = Field('postgres', env='POSTGRES_DB')

    POSTGRES_DSN: Optional[PostgresDsn] = Field(
        'postgresql+asyncpg://postgres:postgres@localhost:5432/postgres',
        env='POSTGRES_DSN'
    )

    @field_validator('POSTGRES_DSN', mode='before')
    def assemble_db_connection(cls, v: Optional[str],
                               values: ValidationInfo) -> Any:
        if isinstance(v, str):
            return v
        return PostgresDsn.build(
            scheme='postgresql+asyncpg',
            username=values.data.get('POSTGRES_USER'),
            password=values.data.get('POSTGRES_PASSWORD'),
            host=values.data.get('POSTGRES_SERVER'),
            port=values.data.get('POSTGRES_PORT'),
            path=f'{values.data.get("POSTGRES_DB") or ""}',
        )

    DATABASE_DELETE_ALL: bool = Field(False, env='DATABASE_DELETE_ALL')
    DATABASE_CREATE_ALL: bool = Field(True, env='DATABASE_CREATE_ALL')
    DATABASE_POOL_SIZE: int = Field(20, env='DATABASE_POOL_SIZE')
    DATABASE_MAX_OVERFLOW: int = Field(40, env='DATABASE_MAX_OVERFLOW')

    CELERY_BROKER_URL: str = Field('redis://redis:6379', env='CELERY_BROKER_URL')
    CELERY_RESULT_BACKEND: str = Field('redis://redis:6379', env='CELERY_RESULT_BACKEND')

    LOG_PATH: Union[str, None] = Field(None, env='LOG_PATH')
    LOG_FORMAT: str = Field(
        '%(asctime)s.%(msecs)03d [%(levelname)s] %(name)s - %(message)s',
        env='LOG_DEFAULT_FORMAT'
    )
    LOG_LEVEL_DEFAULT: str = Field('INFO', env='LOG_LEVEL_DEFAULT')
    LOG_LEVEL_ACCESS: str = Field('INFO', env='LOG_LEVEL_ACCESS')
    LOG_LEVEL_SQLALCHEMY: str = Field('ERROR', env='LOG_LEVEL_SQLALCHEMY')

    ASGI_WORKERS: int = Field(1, env='ASGI_WORKERS')

    FIRST_SUPERUSER: str = Field('admin', env='FIRST_SUPERUSER')
    FIRST_SUPERUSER_PASSWORD: str = Field('admin', env='FIRST_SUPERUSER_PASSWORD')

    REPORT_LAST_DAYS: int = Field(7, env='REPORT_LAST_DAYS')

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'


settings = Settings()
