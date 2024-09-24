from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa

import models  # noqa


router = APIRouter()


@router.get('/ping_db')
async def ping_database(
        *,
        db: AsyncSession = Depends(deps.get_db),
        current_user: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    '''
    Check DB connection
    '''
    try:
        await db.connection()
        result = True
    except Exception:
        result = False

    return {'connected': result}
