import aiohttp
import asyncio
import logging
import re

from datetime import timedelta
from typing import List, Dict, Any

from celery import Celery
from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.session import async_session
from db.base_class import Base

from services.ai.factory import AIProviderFactory
from services.link import shorten
from services.phone_checker import PhoneChecker

import schemas
import models

celery = Celery(__name__)
celery.conf.broker_url = settings.CELERY_BROKER_URL
celery.conf.result_backend = settings.CELERY_RESULT_BACKEND
celery.conf.broker_connection_retry_on_startup = True
celery.conf.timezone = "UTC"
celery.conf.enable_utc = True

celery.conf.task_routes = {
    "tasks.webhook": {"queue": "critical"},
    "tasks.update_messages": {"queue": "normal"},
    "tasks.update_campaigns": {"queue": "normal"},
    "tasks.rewrite_message": {"queue": "background"},
    "tasks.prepare_messages": {"queue": "background"},
    "tasks.check_dst": {"queue": "background"},
    "tasks.check_dst_batch": {"queue": "background"},
}

celery.conf.task_default_queue = "normal"


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


@celery.task(name="tasks.update_messages")
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
                "status_complete": int(schemas.CampaignStatus.COMPLETE),
            }
            try:
                result = await session.execute(SQL_UPDATE_EXPIRED_MESSAGES, params)
                rows = result.mappings().all()

                # Отправляем вебхуки только для UNDELIVERED, если есть ext_id
                undelivered_code = int(schemas.CampaignDstStatus.UNDELIVERED)
                for r in rows:
                    if r["status"] == undelivered_code and r["ext_id"]:
                        webhook.delay(data={"id": r["ext_id"], "status": "expired"})

            except Exception as e:
                logging.exception("Ошибка при обновлении истекших сообщений: %s", e)
                raise


@celery.task(name="tasks.update_campaigns")
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
                    {"status_complete": int(schemas.CampaignStatus.COMPLETE)},
                )
            except Exception as e:
                logging.exception("Ошибка при обновлении завершенных кампаний: %s", e)
                raise


