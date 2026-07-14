"""HTTP-клиент для внешнего API Android устройств."""
import httpx
import logging
from typing import List

from core.config import settings


class AndroidService:
    """Сервис для взаимодействия с внешним API Android устройств."""

    def __init__(self):
        self.base_url = settings.ANDROID_API_URL
        self.timeout = settings.ANDROID_API_TIMEOUT

    async def get_device_options(self, x_api_key: str) -> List[dict]:
        """
        Получение списков Android девайсов.

        Args:
            x_api_key: API ключ для аутентификации

        Returns:
            List[OptionStr] - список девайсов для выпадающего списка
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/ext/api/v1/androids",
                    headers={"X-Api-Key": x_api_key}
                )
                response.raise_for_status()
                data = response.json()

                return data

            except Exception as e:
                logging.exception(
                    f"Unexpected error external Android API "
                    f"(get_device_options): {e}"
                )
                return []
