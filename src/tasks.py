import asyncio
import aiohttp

from datetime import datetime, timedelta
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
                now = datetime.utcnow()
                await session.execute(
                    statement=text(f'''
                        UPDATE campaign_dst
                        SET status = {schemas.CampaignDstStatus.UNDELIVERED}
                        WHERE status <> {schemas.CampaignDstStatus.DELIVERED}
                        AND expire_ts IS NOT NULL
                        AND expire_ts < '{now}'
                    ''')
                )
            except Exception as e:
                await session.rollback()
                print(f"Ошибка при обновлении истекших сообщений: {e}")
                raise


async def update_sent_messages():
    async with async_session() as session:
        async with session.begin():
            try:
                now = datetime.utcnow() - timedelta(seconds=settings.WAIT_STATUS_TIMEOUT)
                await session.execute(
                    statement=text(f'''
                        UPDATE campaign_dst
                        SET status = {schemas.CampaignDstStatus.FAILED}
                        WHERE status = {schemas.CampaignDstStatus.SENT}
                        AND sent_ts IS NOT NULL
                        AND sent_ts < '{now}'
                    ''')
                )
            except Exception as e:
                await session.rollback()
                print(f"Ошибка при обновлении отправленных сообщений: {e}")
                raise


async def update_complete_campaigns():
    async with async_session() as session:
        async with session.begin():
            try:
                await session.execute(
                    statement=text(f'''
                        UPDATE campaign
                        SET status = {schemas.CampaignStatus.COMPLETE}
                        WHERE msg_delivered + msg_undelivered >= msg_total
                    ''')
                )
            except Exception as e:
                await session.rollback()
                print(f"Ошибка при обновлении завершенных кампаний: {e}")
                raise


async def send_webhook(webhook_url, data):
    async with aiohttp.ClientSession() as session:
        async with session.post(webhook_url, data=data) as resp:
            return await resp.json()


@celery.task
def update_messages():
    loop = asyncio.get_event_loop()
    loop.run_until_complete(update_expired_messages())
    loop.run_until_complete(update_sent_messages())


@celery.task
def update_campaigns():
    loop = asyncio.get_event_loop()
    loop.run_until_complete(update_complete_campaigns())


@celery.task
def webhook(webhook_url, data):
    loop = asyncio.get_event_loop()
    loop.run_until_complete(send_webhook(webhook_url, data))


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
