from typing import Any, Literal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps

import services.message


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
    now = datetime.utcnow()
    weekday = str(now.isoweekday())
    hour = now.hour
    try:
        async with session.begin():
            message = await services.message.get_next_processing(
                session=session, user=user, campaign_id=int(id_background),
                now=now, weekday=weekday, hour=hour
            )
            return [{
                'id_message': str(message.get('id')),
                'phone': message.get('phone'),
                'text_sms': message.get('text'), 'error': '0'
            }]
    except HTTPException as e:
        raise e
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=500, detail=f'{type(e).__name__}: {str(e)}'
        )


@router.get('/status')
async def proxy_set_status(
    *, session: AsyncSession = Depends(deps.get_db),
    md5: str = None, id_message: str,
    state: Literal['deliver', 'not_deliver', 'not_send', 'expired'],
    user = Depends(deps.get_user_by_api_key)
) -> Any:
    '''
    Update message status
    '''
    status = STATE_MAP.get(state, state)
    try:
        async with session.begin():
            _ = await services.message.set_status_processing(
                session=session, user=user,
                id=int(id_message), status=status
            )
            return [{'id_message': id_message, 'error': '0'}]
    except HTTPException as e:
        raise e
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=500, detail=f'{type(e).__name__}: {str(e)}'
        )


@router.get('/')
async def proxy_message(
    *, session: AsyncSession = Depends(deps.get_db),
    md5: str = None, id_background: int = None, id_message: str = None,
    state: Literal['deliver', 'not_deliver', 'not_send', 'expired'] = None,
    user = Depends(deps.get_user_by_api_key)
) -> Any:
    '''
    Get next message.
    '''
    if id_message and state:
        return await proxy_set_status(
            session=session, id_message=id_message, state=state, user=user
        )
    elif id_background:
        return await proxy_get_next(
            session=session, md5=md5, id_background=id_background, user=user
        )
    else:
        raise HTTPException(status_code=422, detail='Not enough params')
