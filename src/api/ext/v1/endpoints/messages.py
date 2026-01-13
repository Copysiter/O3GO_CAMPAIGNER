from datetime import datetime, timedelta
from typing import Any, Optional, Literal, List
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import text, insert, update, case
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from api import deps
import services.message

import crud, models, schemas


router = APIRouter()


@router.post('/send') #, response_model=schemas.CampaignDst)
async def send(
    *, db: AsyncSession = Depends(deps.get_db),
    user = Depends(deps.get_user_by_api_key),
    messages: List[schemas.MessageCreate]
) -> Any:
    '''
    Send batch messages.
    '''
    entries_data = []
    campaigns_count = defaultdict(int)
    for message in messages:
        campaign = await crud.campaign.get(db=db, id=message.campaign_id)
        if not campaign or campaign.user_id != user.id:
            raise HTTPException(
                status_code=404,
                detail=f'Campaign not found '
                       f'(campaign_id={message.campaign_id})'
            )
        obj_in = message.model_dump(exclude_none=True)
        obj_in['ext_id'] = str(obj_in.pop('id')) if 'id' in obj_in else None
        obj_in['attempts'] = campaign.msg_attempts
        if campaign.msg_sending_timeout is not None:
            obj_in['expire_ts'] = datetime.utcnow() + timedelta(
                seconds=campaign.msg_sending_timeout
            )
        entries_data.append(obj_in)
        campaigns_count[campaign.id] += 1
    statement = insert(models.CampaignDst)
    for i in range(0, len(entries_data), settings.DATABASE_INSERT_BATCH_SIZE):
        batch = entries_data[i:i + settings.DATABASE_INSERT_BATCH_SIZE]
        result = await db.execute(statement, batch)
    statement = (
        update(models.Campaign)
        .where(models.Campaign.id.in_(campaigns_count.keys()))
        .values(
            msg_total=models.Campaign.msg_total + case(*[
                (models.Campaign.id == campaign_id, count)
                for campaign_id, count in campaigns_count.items()
            ], else_=0), status = schemas.CampaignStatus.RUNNING
        )
    )
    await db.execute(statement)
    await db.commit()

    return entries_data


@router.get('/get') #, response_model=schemas.CampaignDst)
async def get(
    *, session: AsyncSession = Depends(deps.get_db),
    campaign_id: int, dst_addr: str,
    user = Depends(deps.get_user_by_api_key)
) -> Any:
    '''
    Get message.
    '''
    try:
        msg = await services.message.get_processing(
            session=session,
            user=user,
            campaign_id=campaign_id,
            dst_addr=dst_addr
        )
        return msg
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"{type(e).__name__}: {e}"
        )


@router.get('/next') #, response_model=schemas.CampaignDst)
async def get_next(
    *, session: AsyncSession = Depends(deps.get_db),
    campaign_id: int = None, device: str = None, api_key: str = None,
    status: Literal['sent', 'waiting', 'delivered'] = 'sent',
    user = Depends(deps.get_user_by_api_key)
) -> Any:
    '''
    Get next message.
    '''
    status = getattr(schemas.CampaignDstStatus, status.upper())
    now = datetime.utcnow()
    weekday = str(now.isoweekday())
    hour = now.hour
    try:
        return await services.message.get_next_processing(
            session=session, user=user,
            campaign_id=campaign_id, device=device, api_key=api_key,
            status=status, now=now, weekday=weekday, hour=hour
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=getattr(e, 'status_code', 500),
            detail=f'{type(e).__name__}: {e}'
        )


@router.get('/status')
async def set_status(
    *, session: AsyncSession = Depends(deps.get_db), id: int,
    status: Literal['delivered', 'undelivered', 'failed'],
    src_addr: Optional[str] = None,
    user = Depends(deps.get_user_by_api_key)
) -> Any:
    '''
    Update message status
    '''
    try:
        return await services.message.set_status_processing(
            session=session, user=user,
            id=id, src_addr=src_addr, status=status
        )
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=getattr(e, 'status_code', 500),
            detail=f'{type(e).__name__}: {e}'
        )
