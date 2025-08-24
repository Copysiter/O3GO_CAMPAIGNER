import aiohttp
import logging

from datetime import timedelta

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


SQL_UPDATE_EXPIRED_MESSAGES = text("""
WITH updated AS (
  UPDATE campaign_dst d
  SET status = CASE
                 WHEN d.attempts > 0
                 THEN CAST(:failed_status AS INTEGER)
                 ELSE CAST(:undelivered_status AS INTEGER)
               END,
      expire_ts = NULL,
      update_ts = NOW()
  WHERE d.status IN (CAST(:created_status AS INTEGER), CAST(:sent_status AS INTEGER)) 
    AND d.expire_ts IS NOT NULL
    AND d.expire_ts < NOW()
  RETURNING d.ext_id, d.campaign_id, d.status
),
agg AS (
  SELECT campaign_id,
         COUNT(*) FILTER (WHERE status = CAST(:failed_status AS INTEGER))      AS add_failed,
         COUNT(*) FILTER (WHERE status = CAST(:undelivered_status AS INTEGER)) AS add_undelivered
  FROM updated
  GROUP BY campaign_id
),
apply AS (
  UPDATE campaign c
  SET msg_failed      = c.msg_failed + COALESCE(a.add_failed, 0),
      msg_undelivered = c.msg_undelivered + COALESCE(a.add_undelivered, 0),
      status = CASE
                 WHEN c.msg_delivered + c.msg_undelivered + COALESCE(a.add_undelivered, 0) >= c.msg_total
                 THEN CAST(:status_complete AS INTEGER)
                 ELSE c.status
               END
  FROM agg a
  WHERE c.id = a.campaign_id
  RETURNING c.id
)
SELECT * FROM updated;
""")

SQL_UPDATE_CAMPAIGNS_COMPLETE = text("""
UPDATE campaign
SET status = CAST(:status_complete AS INTEGER)
WHERE msg_sent > 0
  AND msg_delivered + msg_undelivered >= msg_total
RETURNING id;
""")


@celery.task(name='tasks.update_messages')
async def update_messages():
    """
    Каждые 15 сек:
      - переводим все протухшие сообщения в FAILED/UNDELIVERED
        (по attempts и прежнему статусу);
      - одним запросом считаем инкременты по кампаниям и обновляем campaign;
      - шлём вебхуки со статусом EXPIRED.
    """
    async with async_session() as session:
        async with session.begin():
            params = {
                "created_status": int(schemas.CampaignDstStatus.CREATED),
                "sent_status": int(schemas.CampaignDstStatus.SENT),
                "failed_status": int(schemas.CampaignDstStatus.FAILED),
                "undelivered_status": int(schemas.CampaignDstStatus.UNDELIVERED),
                "status_complete":     int(schemas.CampaignStatus.COMPLETE)
            }
            try:
                result = await session.execute(
                    SQL_UPDATE_EXPIRED_MESSAGES, params
                )
                rows = result.mappings().all()

                # Отправляем вебхуки только для UNDELIVERED, если есть ext_id
                undelivered_code = int(schemas.CampaignDstStatus.UNDELIVERED)
                for r in rows:
                    if r['status'] == undelivered_code and r['ext_id']:
                        webhook.delay(
                            data={'id': r['ext_id'], 'status': 'expired'}
                        )

            except Exception as e:
                logging.exception(
                    "Ошибка при обновлении истекших сообщений: %s",e
                )
                raise


@celery.task(name='tasks.update_campaigns')
async def update_campaigns():
    """
    Каждую минуту: подстраховочно закрываем кампании, в которых
    суммарно доставленных + недоставленных >= всего.
    """
    async with async_session() as session:
        async with session.begin():
            try:
                await session.execute(
                    SQL_UPDATE_CAMPAIGNS_COMPLETE,
                    {'status_complete': int(schemas.CampaignStatus.COMPLETE)}
                )
            except Exception as e:
                logging.exception(
                    "Ошибка при обновлении завершенных кампаний: %s",e
                )
                raise


async def send_webhook(webhook_url: str = None, *, data: dict):
    """
    Отправка вебхука. Если URL не передан — находим по ext_id.
    """
    if not webhook_url:
        async with async_session() as session:
            result = await session.execute(
                text('''
                    SELECT campaign.webhook_url
                    FROM campaign_dst
                    JOIN campaign ON campaign.id = campaign_dst.campaign_id
                    WHERE campaign_dst.ext_id = :ext_id
                '''),
                {'ext_id': data.get('id')}
            )
            row = result.fetchone()
            if not row:
                return
            webhook_url = row._mapping.get('webhook_url')
        if not webhook_url:
            return

    logging.info(
        'Sending webhook to %s with payload: %s',
        webhook_url, data
    )
    try:
        async with aiohttp.ClientSession() as http:
            async with http.post(webhook_url, json=data) as resp:
                resp_text = await resp.text()
                logging.info(
                    "Received response from %s: %s %s",
                    webhook_url, resp.status, resp_text
                )
    except Exception as e:
        logging.exception(
            "Failed to send webhook to %s: %s",
            webhook_url, e
        )


@celery.task(name='tasks.webhook')
async def webhook(webhook_url: str = None, *, data: dict):
    await send_webhook(webhook_url, data=data)


celery.conf.beat_schedule = {
    'update_messages': {
        'task': 'tasks.update_messages',
        'schedule': timedelta(seconds=15),
    },
    'update_campaigns': {
        'task': 'tasks.update_campaigns',
        'schedule': timedelta(seconds=60),
    }
}