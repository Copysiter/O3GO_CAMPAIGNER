import aiohttp
import asyncio
import logging
import re

from datetime import timedelta
from typing import List, Dict

from celery import Celery, group, chain
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
    # Critical queue (100 workers) - webhooks
    "tasks.webhook": {"queue": "critical"},

    # Normal queue (30 workers) - periodic maintenance
    "tasks.update_messages": {"queue": "normal"},
    "tasks.update_campaigns": {"queue": "normal"},

    # Background queue (20 workers) - coordination
    "tasks.prepare_campaign": {"queue": "background"},

    # Phone check queue (15 workers) - batch phone validation via webhook
    "tasks.check_dst_batch": {"queue": "phone_check"},

    # Link processing queue (20 workers) - link shortening
    "tasks.shorten_links": {"queue": "link_processing"},

    # AI rewrite queue (10 workers) - AI text rewriting
    "tasks.rewrite_batch": {"queue": "ai_rewrite"},
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
    Периодическая задача (каждые 15 секунд):
      - Переводит протухшие сообщения в FAILED/UNDELIVERED (по attempts и статусу)
      - Одним запросом считает инкременты по кампаниям и обновляет campaign
      - Отправляет вебхуки со статусом EXPIRED
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
    Периодическая задача (каждую минуту):
      - Подстраховочно закрывает кампании, где msg_delivered + msg_undelivered >= msg_total
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
    Отправка вебхука.

    Args:
        webhook_url: URL для отправки вебхука (если None, ищется по ext_id из data)
        data: Данные для отправки
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


def extract_links(msg_template: str, dst_data: Dict) -> List[str]:
    """
    Извлекает ссылки из шаблона сообщения для сокращения.

    Args:
        msg_template: Шаблон с плейсхолдерами [short]...[/short]
        dst_data: Словарь со значениями полей (field_1, field_2, и т.д.)

    Returns:
        Список уникальных URL для сокращения
    """
    if not msg_template:
        return []

    pattern = r"\[short\](.+?)\[/short\]"
    matches = re.findall(pattern, msg_template)

    urls = []
    for match in matches:
        # Проверяем, является ли это ссылкой на поле типа {field_1}
        if match.startswith("{field_") and match.endswith("}"):
            field_name = match[1:-1]  # Убираем { }
            field_value = dst_data.get(field_name, "")
            if field_value:
                urls.append(field_value)
        else:
            # Прямой URL в шаблоне
            urls.append(match)

    # Возвращаем уникальные URL с сохранением порядка
    seen = set()
    unique_urls = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)

    return unique_urls

# ============================================================================
# ЗАДАЧИ ПРЕДОБРАБОТКИ КАМПАНИЙ
# ============================================================================

