"""HTTP-клиент для сервиса проверки номеров телефонов (HS Checker)."""
import httpx
import logging
from typing import Optional, Dict, List

from core.config import settings


class PhoneChecker:
    """Сервис для проверки номеров телефонов через HS Checker API."""

    def __init__(self):
        self.base_url = settings.PHONE_CHECKER_URL
        self.api_key = settings.PHONE_CHECKER_API_KEY
        self.timeout = settings.PHONE_CHECKER_TIMEOUT

    async def check(
        self, phone_number: str, full: bool = False
    ) -> Optional[Dict]:
        """
        Синхронная проверка одного номера через Realtime API.

        Args:
            phone_number: Номер телефона в международном формате (например, +79001234567)
            full: Если True, возвращает детальную информацию (details, timings)

        Returns:
            Dict с результатом проверки:
            {
                "success": bool,
                "score": float | None,  # 0.0-1.0
                "details": dict | None,  # если full=True
                "timings": dict | None   # если full=True
            }
            Или None в случае ошибки
        """
        logging.info(f"[PhoneChecker] Проверка номера {phone_number} (timeout={self.timeout}s)")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/check/realtime",
                    json={
                        "phone_number": phone_number,
                        "timeout": self.timeout,
                        "full": full,
                    },
                    headers={"X-API-Key": self.api_key},
                )
                response.raise_for_status()
                data = response.json()

                # Детальное логирование ответа
                logging.info(
                    f"[PhoneChecker] {phone_number} → "
                    f"success={data.get('success')}, score={data.get('score')}"
                )

                return data

            except httpx.HTTPStatusError as e:
                logging.error(
                    f"[PhoneChecker] HTTP {e.response.status_code} для {phone_number}: "
                    f"{e.response.text}"
                )
                return None
            except httpx.TimeoutException:
                logging.error(
                    f"[PhoneChecker] Timeout для {phone_number} (>{self.timeout}s)"
                )
                return None
            except Exception as e:
                logging.exception(
                    f"[PhoneChecker] Неожиданная ошибка для {phone_number}: {e}"
                )
                return None

    async def check_batch(
        self, phone_numbers: List[str], timeout: Optional[int] = None
    ) -> Optional[str]:
        """
        Массовая проверка номеров через Batch API.

        TODO: Реализовать после согласования с поставщиком сервиса:
        - Webhook для получения результатов
        - Или опрос статуса задания

        Args:
            phone_numbers: Список номеров телефонов
            timeout: Тайм-аут на один номер (по умолчанию из настроек)

        Returns:
            job_id строка для отслеживания статуса задания
            Или None в случае ошибки
        """
        # TODO: Implement batch checking
        pass
