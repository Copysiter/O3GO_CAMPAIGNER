"""
Webhook-эндпоинт HS Phone Checker для получения результатов пакетной проверки.
"""
import logging
from typing import Dict, List, Any
from fastapi import APIRouter, Query, HTTPException, BackgroundTasks
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.session import async_session
import schemas

router = APIRouter()


async def process_check_results(results: List[Dict]):
    """
    Обработка результатов проверки телефонов и обновление базы данных.
    Сопоставление по номеру телефона с campaign_dst.dst_addr.
    """
    try:
        async with async_session() as session:
            for result in results:
                phone = result.get("phone", "")
                score = result.get("score")
                success = result.get("success", False)

                # Нормализация телефона (удаление ведущего +)
                if phone.startswith("+"):
                    phone = phone[1:]

                # Определение итогового score
                if not success or score is None:
                    final_score = -1.0
                else:
                    final_score = float(score)

                # Обновление всех записей campaign_dst с этим номером телефона
                # Несколько кампаний могут иметь один и тот же телефон
                await session.execute(
                    text("""
                        UPDATE campaign_dst
                        SET score = :score,
                            update_ts = NOW()
                        WHERE dst_addr = :phone
                          AND (score IS NULL OR score = -1.0)
                    """),
                    {"score": final_score, "phone": phone}
                )

                logging.debug(
                    f"[HS Webhook] Обновлен телефон {phone} со score {final_score}"
                )

            await session.commit()

            logging.info(
                f"[HS Webhook] Успешно обработано {len(results)} результатов"
            )

    except Exception as e:
        logging.exception(f"[HS Webhook] Ошибка обработки результатов: {e}")


@router.post("/result")
async def receive_check_results(
    data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    token: str = Query(..., description="Токен безопасности")
):
    """
    Получение результатов проверки телефонов от сервиса HS.

    Ожидаемый payload:
    {
        "job_id": "a1b2c3d4e5f6...",
        "status": "progress" | "completed",
        "results": [
            {
                "phone": "79001234567",
                "score": 0.333,
                "success": true,
                "details": {"FB": -1, "WA": -1}
            }
        ]
    }
    """
    # Логирование входящих данных
    logging.info(f"[HS Webhook] Получен payload: {data}")

    # Проверка токена
    if not settings.PHONE_CHECKER_WEBHOOK_TOKEN or token != settings.PHONE_CHECKER_WEBHOOK_TOKEN:
        logging.warning(f"[HS Webhook] Получен невалидный токен: {token}")
        raise HTTPException(status_code=403, detail="Invalid token")

    job_id = data.get("job_id")
    status = data.get("status")
    results = data.get("results", [])

    logging.info(
        f"[HS Webhook] Получен {status} callback для задачи {job_id}: "
        f"{len(results)} результатов"
    )

    # Обработка результатов в фоне для быстрого возврата 200
    if results:
        background_tasks.add_task(process_check_results, results)

    if status == "completed":
        logging.info(f"[HS Webhook] Задача {job_id} завершена")

    return {"status": "ok", "processed": len(results)}
