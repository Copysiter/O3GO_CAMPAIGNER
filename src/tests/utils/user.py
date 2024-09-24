from typing import Dict, Optional  # noqa

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings  # noqa
from models import User, Item  # noqa
from schemas import UserCreate, UserUpdate  # noqa

import crud  # noqa

from .utils import random_lower_string, random_email


async def get_superuser_token_headers(client: AsyncClient) -> Dict[str, str]:
    login_data = {
        'username': settings.FIRST_SUPERUSER,
        'password': settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = await client.post(f'{settings.API_VERSION_PREFIX}/auth/access-token',
                          data=login_data)
    tokens = r.json()
    a_token = tokens['access_token']
    headers = {'Authorization': f'Bearer {a_token}'}
    return headers


async def user_auth_headers(
    *, client: AsyncClient, email: str, password: str
) -> Dict[str, str]:
    data = {'username': email, 'password': password}

    r = await client.post(f'{settings.API_VERSION_PREFIX}/auth/access-token',
                          data=data)
    response = r.json()
    auth_token = response['access_token']
    headers = {'Authorization': f'Bearer {auth_token}'}
    return headers


async def create_test_user(
        db: AsyncSession, email: str, password: str
) -> User:
    user = await crud.user.get_by_email(db, email=email)
    if not user:
        user_in_create = UserCreate(email=email, password=password)
        user = await crud.user.create(db, obj_in=user_in_create)
    else:
        user_in_update = UserUpdate(password=password)
        user = await crud.user.update(db, db_obj=user, obj_in=user_in_update)
    return user


async def create_random_user(db: AsyncSession) -> User:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = await crud.user.create(db=db, obj_in=user_in)
    return user


async def auth_token_from_email(
    *, client: AsyncClient, email: str, db: AsyncSession
) -> Dict[str, str]:
    password = random_lower_string()
    _ = await create_test_user(db, email=email, password=password)
    return await user_auth_headers(
        client=client, email=email, password=password
    )
