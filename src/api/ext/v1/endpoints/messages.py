from datetime import datetime, timedelta
from typing import Any, Literal, List
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, insert, update, case
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from api import deps
from tasks import webhook

import crud, models, schemas


router = APIRouter()


@router.post('/send') #, response_model=schemas.CampaignDst)
async def send(
    *, db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_basic_auth_user),
    messages: List[schemas.MessageCreate]
) -> Any:
    '''
    Send batch messages.
    '''
    entries_data = []
    campaigns_count = defaultdict(int)
    for message in messages:
        campaign = await crud.campaign.get(db=db, id=message.campaign_id)
        if not campaign or campaign.user_id != current_user.id:
            raise HTTPException(
                status_code=404,
                detail=f'Campaign not found '
                       f'(campaign_id={message.campaign_id})'
            )
        obj_in = message.model_dump()
        obj_in['ext_id'] = str(obj_in.pop('id'))
        obj_in['dst_addr'] = str(obj_in.pop('phone'))
        obj_in['ext_id'] = str(obj_in.pop('id'))
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
        await db.execute(statement, batch)
    statement = (
        update(models.Campaign)
        .where(models.Campaign.id.in_(campaigns_count.keys()))
        .values(
            msg_total=models.Campaign.msg_total + case(*[
                (models.Campaign.id == campaign_id, count)
                for campaign_id, count in campaigns_count.items()
            ], else_=0)
        )
    )
    await db.execute(statement)

    await db.commit()
    return entries_data


@router.get('/next') #, response_model=schemas.CampaignDst)
async def get_next(
    *, session: AsyncSession = Depends(deps.get_db), api_key: str = None,
    _=Depends(deps.check_api_key)
) -> Any:
    '''
    Get next message.
    '''

    now = datetime.utcnow()
    weekday = str(now.isoweekday())
    hour = now.hour
    try:
        async with session.begin():
            result = await session.execute(
                statement=text(f'''
                    SELECT campaign.* FROM campaign
                    JOIN campaign_api_keys ON campaign.id = campaign_api_keys.campaign_id
                    AND campaign_api_keys.api_key = '{api_key}'
                    WHERE campaign.status = {schemas.CampaignStatus.RUNNING}
                    AND ((campaign.start_ts IS NOT NULL AND campaign.stop_ts IS NOT NULL 
                          AND '{now}' BETWEEN campaign.start_ts AND campaign.stop_ts) OR
                         (schedule::jsonb ->> '{weekday}' IS NOT NULL 
                          AND(schedule::jsonb -> '{weekday}')::jsonb @> to_jsonb({hour}::int)))
                    ORDER BY campaign.order, campaign.msg_sent LIMIT 1;
                ''')
            )
            if not (row := result.first()):
                raise HTTPException(
                    status_code=404, detail='Active campaigns not found'
                )
            campaign = row._mapping  # noqa

            result = await session.execute(
                statement=text(f'''
                    SELECT * FROM campaign_dst
                    WHERE campaign_id = {campaign.get('id')}
                    AND status IN (
                        {schemas.CampaignDstStatus.CREATED},
                        {schemas.CampaignDstStatus.FAILED}
                    )
                    AND attempts > 0
                    ORDER BY status
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED;
                ''')
            )
            if not (row := result.first()):
                raise HTTPException(
                    status_code=404, detail='Messages not found'
                )
            campaign_dst = row._mapping  # noqa

            message = {
                'id': campaign_dst.get('id'),
                'phone': campaign_dst.get('dst_addr'),
                'text': campaign_dst.get('text')
            }
            if not message['text']:
                message['text'] = campaign.get('msg_template')
                for j in range(1, 6):
                    field = f'field_{j}'
                    if campaign_dst.get(field):
                        message['text'] = message['text'].replace(
                            '{' + field + '}', campaign_dst.get(field)
                        )

            sent_ts = datetime.utcnow()
            expire_ts = "'{}'".format(
                sent_ts + timedelta(seconds=campaign.msg_status_timeout)
            ) if campaign.msg_status_timeout else 'NULL'

            await session.execute(
                statement=text(f'''
                    UPDATE campaign_dst
                    SET status = {schemas.CampaignDstStatus.SENT},
                        text = '{message.get('text')}',
                        sent_ts = '{sent_ts}',
                        expire_ts = {expire_ts},
                        attempts = attempts - 1
                    WHERE id = {campaign_dst.get('id')}
                ''')
            )

            await session.execute(
                statement=text(f'''
                    UPDATE campaign
                    SET msg_sent = CASE 
                        WHEN {campaign_dst.get('status')} = {schemas.CampaignDstStatus.FAILED}
                        THEN msg_sent
                        ELSE msg_sent + 1
                    END,
                    msg_failed = CASE 
                        WHEN {campaign_dst.get('status')} = {schemas.CampaignDstStatus.FAILED}
                        THEN msg_failed - 1
                        ELSE msg_failed
                    END
                    WHERE id = {campaign_dst.get('campaign_id')}
                ''')
            )

            return message
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=getattr(e, 'status_code', 500), detail=e.detail)


@router.get('/status')
async def set_status(
    *, session: AsyncSession = Depends(deps.get_db), id: int,
    status: Literal['delivered', 'undelivered', 'failed'],
    _=Depends(deps.check_api_key)
) -> Any:
    '''
    Update message status
    '''
    try:
        async with (session.begin()):
            result = await session.execute(
                statement=text(f'''
                    SELECT campaign_dst.*, campaign.webhook_url
                    FROM campaign_dst
                    JOIN campaign ON campaign.id = campaign_dst.campaign_id
                    WHERE campaign_dst.id = {id}
                ''')
            )
            if not (row := result.fetchone()):
                raise HTTPException(
                    status_code=404, detail='Message not found'
                )
            campaign_dst = row._mapping  # noqa

            if campaign_dst.status in (
                schemas.CampaignDstStatus.DELIVERED,
                schemas.CampaignDstStatus.UNDELIVERED,
                schemas.CampaignDstStatus.FAILED
            ):
                raise HTTPException(
                    status_code=422,
                    detail='Message status already received'
                )

            if status == 'failed' and campaign_dst.attempts < 1:
                status == 'undelivered'

            campaign_status = f'''
            CASE
                WHEN msg_delivered + msg_undelivered + 1 >= msg_total
                THEN {schemas.CampaignStatus.COMPLETE}
                ELSE status
            END
            ''' if status in ('delivered', 'undelivered') else 'status'

            if campaign_dst.status != (
                new_status := getattr(
                    schemas.CampaignDstStatus, status.upper()
                )
            ):
                await session.execute(
                    statement=text(f'''
                        UPDATE campaign_dst
                        SET status = {new_status},
                        update_ts = '{datetime.utcnow()}'
                        WHERE id = {id}
                    ''')
                )
                await session.execute(
                    statement=text(f'''
                        UPDATE campaign
                        SET msg_{status} = msg_{status} + 1,
                        status = {campaign_status}
                        WHERE id = {campaign_dst.get('campaign_id')}
                    ''')
                )

            if campaign_dst.webhook_url and campaign_dst.ext_id:
                webhook.delay(campaign_dst.webhook_url, {
                    'id': campaign_dst.ext_id, 'status': status
                })

            return {
                'id': campaign_dst.id,
                'phone': campaign_dst.dst_addr,
                'text': campaign_dst.text,
                'status': status,
            }
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=getattr(e, 'status_code', 500), detail=e.detail)