@celery.task(name="tasks.prepare_campaign")
async def prepare_campaign(
    campaign_id: int,
    steps: List[str],
    x_api_key: str,
    rewrite_config: Dict = None
):
    """
    Главная задача предобработки кампании.
    Выстраивает цепочку задач: сокращение ссылок → AI-рерайт.

    Args:
        campaign_id: ID кампании
        steps: Список шагов для выполнения ("shorten_links" и/или "rewrite")
        x_api_key: API-ключ пользователя для внешних сервисов
        rewrite_config: Конфигурация AI-рерайта
    """
    try:
        # ШАГ 1: Быстрая загрузка данных и закрытие сессии
        campaign_dsts = []
        msg_template = ""

        async with async_session() as session:
            campaign = await session.get(models.Campaign, campaign_id)
            if not campaign:
                logging.error(f"Campaign {campaign_id} not found")
                return

            msg_template = campaign.msg_template or ""

            result = await session.execute(
                text("""
                    SELECT id, dst_addr, field_1, field_2, field_3, field_4, field_5, text
                    FROM campaign_dst
                    WHERE campaign_id = :campaign_id
                    ORDER BY id
                """),
                {"campaign_id": campaign_id}
            )
            campaign_dsts = [dict(row) for row in result.mappings().all()]

        if not campaign_dsts:
            logging.warning(
                f"Нет записей campaign_dst для кампании {campaign_id}"
            )
            return

        # ШАГ 2: Построение конвейера задач (без обращений к БД)
        # Сокращение ссылок и AI-рерайт
        has_shorten = "shorten_links" in steps
        has_rewrite = "rewrite" in steps and rewrite_config

        if has_shorten and has_rewrite:
            # Цепочка: сокращение ссылок → рерайт
            rewrite_batch_size = settings.REWRITE_BATCH_SIZE
            if rewrite_config.get("provider", "").lower() == "openrouter":
                rewrite_batch_size = settings.AI_OPENROUTER_BATCH_SIZE

            logging.info(
                f"Запуск цепочки: сокращение ссылок → AI-рерайт для кампании {campaign_id}"
            )

            workflow = chain(
                shorten_links.si(campaign_id, campaign_dsts, msg_template, x_api_key, True),  # waiting=True
                rewrite_messages.si(campaign_id, rewrite_batch_size, rewrite_config)
            )
            workflow.apply_async()

        elif has_shorten:
            # Только сокращение ссылок (финальный шаг)
            logging.info(f"Запуск сокращения ссылок для кампании {campaign_id}")
            shorten_links.si(campaign_id, campaign_dsts, msg_template, x_api_key, False).apply_async()  # waiting=False

        elif has_rewrite:
            # Только AI-рерайт (без сокращения ссылок)
            rewrite_batch_size = settings.REWRITE_BATCH_SIZE
            if rewrite_config.get("provider", "").lower() == "openrouter":
                rewrite_batch_size = settings.AI_OPENROUTER_BATCH_SIZE

            rewrite_batches = [
                campaign_dsts[i: i + rewrite_batch_size]
                for i in range(0, len(campaign_dsts), rewrite_batch_size)
            ]
            rewrite_tasks = []

            for batch in rewrite_batches:
                batch_data = [
                    {"id": dst["id"], "text": dst.get("text") or msg_template}
                    for dst in batch
                ]
                rewrite_tasks.append(rewrite_batch.si(batch_data, rewrite_config))

            if rewrite_tasks:
                logging.info(f"Запуск AI-рерайта: {len(rewrite_tasks)} батчей")
                job = group(*rewrite_tasks)
                job.apply_async()

        # ШАГ 3: Обновление статуса если нет обработки
        if not has_shorten and not has_rewrite:
            # Обработка не требуется - обновляем статус в новой сессии
            async with async_session() as session:
                await session.execute(
                    text("""
                        UPDATE campaign_dst
                        SET status = :status, update_ts = NOW()
                        WHERE campaign_id = :campaign_id AND status = :waiting_status
                    """),
                    {
                        "status": int(schemas.CampaignDstStatus.CREATED),
                        "campaign_id": campaign_id,
                        "waiting_status": int(schemas.CampaignDstStatus.WAITING)
                    }
                )
                await session.commit()
            logging.info(f"Предобработка кампании {campaign_id} завершена (обработка не требовалась)")

    except Exception as e:
        logging.exception(f"Ошибка в prepare_campaign для кампании {campaign_id}: {e}")


