from datetime import datetime, timedelta
from typing import Any, Optional, Literal, List
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, insert, update, case
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from api import deps
from tasks import webhook
from utils.text import safe_replace

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
        async with session.begin():
            result = await session.execute(
                text(f'''
                    SELECT campaign_dst.*, campaign.msg_status_timeout
                    FROM campaign_dst
                    JOIN campaign ON campaign.id = campaign_dst.campaign_id
                    WHERE campaign_dst.dst_addr = :dst_addr
                    AND campaign_dst.campaign_id = :campaign_id
                    AND campaign_dst.status = :status
                    {'AND campaign.user_id = :user_id' if not user.is_superuser else ''}
                '''),
                {
                    'dst_addr': dst_addr,
                    'campaign_id': campaign_id,
                    'status': schemas.CampaignDstStatus.WAITING,
                    'user_id': user.id
                }
            )
            if not (row := result.fetchone()):
                raise HTTPException(
                    status_code=404, detail='Message not found'
                )
            campaign_dst = row._mapping  # noqa

        sent_ts = datetime.utcnow()
        expire_ts = sent_ts + timedelta(
            seconds=campaign_dst.msg_status_timeout
        ) if campaign_dst.msg_status_timeout else None

        r = await session.execute(
            text('''
                UPDATE campaign_dst
                SET status = :status,
                    sent_ts = :sent_ts,
                    expire_ts = :expire_ts
                WHERE id = :id
                AND campaign_id = :campaign_id
            '''),
            {
                'status': schemas.CampaignDstStatus.SENT,
                'sent_ts': sent_ts,
                'expire_ts': expire_ts,
                'id': campaign_dst.id,
                'campaign_id': campaign_id,
            }
        )

        await session.commit()

        return {
            'id': campaign_dst.id,
            'phone': campaign_dst.dst_addr,
            'text': safe_replace(campaign_dst.text)
        }

    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=getattr(e, 'status_code', 500), detail=str(e)
        )


