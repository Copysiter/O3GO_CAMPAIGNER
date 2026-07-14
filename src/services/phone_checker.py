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

    async def check_batch_webhook(
        self,
        phone_numbers: List[str],
        callback_url: str,
        timeout: Optional[int] = None,
        window_size: Optional[int] = None,
        chunk_size: Optional[int] = None
    ) -> Optional[Dict]:
        """
        Массовая проверка номеров через Batch API с webhook callback.

        Args:
            phone_numbers: Список номеров телефонов (max 600,000)
            callback_url: URL для отправки результатов
            timeout: Тайм-аут на один номер (default from settings)
            window_size: Размер окна обработки (default from settings)
            chunk_size: Размер батча для отправки результатов (default from settings)

        Returns:
            Dict с информацией о задании:
            {
                "job_id": str,
                "total": int,
                "checkers": List[str]
            }
            Или None в случае ошибки
        """
        if not phone_numbers:
            logging.warning("[PhoneChecker] Empty phone list provided")
            return None

        if len(phone_numbers) > 600000:
            logging.error(f"[PhoneChecker] Too many phones: {len(phone_numbers)} (max 600,000)")
            return None

        # Use defaults from settings
        timeout = timeout or settings.PHONE_CHECK_WEBHOOK_TIMEOUT
        window_size = window_size or settings.PHONE_CHECK_WEBHOOK_WINDOW_SIZE
        chunk_size = chunk_size or settings.PHONE_CHECK_WEBHOOK_CHUNK_SIZE

        logging.info(
            f"[PhoneChecker] Starting batch check for {len(phone_numbers)} numbers, "
            f"callback: {callback_url}, window_size: {window_size}"
        )

        async with httpx.AsyncClient(timeout=30) as client:  # Short timeout for submission
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/check/webhook",
                    json={
                        "phones": phone_numbers,
                        "callback_url": callback_url,
                        "timeout": timeout,
                        "window_size": window_size,
                        "chunk_size": chunk_size
                    },
                    headers={"X-API-Key": self.api_key} if self.api_key else {},
                )
                response.raise_for_status()
                data = response.json()

                logging.info(
                    f"[PhoneChecker] Batch job created: job_id={data.get('job_id')}, "
                    f"total={data.get('total')}, checkers={data.get('checkers')}"
                )

                return data

            except httpx.HTTPStatusError as e:
                logging.error(
                    f"[PhoneChecker] HTTP {e.response.status_code}: {e.response.text}"
                )
                return None
            except Exception as e:
                logging.exception(f"[PhoneChecker] Error creating batch job: {e}")
                return None