@celery.task(name="tasks.check_dst_batch")
async def check_dst_batch(batch_data: List[Dict]):
    """
    Отправка батча номеров телефонов на проверку через webhook API.
    Независимая задача, не влияет на статус campaign_dst.

    Args:
        batch_data: Список словарей [{"id": campaign_dst_id, "phone": phone_number}, ...]

    Returns:
        Словарь с информацией о созданной задаче проверки
    """
    logging.info(f"[check_dst_batch] Отправка {len(batch_data)} номеров на батч-проверку")

    try:
        # Извлекаем номера телефонов
        phone_numbers = [item["phone"] for item in batch_data if item.get("phone")]

        if not phone_numbers:
            logging.warning("[check_dst_batch] Нет валидных номеров для проверки")
            return {"submitted": 0, "job_id": None}

        # Формируем webhook URL для получения результатов
        callback_url = f"{settings.PHONE_CHECKER_WEBHOOK_BASE_URL}/ext/api/v1/hs/result"
        if settings.PHONE_CHECKER_WEBHOOK_TOKEN:
            callback_url += f"?token={settings.PHONE_CHECKER_WEBHOOK_TOKEN}"

        # Отправляем батч на проверку
        phone_checker = PhoneChecker()
        result = await phone_checker.check_batch_webhook(
            phone_numbers=phone_numbers,
            callback_url=callback_url,
            timeout=settings.PHONE_CHECKER_WEBHOOK_TIMEOUT,
            window_size=settings.PHONE_CHECKER_WEBHOOK_WINDOW_SIZE,
            chunk_size=settings.PHONE_CHECKER_WEBHOOK_CHUNK_SIZE
        )

        if result:
            logging.info(
                f"[check_dst_batch] Батч успешно отправлен на проверку: "
                f"job_id={result.get('job_id')}, total={result.get('total')}"
            )
            return {
                "submitted": result.get("total", 0),
                "job_id": result.get("job_id"),
                "checkers": result.get("checkers", [])
            }
        else:
            logging.error("[check_dst_batch] Не удалось отправить батч на проверку")
            return {"submitted": 0, "job_id": None}

    except Exception as e:
        logging.exception(f"[check_dst_batch] Ошибка при отправке батча: {e}")
        return {"submitted": 0, "job_id": None, "error": str(e)}


@celery.task(name="tasks.shorten_links")
async def shorten_links(
    campaign_id: int,
    campaign_dsts: List[Dict],
    msg_template: str,
    x_api_key: str,
    waiting: bool = False
):
    """
    Обработка и сокращение всех уникальных ссылок для кампании.

    Args:
        campaign_id: ID кампании
        campaign_dsts: Список записей campaign_dst (передается из prepare_campaign)
        msg_template: Шаблон сообщения
        x_api_key: API-ключ для сервиса сокращения ссылок
        waiting: Если True, оставить статус WAITING (есть следующий шаг обработки)

    Returns:
        Словарь с campaign_id для следующей задачи в цепочке
    """
    try:
        # ШАГ 1: Собираем URL (без обращений к БД)
        all_urls = []
        for dst in campaign_dsts:
            dst_data = {
                "field_1": dst.get("field_1"),
                "field_2": dst.get("field_2"),
                "field_3": dst.get("field_3"),
                "field_4": dst.get("field_4"),
                "field_5": dst.get("field_5"),
            }
            urls = extract_links(msg_template, dst_data)
            all_urls.extend(urls)

        unique_urls = list(dict.fromkeys(all_urls))

        if not unique_urls:
            logging.info(f"Нет ссылок для сокращения в кампании {campaign_id}")

            # Обновление статуса только если это финальный шаг
            if not waiting:
                async with async_session() as session:
                    await session.execute(
                        text("""
                            UPDATE campaign_dst
                            SET status = :status, update_ts = NOW()
                            WHERE campaign_id = :campaign_id AND status = :waiting_status
                        """),
                        {
                            "status": int(schemas.CampaignDstStatus.CREATED),
                            "campaign_id": campaign_id,
                            "waiting_status": int(schemas.CampaignDstStatus.WAITING)
                        }
                    )
                    await session.commit()
            return {"campaign_id": campaign_id, "shortened": 0}

        logging.info(f"Сокращение {len(unique_urls)} уникальных URL для кампании {campaign_id}")

        # ШАГ 2: Вызов сервиса сокращения и обновление БД
        async with async_session() as session:
            # Вызов API сокращения ссылок
            shorten_result = await shorten(
                unique_urls, x_api_key, db=session, campaign_id=campaign_id
            )

            if not shorten_result.get("results"):
                logging.warning(f"Сервис сокращения не вернул результатов для кампании {campaign_id}")
                return {"campaign_id": campaign_id, "shortened": 0}

            # Создаем маппинг оригинал → короткая ссылка
            url_map = {}
            for item in shorten_result["results"]:
                url_map[item["original"]] = item["short"]

            # Обновляем все записи с сокращенными ссылками
            for dst in campaign_dsts:
                dst_id = dst["id"]
                msg_text = dst.get("text") or msg_template

                # Подставляем значения полей
                for field_name in ["field_1", "field_2", "field_3", "field_4", "field_5"]:
                    if dst.get(field_name):
                        msg_text = msg_text.replace(f"{{{field_name}}}", dst[field_name])

                # Заменяем [short]{field_n}[/short]
                for field_name in ["field_1", "field_2", "field_3", "field_4", "field_5"]:
                    field_key = f"[short]{{{field_name}}}[/short]"
                    if field_key in msg_text and dst.get(field_name):
                        original_url = dst.get(field_name)
                        if original_url in url_map:
                            msg_text = msg_text.replace(field_key, url_map[original_url])

                # Заменяем [short]URL[/short]
                for original_url, short_url in url_map.items():
                    link_placeholder = f"[short]{original_url}[/short]"
                    if link_placeholder in msg_text:
                        msg_text = msg_text.replace(link_placeholder, short_url)

                # Обновляем запись
                # Если waiting=True, оставляем статус WAITING для следующего шага
                if waiting:
                    await session.execute(
                        text("""
                            UPDATE campaign_dst
                            SET text = :msg_text,
                                update_ts = NOW()
                            WHERE id = :id
                        """),
                        {
                            "msg_text": msg_text,
                            "id": dst_id
                        }
                    )
                else:
                    await session.execute(
                        text("""
                            UPDATE campaign_dst
                            SET text = :msg_text,
                                status = CASE
                                    WHEN status = :waiting_status THEN :created_status
                                    ELSE status
                                END,
                                update_ts = NOW()
                            WHERE id = :id
                        """),
                        {
                            "msg_text": msg_text,
                            "id": dst_id,
                            "waiting_status": int(schemas.CampaignDstStatus.WAITING),
                            "created_status": int(schemas.CampaignDstStatus.CREATED)
                        }
                    )

            await session.commit()

        logging.info(f"Сокращение ссылок завершено для кампании {campaign_id}: {len(url_map)} ссылок")
        return {"campaign_id": campaign_id, "shortened": len(url_map)}

    except Exception as e:
        logging.exception(f"Ошибка в shorten_links для кампании {campaign_id}: {e}")
        return {"campaign_id": campaign_id, "shortened": 0, "error": str(e)}


