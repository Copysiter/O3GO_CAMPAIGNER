import asyncio
from typing import Dict, Generator  # noqa

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings  # noqa
from db.session import async_session  # noqa
from main import app  # noqa
from tests.utils.user import get_superuser_token_headers, auth_token_from_email  # noqa


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def db() -> AsyncSession:
    async with async_session() as session:
        yield session


@pytest.fixture(scope="module")
async def client() -> AsyncClient:
    async with AsyncClient(
        app=app, follow_redirects=False, base_url='http://localhost'
    ) as client:
        yield client


@pytest.fixture(scope="module")
async def superuser_token_headers(client: AsyncClient) -> Dict[str, str]:
    return await get_superuser_token_headers(client)


@pytest.fixture(scope="module")
async def normal_user_token_headers(
    client: AsyncClient, db: AsyncSession
) -> Dict[str, str]:
    return await auth_token_from_email(
        client=client, email=settings.TEST_USER_EMAIL, db=db
    )
