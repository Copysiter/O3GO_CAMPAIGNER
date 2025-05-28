from datetime import datetime, timedelta
from typing import Any, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps
from tasks import webhook
from utils.text import safe_replace

import crud, models, schemas

from .messages import get_next, set_status


router = APIRouter()

STATE_MAP = {
    'read': 'read',
    'deliver': 'delivered',
    'not_deliver': 'undelivered',
    'not_send': 'failed',
    'expired': 'failed'
}

@router.get('/next')
async def proxy_get_next(
    *, session: AsyncSession = Depends(deps.get_db),
    background_id: int, md5: str
) -> Any:
    '''
    Get next message.
    '''
    user = await deps.get_user_by_api_key(session=session, api_key=md5)
    r = await get_next(
        session=session, campaign_id=background_id, user=user
    )

    return [{
        'id_message': r['id'], 'phone': r['phone'], 'text_sms': r['text']
    }]


@router.get('/status')
async def proxy_set_status(
    *, session: AsyncSession = Depends(deps.get_db), id_message: int,
    state: Literal['deliver', 'not_deliver', 'not_send', 'expired'], md5: str
) -> Any:
    '''
    Update message status
    '''
    user = await deps.get_user_by_api_key(session=session, api_key=md5)
    state = STATE_MAP.get(state, state)
    return await set_status(
        session=session, id=id_message, status=state, user=user
    )