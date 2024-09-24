import pytest

from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings  # noqa
from schemas.item import ItemCreate  # noqa
from tests.utils.utils import random_email, random_lower_string  # noqa
from tests.utils.item import create_test_item  # noqa

import crud  # noqa


@pytest.mark.asyncio()
async def test_read_items(
    client: AsyncClient, normal_user_token_headers: dict, db: AsyncSession
) -> None:
    response = await client.get(
        url=f'{settings.API_VERSION_PREFIX}/items/',
        headers=normal_user_token_headers
    )
    assert response.status_code == status.HTTP_200_OK
    content = response.json()
    assert 'data' in content
    assert 'total' in content
    assert isinstance(content['data'], list)
    assert isinstance(content['total'], int)


@pytest.mark.asyncio()
async def test_create_item(
    client: AsyncClient, normal_user_token_headers: dict, db: AsyncSession
) -> None:
    data = {
        'title': random_lower_string(),
        'description': random_lower_string()
    }
    response = await client.post(
        url=f'{settings.API_VERSION_PREFIX}/items/',
        headers=normal_user_token_headers,
        json=data
    )
    assert response.status_code == status.HTTP_201_CREATED
    content = response.json()
    assert content['title'] == data['title']
    assert content['description'] == data['description']
    assert 'id' in content
    assert 'user_id' in content


@pytest.mark.asyncio()
async def test_read_item(
    client: AsyncClient, normal_user_token_headers: dict, db: AsyncSession
) -> None:
    item = await create_test_item(db)
    response = await client.get(
        url=f'{settings.API_VERSION_PREFIX}/items/{item.id}',
        headers=normal_user_token_headers
    )
    assert response.status_code == status.HTTP_200_OK
    content = response.json()
    assert content['title'] == item.title
    assert content['description'] == item.description
    assert content['id'] == item.id
    assert content['user_id'] == item.user_id