@celery.task(name="tasks.rewrite_messages")
async def rewrite_messages(
    campaign_id: int,
    batch_size: int,
    rewrite_config: Dict
):
    """
    Подготовка и запуск задач рерайта после сокращения ссылок.
    Загружает обновленные тексты и создает батчи для рерайта.

    Args:
        campaign_id: ID кампании
        batch_size: Размер батча для рерайта
        rewrite_config: Конфигурация AI-провайдера
    """
    try:
        # Быстрая загрузка обновленных текстов
        campaign_dsts = []
        async with async_session() as session:
            result = await session.execute(
                text("""
                    SELECT id, text
                    FROM campaign_dst
                    WHERE campaign_id = :campaign_id
                    ORDER BY id
                """),
                {"campaign_id": campaign_id}
            )
            campaign_dsts = [dict(row) for row in result.mappings().all()]
        # СЕССИЯ ЗАКРЫТА

        if not campaign_dsts:
            logging.warning(f"Нет записей campaign_dst для рерайта в кампании {campaign_id}")
            return {"batches_launched": 0}

        # Создаем и запускаем батчи рерайта (без обращений к БД)
        batches = [
            campaign_dsts[i: i + batch_size]
            for i in range(0, len(campaign_dsts), batch_size)
        ]
        rewrite_tasks = []

        for batch in batches:
            batch_data = [
                {"id": dst["id"], "text": dst["text"]}
                for dst in batch if dst.get("text")
            ]
            if batch_data:
                rewrite_tasks.append(rewrite_batch.si(batch_data, rewrite_config))

        if rewrite_tasks:
            logging.info(f"Запуск AI-рерайта после сокращения: {len(rewrite_tasks)} батчей")
            job = group(*rewrite_tasks)
            job.apply_async()
            return {"batches_launched": len(rewrite_tasks)}

        return {"batches_launched": 0}

    except Exception as e:
        logging.exception(f"Ошибка в rewrite_messages: {e}")
        return {"batches_launched": 0, "error": str(e)}


