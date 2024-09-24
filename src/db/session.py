from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession  # noqa

from core.config import settings  # noqa


url = settings.POSTGRES_DSN

engine = create_async_engine(
    str(url), future=True, echo=False, pool_pre_ping=True,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW
)

async_session = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False,
    autocommit=False, autoflush=False
)