async def send_webhook(webhook_url: str = None, *, data: dict):
    """
    Отправка вебхука. Если URL не передан — находим по ext_id.
    """
    if not webhook_url:
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT campaign.webhook_url
                    FROM campaign_dst
                    JOIN campaign ON campaign.id = campaign_dst.campaign_id
                    WHERE campaign_dst.ext_id = :ext_id
                """),
                {"ext_id": data.get("id")},
            )
            row = result.fetchone()
            if not row:
                return
            webhook_url = row._mapping.get("webhook_url")
        if not webhook_url:
            return

    logging.info("Sending webhook to %s with payload: %s", webhook_url, data)
    try:
        async with aiohttp.ClientSession() as http:
            async with http.post(webhook_url, json=data) as resp:
                resp_text = await resp.text()
                logging.info(
                    "Received response from %s: %s %s",
                    webhook_url,
                    resp.status,
                    resp_text,
                )
    except Exception as e:
        logging.exception("Failed to send webhook to %s: %s", webhook_url, e)


@celery.task(name="tasks.webhook")
async def webhook(webhook_url: str = None, *, data: dict):
    await send_webhook(webhook_url, data=data)


async def rewrite(id: int, original_text: str, ai_provider, prompt: str):
    """
    Обработка одного рерайта в рамках батча.

    Args:
        id: ID записи campaign_dst
        original_text: Исходный текст для рерайта
        ai_provider: Экземпляр AI провайдера
        prompt: Системный промпт

    Returns:
        dict: Результат обработки одной записи
    """
    # Создаем отдельную сессию для каждой async задачи
    async with async_session() as session:
        try:
            # Проверяем существование записи
            result = await session.execute(
                text("SELECT id FROM campaign_dst WHERE id = :id"), {"id": id}
            )
            row = result.fetchone()

            if not row:
                logging.error(f"CampaignDst с ID {id} не найден")
                return {"success": False, "id": id, "error": "Record not found"}

            # Выполняем рерайт
            try:
                rewritten_text = await ai_provider.rewrite(
                    prompt=prompt, text=original_text
                )
            except Exception as e:
                error = f"{type(e).__name__}: {str(e)}"
                await session.execute(
                    text("""
                        UPDATE campaign_dst
                        SET status = 0,
                            error = :error,
                            update_ts = NOW()
                        WHERE id = :id
                    """),
                    {"error": error, "id": id},
                )
                # Коммитим изменения для текущей сессии
                await session.commit()

                logging.error(f"Ошибка AI рерайта для campaign_dst {id}: {error}")
                return {"success": False, "id": id, "error": error}

            # Сохраняем результат
            await session.execute(
                text("""
                    UPDATE campaign_dst
                    SET text = :text, status = 0, update_ts = NOW()
                    WHERE id = :id
                """),
                {"text": rewritten_text, "id": id},
            )
            # Коммитим изменения для текущей сессии
            await session.commit()

            logging.info(f"Успешно переписан текст для campaign_dst {id}")
            return {"success": True, "id": id}

        except Exception as e:
            logging.error(f"Ошибка AI рерайта для campaign_dst {id}: {e}")
            await session.rollback()
            return {"success": False, "id": id, "error": str(e)}


@celery.task(name="tasks.rewrite_message")
async def rewrite_message(
    data: list, config: dict, prompt: str = settings.AI_REWRITE_SYSTEM_PROMPT
):
    """
    Задача для AI-рерайта текста сообщений (поддерживает батчевую обработку).

    Args:
        data: Список словарей [{"id": int, "original_text": str}, ...]
        config: Конфигурация AI провайдера
        prompt: Системный промпт с инструкциями для AI
    """
    ai_provider = None
    try:
        # Создаем AI провайдер один раз для всего батча
        try:
            ai_provider = AIProviderFactory.create(
                provider=config.get("provider"), config=config
            )
        except Exception as e:
            logging.error(f"Ошибка создания AI провайдера: {e}")
            return

        # Создаем задачи для каждого элемента (asyncio.create_task)
        tasks = []
        for item in data:
            id = item.get("id")
            original_text = item.get("original_text", "")

            if not id:
                logging.warning(f"Отсутствует ID в элементе: {item}")
                continue

            if not original_text.strip():
                logging.warning(f"Пустой текст для campaign_dst {id}")
                continue

            task = rewrite(id, original_text, ai_provider, prompt)
            tasks.append(asyncio.create_task(task))

        if not tasks:
            logging.error("Нет валидных данных для обработки")
            return

        # Выполняем все задачи параллельно через asyncio.gather
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Подсчитываем статистику
        successful = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
        failed = len(results) - successful

        logging.info(
            f"Батч обработан: {successful} успешно, {failed} с ошибками, "
            f"провайдер: {config.get('provider')}"
        )

    except Exception as e:
        logging.exception(f"Ошибка при батчевом рерайте: {e}")
    finally:
        # Закрываем ресурсы AI провайдера
        if ai_provider:
            try:
                await ai_provider.close()
            except Exception as e:
                logging.warning(f"Ошибка при закрытии AI провайдера: {e}")


def create_batches(items: list, batch_size: int) -> list:
    """
    Разделяет список на батчи заданного размера.

    Args:
        items: Список элементов для разделения
        batch_size: Размер одного батча

    Returns:
        Список батчей (каждый батч - список элементов)
    """
    if batch_size <= 0:
        raise ValueError("Размер батча должен быть больше 0")

    return [items[i : i + batch_size] for i in range(0, len(items), batch_size)]


def extract_links_from_template(msg_template: str, dst_data: Dict) -> List[str]:
    """
    Extract links from msg_template that need to be shortened.

    Args:
        msg_template: Template with [short]...[/short] placeholders
        dst_data: Dictionary with field values (field_1, field_2, etc.)

    Returns:
        List of unique URLs to shorten
    """
    if not msg_template:
        return []

    pattern = r"\[short\](.+?)\[/short\]"
    matches = re.findall(pattern, msg_template)

    urls = []
    for match in matches:
        # Check if it's a field reference like {field_1}
        if match.startswith("{field_") and match.endswith("}"):
            field_name = match[1:-1]  # Remove { }
            field_value = dst_data.get(field_name, "")
            if field_value:
                urls.append(field_value)
        else:
            # Direct URL in template
            urls.append(match)

    # Return unique URLs preserving order
    seen = set()
    unique_urls = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)

    return unique_urls


@celery.task(name="tasks.prepare_messages")
async def prepare_messages(
    campaign_id: int, steps: List[str], x_api_key: str, rewrite_config: Dict = None
):
    """
    Prepare campaign messages by executing preprocessing steps:
    1. shorten_links - Extract and shorten URLs in msg_template
    2. rewrite - AI rewrite messages

    Args:
        campaign_id: Campaign ID
        steps: List of steps to execute (e.g., ["shorten_links", "rewrite"])
        x_api_key: User's API key for link shortening service
        rewrite_config: Configuration for AI rewrite (provider, model, api_key, prompt)
    """
    try:
        async with async_session() as session:
            # Get campaign and all campaign_dst records
            campaign = await session.get(models.Campaign, campaign_id)
            if not campaign:
                logging.error(f"Campaign {campaign_id} not found")
                return

            result = await session.execute(
                text("SELECT id, dst_addr, field_1, field_2, field_3, field_4, field_5, text FROM campaign_dst WHERE campaign_id = :campaign_id"),
                {"campaign_id": campaign_id},
            )
            # Convert RowMapping to dict for mutability
            campaign_dsts = [dict(row) for row in result.mappings().all()]

            if not campaign_dsts:
                logging.warning(
                    f"No campaign_dst records found for campaign {campaign_id}"
                )
                return

            msg_template = campaign.msg_template or ""

            # Step 1: Shorten links
            if "shorten_links" in steps:
                logging.info(f"Starting link shortening for campaign {campaign_id}")

                # Collect all unique URLs from all campaign_dst records
                all_urls = []
                for dst in campaign_dsts:
                    dst_data = {
                        "field_1": dst["field_1"],
                        "field_2": dst["field_2"],
                        "field_3": dst["field_3"],
                        "field_4": dst["field_4"],
                        "field_5": dst["field_5"],
                    }
                    urls = extract_links_from_template(msg_template, dst_data)
                    all_urls.extend(urls)

                # Remove duplicates
                unique_urls = list(dict.fromkeys(all_urls))

                if unique_urls:
                    # Call link shortening service and save to database
                    shorten_result = await shorten(
                        unique_urls, x_api_key, db=session, campaign_id=campaign_id
                    )

                    if shorten_result.get("results"):
                        # Create mapping original -> short
                        url_map = {}
                        for item in shorten_result["results"]:
                            url_map[item["original"]] = item["short"]

                        # Update text for each campaign_dst
                        for dst in campaign_dsts:
                            # Берём уже заполненный text с подставленными полями из campaigns.py
                            msg_text = dst["text"] or msg_template

                            # Replace [short]{field_n}[/short] with shortened URLs
                            for field_name in [
                                "field_1",
                                "field_2",
                                "field_3",
                                "field_4",
                                "field_5",
                            ]:
                                field_key = f"[short]{{{field_name}}}[/short]"
                                if field_key in msg_text and dst.get(field_name):
                                    original_url = dst.get(field_name)
                                    if original_url in url_map:
                                        msg_text = msg_text.replace(
                                            field_key, url_map[original_url]
                                        )

                            # Replace [short]https://...[/short] with shortened URLs
                            for original_url, short_url in url_map.items():
                                link_placeholder = f"[short]{original_url}[/short]"
                                if link_placeholder in msg_text:
                                    msg_text = msg_text.replace(link_placeholder, short_url)

                            # Update the record in DB
                            await session.execute(
                                text(
                                    "UPDATE campaign_dst SET text = :msg_text WHERE id = :id"
                                ),
                                {"msg_text": msg_text, "id": dst["id"]},
                            )

                            # Update in-memory data for next steps (e.g., rewrite)
                            dst["text"] = msg_text

                        await session.commit()
                        logging.info(
                            f"Link shortening completed for campaign {campaign_id}"
                        )
                    else:
                        logging.warning(
                            f"Link shortening returned no results for campaign {campaign_id}"
                        )
                else:
                    logging.info(f"No links found to shorten in campaign {campaign_id}")

            # Step 2: Rewrite messages
            if "rewrite" in steps and rewrite_config:
                logging.info(f"Starting message rewrite for campaign {campaign_id}")

                # Prepare batch data
                batch_data = []
                for dst in campaign_dsts:
                    batch_data.append(
                        {"id": dst["id"], "original_text": dst["text"] or msg_template}
                    )

                # Determine batch size
                provider = rewrite_config.get("provider", "").lower()
                if provider == "openrouter":
                    batch_size = settings.AI_OPENROUTER_BATCH_SIZE
                else:
                    batch_size = 1

                # Create batches
                batches = create_batches(batch_data, batch_size)

                # Process batches
                for batch in batches:
                    rewrite_message.delay(
                        data=batch,
                        config=rewrite_config,
                        prompt=rewrite_config.get(
                            "prompt", settings.AI_REWRITE_SYSTEM_PROMPT
                        ),
                    )

                logging.info(f"Rewrite tasks queued for campaign {campaign_id}")

            # If no rewrite step, update status to CREATED
            if "rewrite" not in steps:
                await session.execute(
                    text(
                        "UPDATE campaign_dst SET status = :status WHERE campaign_id = :campaign_id"
                    ),
                    {
                        "status": int(schemas.CampaignDstStatus.CREATED),
                        "campaign_id": campaign_id,
                    },
                )
                await session.commit()
                logging.info(f"Campaign {campaign_id} preparation completed")

    except Exception as e:
        logging.exception(f"Error in prepare_messages for campaign {campaign_id}: {e}")


@celery.task(name="tasks.check_dst")
async def check_dst(campaign_dst_id: int, phone_number: str):
    """
    Проверка одного номера телефона через PhoneChecker API.

    Args:
        campaign_dst_id: ID записи CampaignDst
        phone_number: Номер телефона для проверки

    Updates:
        campaign_dst.score - результат проверки:
            - 0.0-1.0: успешная проверка (fraud score)
            - -1.0: ошибка проверки или success=false от сервиса
    """
    logging.info(f"[check_dst] Начало проверки: dst_id={campaign_dst_id}, phone={phone_number}")

    try:
        async with async_session() as session:
            # Проверяем существование записи
            result = await session.execute(
                text("SELECT id, dst_addr FROM campaign_dst WHERE id = :id"),
                {"id": campaign_dst_id},
            )
            row = result.fetchone()

            if not row:
                logging.error(f"[check_dst] CampaignDst с ID {campaign_dst_id} не найден")
                return

            # Вызываем сервис проверки
            phone_checker = PhoneChecker()
            check_result = await phone_checker.check(phone_number=phone_number)

            # Определяем score на основе результата
            if check_result is None:
                # Сервис вернул None (HTTP-ошибка, timeout и т.д.)
                score = -1.0
                logging.warning(
                    f"[check_dst] API вернул None → score=-1 | "
                    f"phone={phone_number}, dst_id={campaign_dst_id}"
                )
            elif not check_result.get("success", False):
                # success: false - часть модулей не ответила
                score = -1.0
                logging.warning(
                    f"[check_dst] API вернул success=false → score=-1 | "
                    f"phone={phone_number}, dst_id={campaign_dst_id}"
                )
            else:
                # success: true - берём score из ответа
                score = check_result.get("score")
                if score is None:
                    # Ни один модуль не вернул результат
                    score = -1.0
                    logging.warning(
                        f"[check_dst] API вернул score=null → score=-1 | "
                        f"phone={phone_number}, dst_id={campaign_dst_id}"
                    )
                else:
                    # score = round(score, 2)
                    logging.info(
                        f"[check_dst] Проверка успешна → score={score} | "
                        f"phone={phone_number}, dst_id={campaign_dst_id}"
                    )

            # Сохраняем результат
            await session.execute(
                text("""
                    UPDATE campaign_dst
                    SET score = :score, update_ts = NOW()
                    WHERE id = :id
                """),
                {"score": score, "id": campaign_dst_id},
            )
            await session.commit()

            logging.info(
                f"[check_dst] Результат сохранён в БД | "
                f"phone={phone_number}, dst_id={campaign_dst_id}, score={score}"
            )

    except Exception as e:
        # При любой критической ошибке тоже ставим score=-1
        logging.exception(
            f"[check_dst] КРИТИЧЕСКАЯ ОШИБКА для phone={phone_number}, "
            f"dst_id={campaign_dst_id}: {e}"
        )
        try:
            async with async_session() as session:
                await session.execute(
                    text("""
                        UPDATE campaign_dst
                        SET score = :score, update_ts = NOW()
                        WHERE id = :id
                    """),
                    {"score": -1.0, "id": campaign_dst_id},
                )
                await session.commit()
                logging.info(
                    f"[check_dst] Установлен score=-1 после ошибки | dst_id={campaign_dst_id}"
                )
        except Exception as db_error:
            logging.error(
                f"[check_dst] Не удалось сохранить score=-1 для dst_id={campaign_dst_id}: "
                f"{db_error}"
            )


@celery.task(name="tasks.check_dst_batch")
async def check_dst_batch(campaign_id: int):
    """
    Запуск проверки всех номеров в кампании.

    Args:
        campaign_id: ID кампании

    Для каждого номера в кампании запускает задачу check_dst.
    """
    try:
        async with async_session() as session:
            # Получаем все номера из кампании
            result = await session.execute(
                text("""
                    SELECT id, dst_addr
                    FROM campaign_dst
                    WHERE campaign_id = :campaign_id
                """),
                {"campaign_id": campaign_id},
            )
            rows = result.fetchall()

            if not rows:
                logging.warning(
                    f"Нет номеров для проверки в кампании {campaign_id}"
                )
                return

            # Запускаем задачу проверки для каждого номера
            for row in rows:
                campaign_dst_id = row[0]
                phone_number = row[1]

                if phone_number:
                    check_dst.delay(campaign_dst_id, phone_number)

            logging.info(
                f"Запущена проверка {len(rows)} номеров для кампании {campaign_id}"
            )

    except Exception as e:
        logging.exception(
            f"Ошибка при запуске проверки номеров для кампании {campaign_id}: {e}"
        )


celery.conf.beat_schedule = {
    "update_messages": {
        "task": "tasks.update_messages",
        "schedule": timedelta(seconds=15),
    },
    "update_campaigns": {
        "task": "tasks.update_campaigns",
        "schedule": timedelta(seconds=60),
    },
}
