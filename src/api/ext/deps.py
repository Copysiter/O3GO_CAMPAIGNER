from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKey, APIKeyQuery, APIKeyHeader

from core.config import settings  # noqa

api_key_query = APIKeyQuery(name='x_api_key', auto_error=False)
api_key_header = APIKeyHeader(name='X-Api-Key', auto_error=False)


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
