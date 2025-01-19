import asyncio
import aiohttp

from datetime import datetime, timedelta
from collections import defaultdict

from celery import Celery
from sqlalchemy import text

from core.config import settings
from db.session import async_session

import schemas

celery = Celery(__name__)
celery.conf.broker_url = settings.CELERY_BROKER_URL
celery.conf.result_backend = settings.CELERY_RESULT_BACKEND
celery.conf.broker_connection_retry_on_startup = True
celery.conf.timezone = 'UTC'
celery.conf.enable_utc = True


async def update_expired_messages():
    async with async_session() as session:
        async with session.begin():
            try:
                ts = datetime.utcnow()
                result = await session.execute(
                    text('''
                        UPDATE campaign_dst
                        SET status = CASE
                            WHEN attempts > 0 AND status > CAST(:created_status AS INTEGER)
                            THEN CAST(:failed_status AS INTEGER)
                            ELSE CAST(:undelivered_status AS INTEGER)
                        END, expire_ts = NULL
                        WHERE status > 0
                          AND status NOT IN (CAST(:delivered_status AS INTEGER),
                                             CAST(:undelivered_status AS INTEGER))
                          AND expire_ts IS NOT NULL
                          AND expire_ts < :expire_ts
                        RETURNING ext_id, campaign_id, status
                    '''),
                    {
                        'created_status': schemas.CampaignDstStatus.CREATED,
                        'failed_status': schemas.CampaignDstStatus.FAILED,
                        'undelivered_status': schemas.CampaignDstStatus.UNDELIVERED,
                        'delivered_status': schemas.CampaignDstStatus.DELIVERED,
                        'expire_ts': ts
                    }
                )
                failed_counts = defaultdict(int)
                undelivered_counts = defaultdict(int)
                for ext_id, campaign_id, status in result.all():
                    if status == schemas.CampaignDstStatus.FAILED:
                        failed_counts[campaign_id] += 1
                    if status == schemas.CampaignDstStatus.UNDELIVERED:
                        undelivered_counts[campaign_id] += 1
                        if ext_id:
                            webhook.delay(data={
                                'id': ext_id, 'status': 'undelivered'
                            })

                if failed_counts:
                    case_statements = '\n'.join([
                        f'WHEN {campaign_id} THEN {count}'
                        for campaign_id, count in failed_counts.items()
                    ])
                    await session.execute(
                        text(f'''
                            UPDATE campaign
                            SET msg_failed = msg_failed + CASE id
                                {case_statements}
                                ELSE msg_failed
                            END
                            WHERE id IN ({','.join(map(str, failed_counts.keys()))})
                        ''')
                    )

                if undelivered_counts:
                    case_statements = '\n'.join([
                        f'WHEN {campaign_id} THEN {count}'
                        for campaign_id, count in
                        undelivered_counts.items()
                    ])
                    await session.execute(
                        text(f'''
                            UPDATE campaign
                            SET msg_undelivered = msg_undelivered + CASE id
                                {case_statements}
                                ELSE msg_undelivered
                            END,
                            status = CASE
                                WHEN msg_delivered + msg_undelivered + 1 >= msg_total
                                THEN {schemas.CampaignStatus.COMPLETE}
                                ELSE status
                            END
                            WHERE id IN ({','.join(map(str, undelivered_counts.keys()))})
                        ''')
                    )
            except Exception as e:
                await session.rollback()
                print(f"Ошибка при обновлении истекших сообщений: {e}")
                raise


async def update_complete_campaigns():
    async with async_session() as session:
        async with session.begin():
            try:
                await session.execute(
                    text('''
                        UPDATE campaign
                        SET status = CAST(:status_complete AS INTEGER)
                        WHERE msg_sent > 0
                          AND msg_delivered + msg_undelivered >= msg_total
                    '''),
                    {
                        'status_complete': schemas.CampaignStatus.COMPLETE
                    }
                )
            except Exception as e:
                await session.rollback()
                print(f"Ошибка при обновлении завершенных кампаний: {e}")
                raise


async def send_webhook(webhook_url: str = None, *, data: dict):
    if not webhook_url:
        async with async_session() as session:
            result = await session.execute(
                text('''
                    SELECT campaign.webhook_url
                    FROM campaign_dst
                    JOIN campaign ON campaign.id = campaign_dst.campaign_id
                    WHERE campaign_dst.ext_id = :ext_id
                '''),
                {
                    'ext_id': data.get(id)
                }
            )
            if not (row := result.fetchone()):
                return
            webhook_url = row._mapping.get('webhook_url')
        if not webhook_url:
            return

    async with aiohttp.ClientSession() as session:
        async with session.post(webhook_url, json=data) as resp:
            result = await resp.json()
            return result


@celery.task
def update_messages():
    loop = asyncio.get_event_loop()
    loop.run_until_complete(update_expired_messages())


@celery.task
def update_campaigns():
    loop = asyncio.get_event_loop()
    loop.run_until_complete(update_complete_campaigns())


@celery.task
def webhook(webhook_url: str = None, *, data: dict):
    loop = asyncio.get_event_loop()
    loop.run_until_complete(send_webhook(webhook_url, data=data))


celery.conf.beat_schedule = {
    'update_messages': {
        'task': 'tasks.update_messages',
        'schedule': timedelta(seconds=10),
    },
    'update_campaigns': {
        'task': 'tasks.update_campaigns',
        'schedule': timedelta(seconds=60),
    },
}