@celery.task(name="tasks.rewrite_batch")
async def rewrite_batch(batch_data: List[Dict], config: Dict):
    """
    Обработка AI-рерайта для батча сообщений параллельно.
    Каждый рерайт получает свою сессию БД для обновления.

    Args:
        batch_data: Список словарей [{"id": int, "text": str}, ...]
        config: Конфигурация AI-провайдера

    Returns:
        Словарь со статистикой выполнения
    """
    ai_provider = None
    try:
        # Создаем AI-провайдера (без обращений к БД)
        ai_provider = AIProviderFactory.create(
            provider=config.get("provider"), config=config
        )

        prompt = config.get("prompt", settings.AI_REWRITE_SYSTEM_PROMPT)

        async def rewrite_single(item: Dict):
            """Рерайт одного сообщения"""
            dst_id = item["id"]
            original_text = item.get("text", "")

            if not original_text or not original_text.strip():
                logging.warning(f"[rewrite_batch] dst_id={dst_id}: Пустой текст для рерайта")
                return {"success": False, "id": dst_id, "error": "Empty text"}

            try:
                # logging.info(
                #     f"[rewrite_batch] dst_id={dst_id}: Отправка на рерайт. "
                #     f"Оригинальный текст: {original_text}..."
                # )

                rewritten_text = await ai_provider.rewrite(
                    prompt=prompt, text=original_text
                )

                # logging.info(
                #     f"[rewrite_batch] dst_id={dst_id}: Получен результат рерайта. "
                #     f"Результат: {rewritten_text if rewritten_text else 'None'}..."
                # )

                # Проверка на пустой результат
                if not rewritten_text or not rewritten_text.strip():
                    logging.error(
                        f"[rewrite_batch] dst_id={dst_id}: AI вернул пустой результат. "
                        f"Оригинальный текст сохранён."
                    )
                    return {"success": False, "id": dst_id, "error": "Empty rewrite result"}

                # Быстрое обновление БД в новой сессии
                async with async_session() as session:
                    await session.execute(
                        text("""
                            UPDATE campaign_dst
                            SET text = :text,
                                status = :status,
                                update_ts = NOW()
                            WHERE id = :id
                        """),
                        {
                            "text": rewritten_text,
                            "status": int(schemas.CampaignDstStatus.CREATED),
                            "id": dst_id
                        }
                    )
                    await session.commit()

                logging.info(
                    f"[rewrite_batch] dst_id={dst_id}: Текст успешно обновлён в БД"
                )
                return {"success": True, "id": dst_id}

            except Exception as e:
                error_msg = f"{type(e).__name__}: {str(e)}"

                # Только логирование ошибки, НЕ пишем в БД
                logging.exception(
                    f"[rewrite_batch] dst_id={dst_id}: Ошибка при рерайте. "
                    f"Текст НЕ изменён. Ошибка: {error_msg}"
                )

                return {"success": False, "id": dst_id, "error": error_msg}

        # Выполняем все рерайты параллельно
        tasks = [rewrite_single(item) for item in batch_data]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        successful = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
        failed = len(results) - successful

        logging.info(
            f"Батч рерайта завершен: {successful} успешно, {failed} с ошибками, "
            f"провайдер: {config.get('provider')}"
        )

        return {"successful": successful, "failed": failed, "total": len(batch_data)}

    except Exception as e:
        logging.exception(f"Ошибка в rewrite_batch: {e}")
        return {"successful": 0, "failed": len(batch_data), "total": len(batch_data)}

    finally:
        if ai_provider:
            try:
                await ai_provider.close()
            except Exception as e:
                logging.warning(f"Ошибка при закрытии AI-провайдера: {e}")


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
