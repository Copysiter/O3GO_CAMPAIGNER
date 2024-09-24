import pytest

from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings  # noqa
from schemas.user import UserCreate  # noqa
from tests.utils.user import random_email, random_lower_string  # noqa

import crud  # noqa


@pytest.mark.asyncio()
async def test_get_users_superuser_me(
    client: AsyncClient, superuser_token_headers: dict
) -> None:
    response = await client.get(
        url=f'{settings.API_VERSION_PREFIX}/users/me',
        headers=superuser_token_headers
    )
    assert response.status_code == status.HTTP_200_OK
    current_user = response.json()
    assert current_user
    assert current_user['is_active'] is True
    assert current_user['is_superuser'] is True
    assert current_user['email'] == settings.FIRST_SUPERUSER


@pytest.mark.asyncio()
async def test_get_users_normal_user_me(
    client: AsyncClient, normal_user_token_headers: dict
) -> None:
    response = await client.get(
        url=f'{settings.API_VERSION_PREFIX}/users/me',
        headers=normal_user_token_headers
    )
    assert response.status_code == status.HTTP_200_OK
    current_user = response.json()
    assert current_user
    assert current_user['is_active'] is True
    assert current_user['is_superuser'] is False
    assert current_user['email'] == settings.TEST_USER_EMAIL


@pytest.mark.asyncio()
async def test_create_user_new_email(
    client: AsyncClient, superuser_token_headers: dict, db: AsyncSession
) -> None:
    email = random_email()
    password = random_lower_string()
    data = {'email': email, 'password': password}
    response = await client.post(
        url=f'{settings.API_VERSION_PREFIX}/users/',
        headers=superuser_token_headers, json=data,
    )
    assert response.status_code == status.HTTP_201_CREATED
    created_user = response.json()
    user = await crud.user.get_by_email(db, email=email)
    assert user
    assert user.email == created_user['email']


@pytest.mark.asyncio()
async def test_get_existing_user(
    client: AsyncClient, superuser_token_headers: dict, db: AsyncSession
) -> None:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = await crud.user.create(db, obj_in=user_in)
    user_id = user.id
    response = await client.get(
        url=f'{settings.API_VERSION_PREFIX}/users/{user_id}',
        headers=superuser_token_headers,
    )
    assert response.status_code == status.HTTP_200_OK
    api_user = response.json()
    existing_user = await crud.user.get_by_email(db, email=email)
    assert existing_user
    assert existing_user.email == api_user['email']


@pytest.mark.asyncio()
async def test_create_user_existing_email(
    client: AsyncClient, superuser_token_headers: dict, db: AsyncSession
) -> None:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    _ = await crud.user.create(db, obj_in=user_in)
    data = {'email': email, 'password': password}
    response = await client.post(
        url=f'{settings.API_VERSION_PREFIX}/users/',
        headers=superuser_token_headers, json=data,
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    created_user = response.json()
    assert 'id' not in created_user


@pytest.mark.asyncio()
async def test_create_user_by_normal_user(
    client: AsyncClient, normal_user_token_headers: dict
) -> None:
    username = random_email()
    password = random_lower_string()
    data = {'email': username, 'password': password}
    response = await client.post(
        url=f'{settings.API_VERSION_PREFIX}/users/',
        headers=normal_user_token_headers,
        json=data,
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio()
async def test_retrieve_users(
    client: AsyncClient, superuser_token_headers: dict, db: AsyncSession
) -> None:
    username = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=username, password=password)
    _ = await crud.user.create(db, obj_in=user_in)

    username2 = random_email()
    password2 = random_lower_string()
    user_in2 = UserCreate(email=username2, password=password2)
    _ = await crud.user.create(db, obj_in=user_in2)

    response = await client.get(
        url=f'{settings.API_VERSION_PREFIX}/users/',
        headers=superuser_token_headers
    )
    all_users = response.json()
    assert 'data' in all_users
    assert 'total' in all_users
    assert isinstance(all_users['data'], list)
    assert isinstance(all_users['total'], int)
    assert len(all_users['data']) > 1
    assert all_users['total'] > 1
    for item in all_users['data']:
        assert 'email' in item
