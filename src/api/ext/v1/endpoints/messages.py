from datetime import datetime
from dataclasses import fields
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps

import crud, models, schemas


router = APIRouter()


@router.get('/next') #, response_model=schemas.CampaignDst)
async def next(
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
                    ORDER BY status
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED;
                ''')
            )
            if not (row := result.first()):
                raise HTTPException(status_code=404, detail='Messages not found')
            campaign_dst = row._mapping  # noqa

            message = {
                'id': campaign_dst.get('id'),
                'phone': campaign_dst.get('dst_addr'),
                'text': campaign.get('msg_template')
            }

            for j in range(1, 6):
                field = f'field_{j}'
                if campaign_dst.get(field):
                    message['text'] = message['text'].replace(
                        '{' + field + '}', campaign_dst.get(field)
                    )

            await session.execute(
                statement=text(f'''
                    UPDATE campaign_dst
                    SET status = {schemas.CampaignDstStatus.SENT},
                        text = '{message.get('text')}',
                        sent_ts = '{datetime.utcnow()}'
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/status')
async def next(
    *, session: AsyncSession = Depends(deps.get_db), id: int,
    status: Literal[
        *[field.name.lower() for field in fields(schemas.CampaignDstStatus)]  # noqa
    ],
    _=Depends(deps.check_api_key)
) -> Any:
    '''
    Update message status
    '''
    try:
        async with session.begin():
            result = await session.execute(
                statement=text(f'''
                    SELECT * FROM campaign_dst
                    WHERE id = {id}
                ''')
            )
            if not (row := result.fetchone()):
                raise HTTPException(
                    status_code=404, detail='Message not found'
                )
            campaign_dst = row._mapping  # noqa

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
                        status = CASE
                            WHEN msg_delivered + msg_undelivered + 1 >= msg_total
                            THEN {schemas.CampaignStatus.COMPLETE}
                            ELSE status
                        END
                        WHERE id = {campaign_dst.get('campaign_id')}
                    ''')
                )

            message = {
                'id': campaign_dst.id,
                'phone': campaign_dst.dst_addr,
                'text': campaign_dst.text,
                'status': status,
            }

            return message
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
