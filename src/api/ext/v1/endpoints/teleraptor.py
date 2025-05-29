from typing import Any, Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps

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
    md5: str = None, id_background: int,
    user = Depends(deps.get_user_by_api_key)
) -> Any:
    '''
    Get next message.
    '''
    # user = await deps.get_user_by_api_key(session=session, api_key=md5)
    r = await get_next(
        session=session, campaign_id=id_background, user=user
    )

    return [{
        'id_message': str(r['id']), 'phone': r['phone'], 'text_sms': r['text']
    }]


@router.get('/status')
async def proxy_set_status(
    *, session: AsyncSession = Depends(deps.get_db), md5: str = None, id_message: str,
    state: Literal['deliver', 'not_deliver', 'not_send', 'expired'],
    user = Depends(deps.get_user_by_api_key)
) -> Any:
    '''
    Update message status
    '''
    # user = await deps.get_user_by_api_key(session=session, api_key=md5)
    state = STATE_MAP.get(state, state)
    r = await set_status(
        session=session, id=int(id_message), status=state, user=user
    )
    return [{'id_message': id_message, 'error': '0'}]