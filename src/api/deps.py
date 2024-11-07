from typing import List, Dict
from fastapi import Request, Depends, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer, HTTPBasic, HTTPBasicCredentials
from fastapi.security.api_key import APIKey, APIKeyQuery, APIKeyHeader
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings  # noqa
from core.security import verify_password # noqa
from db.session import async_session  # noqa

import crud, models, schemas  # noqa

from utils.query_string import parse  # noqa


reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f'{settings.API_VERSION_PREFIX}/auth/access-token'
)

http_basic = HTTPBasic()

api_key_query = APIKeyQuery(name='x_api_key', auto_error=False)
api_key_header = APIKeyHeader(name='X-Api-Key', auto_error=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> models.User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        token_data = schemas.TokenPayload(**payload)
    except (jwt.JWTError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Could not validate credentials',
        )
    user = await crud.user.get(db, id=token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return user


async def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not crud.user.is_active(current_user):
        raise HTTPException(status_code=400, detail='Inactive user')
    return current_user


async def get_current_active_superuser(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not crud.user.is_superuser(current_user):
        raise HTTPException(
            status_code=400, detail='The user doesn\'t have enough privileges'
        )
    return current_user


async def get_basic_auth_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPBasicCredentials = Depends(http_basic)
) -> models.User:
    user = await crud.user.get_by_login(db, login=credentials.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail='User not found'
        )
    if not crud.user.is_active(user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail='Inactive user'
        )
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail='Incorrect password',
            headers={"WWW-Authenticate": "Basic"},
        )
    return user


def get_api_key(
    key_query: APIKey = Security(api_key_query),
    key_header: APIKey = Security(api_key_header)
) -> APIKey:
    if key_query:
        return key_query
    if key_header:
        return key_header
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail='Not authenticated'
    )


async def check_api_key(
    api_key: APIKey = Security(get_api_key)) -> bool:
    if api_key != settings.EXT_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid API key'
        )
    return True


def query_params(
    request: Request
) -> Dict:
    params = parse(str(request.query_params), normalized=True)
    return params


def request_filters(
    params: Dict = Depends(query_params)
) -> List | Dict:
    filters = params.get('filters')
    if not filters:
        filters = params.get('filter')
    return filters or []


def request_orders(
    params: Dict = Depends(query_params)
) -> List:
    orders = params.get('orders')
    if not orders:
        orders = params.get('order')
    if not orders:
        orders = params.get('sort')
    return orders or []