@router.get('/next') #, response_model=schemas.CampaignDst)
async def get_next(
    *, session: AsyncSession = Depends(deps.get_db),
    campaign_id: int = None, api_key: str = None,
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
        async with session.begin():
            if campaign_id is not None:
                result = await session.execute(
                    text(f'''
                        SELECT campaign.* 
                        FROM campaign
                        WHERE campaign.id = :campaign_id
                        {'AND campaign.user_id = :user_id' if not user.is_superuser else ''}
                        LIMIT 1;
                    '''),
                    {
                        'campaign_id': campaign_id
                    }
                )
            else:
                result = await session.execute(
                    text(f'''
                        SELECT campaign.* 
                        FROM campaign
                        JOIN campaign_api_keys 
                            ON campaign.id = campaign_api_keys.campaign_id
                            AND campaign_api_keys.api_key = :api_key
                        WHERE campaign.status = :status
                          AND (
                              (campaign.start_ts IS NOT NULL AND campaign.stop_ts IS NOT NULL 
                               AND :now BETWEEN campaign.start_ts AND campaign.stop_ts)
                              OR
                              (schedule::jsonb ->> :weekday IS NOT NULL 
                               AND (schedule::jsonb -> :weekday)::jsonb @> to_jsonb(CAST(:hour AS INTEGER)))
                          )
                          {'AND campaign.user_id = :user_id' if not user.is_superuser else ''}
                        ORDER BY campaign.order, campaign.msg_sent 
                        LIMIT 1;
                    '''),
                    {
                        'api_key': api_key,
                        'user_id': user.id,
                        'status': schemas.CampaignStatus.RUNNING,
                        'now': now,
                        'weekday': weekday,
                        'hour': hour
                    }
                )
            if not (row := result.first()):
                raise HTTPException(
                    status_code=404, detail='Active campaigns not found'
                )
            campaign = row._mapping  # noqa

            result = await session.execute(
                text('''
                    SELECT * FROM campaign_dst
                    WHERE campaign_id = :campaign_id
                    AND status IN (:status_created, :status_failed)
                    AND attempts > 0
                    ORDER BY status
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED;
                '''),
                {
                    'campaign_id': campaign.get('id'),
                    'status_created': schemas.CampaignDstStatus.CREATED,
                    'status_failed': schemas.CampaignDstStatus.FAILED,
                }
            )
            if not (row := result.first()):
                raise HTTPException(
                    status_code=404, detail='Messages not found'
                )
            campaign_dst = row._mapping  # noqa

            message = {
                'id': campaign_dst.get('id'),
                'phone': campaign_dst.get('dst_addr'),
                'text': safe_replace(campaign_dst.get('text'))
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
            expire_ts = sent_ts + timedelta(
                seconds=campaign.msg_status_timeout
            ) if campaign.msg_status_timeout else None

            await session.execute(
                text('''
                    UPDATE campaign_dst
                    SET status = :status,
                        text = :text,
                        sent_ts = CASE 
                            WHEN CAST(:status AS INTEGER) = :status_waiting
                            THEN sent_ts
                            ELSE :sent_ts
                        END,
                        expire_ts = :expire_ts,
                        attempts = attempts - 1
                    WHERE id = :id
                '''),
                {
                    'status': status,
                    'status_waiting': schemas.CampaignDstStatus.WAITING,
                    'text': safe_replace(message.get('text')),
                    'sent_ts': sent_ts,
                    'expire_ts': expire_ts,
                    'id': campaign_dst.get('id'),
                }
            )

            await session.execute(
                text('''
                    UPDATE campaign
                    SET msg_sent = CASE 
                        WHEN CAST(:current_status AS INTEGER) = :status_failed
                        THEN msg_sent
                        ELSE msg_sent + 1
                    END,
                    msg_delivered = CASE 
                        WHEN CAST(:status AS INTEGER) = :status_delivered
                        THEN msg_delivered + 1
                        ELSE msg_delivered
                    END,
                    msg_failed = CASE 
                        WHEN :current_status = :status_failed
                        THEN msg_failed - 1
                        ELSE msg_failed
                    END
                    WHERE id = :campaign_id
                '''),
                {
                    'current_status': campaign_dst.get('status'),
                    'status_failed': schemas.CampaignDstStatus.FAILED,
                    'status': status,
                    'status_delivered': schemas.CampaignDstStatus.DELIVERED,
                    'campaign_id': campaign_dst.get('campaign_id'),
                }
            )

            await session.commit()

            if status == schemas.CampaignDstStatus.DELIVERED \
                    and campaign.webhook_url is not None:
                webhook.delay(campaign.webhook_url, data={
                    'id': campaign_dst.ext_id, 'status': 'delivered'
                })

            return message
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=getattr(e, 'status_code', 500), detail=str(e)
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
        async with (session.begin()):
            result = await session.execute(
                text(f'''
                    SELECT campaign_dst.*, campaign.webhook_url
                    FROM campaign_dst
                    JOIN campaign ON campaign.id = campaign_dst.campaign_id
                    WHERE campaign_dst.id = :id
                      {'AND campaign.user_id = :user_id' if not user.is_superuser else ''}
                '''),
                {
                    'id': id,
                    'user_id': user.id
                }
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
                status = 'undelivered'

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
                    text('''
                        UPDATE campaign_dst
                        SET status = :status,
                            src_addr = :src_addr,
                            update_ts = :update_ts,
                            expire_ts = NULL
                        WHERE id = :id
                    '''),
                    {
                        'status': new_status,
                        'src_addr': src_addr,
                        'update_ts': datetime.utcnow(),
                        'id': id
                    }
                )

                await session.execute(
                    text(f'''
                        UPDATE campaign
                        SET msg_{status} = msg_{status} + 1,
                            status = {campaign_status}
                        WHERE id = :campaign_id
                    '''),
                    {
                        'campaign_id': campaign_dst.get('campaign_id')
                    }
                )

            if campaign_dst.webhook_url and campaign_dst.ext_id \
                    and status in ('delivered', 'undelivered'):
                webhook.delay(campaign_dst.webhook_url, data={
                    'id': campaign_dst.ext_id, 'status': status
                })

            return {
                'id': campaign_dst.id,
                'dst_addr': campaign_dst.dst_addr,
                'src_addr': src_addr,
                'text': safe_replace(campaign_dst.text),
                'status': status,
            }
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=getattr(e, 'status_code', 500), detail=str(e)
        )
