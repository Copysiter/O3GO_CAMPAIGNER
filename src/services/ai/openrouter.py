"""OpenRouter AI provider for cloud text generation."""

import logging
import httpx

from core.config import settings

from .base import AIProvider, AIProviderError


logger = logging.getLogger(__name__)


class OpenRouterProvider(AIProvider):
    """OpenRouter provider for cloud AI text generation."""

    def __init__(self, api_key: str, model: str):
        """Initialize OpenRouter provider.

        Args:
            api_key: OpenRouter API key
            model: Model name
        """
        super().__init__(model if model else "openai/gpt-4o-mini")
        self.api_key = api_key
        self.url = settings.AI_OPENROUTER_URL
        self.timeout = settings.AI_OPENROUTER_TIMEOUT
        self.max_tokens = settings.AI_OPENROUTER_MAX_TOKENS
        self.temperature = settings.AI_OPENROUTER_TEMPERATURE
        self.top_p = settings.AI_OPENROUTER_TOP_P
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with headers."""
        if self._client is None or self._client.is_closed:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "X-Title": settings.AI_OPENROUTER_TITLE
            }
            # Устанавливаем max_connections равным размеру батча из настроек
            # чтобы избежать "All connection attempts failed"
            batch_size = settings.AI_OPENROUTER_BATCH_SIZE
            self._client = httpx.AsyncClient(
                headers=headers, timeout=self.timeout, limits=httpx.Limits(
                    max_keepalive_connections=batch_size,
                    max_connections=batch_size * 2  # x2 для запаса
                )
            )
        return self._client

    async def close(self):
        """Close HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def rewrite(self, prompt: str, text: str) -> str:
        """Rewrite text using OpenRouter API.

        Args:
            prompt: System prompt for rewriting instructions
            text: Original text to rewrite

        Returns:
            Rewritten text

        Raises:
            AIProviderError: If rewriting fails
        """
        if not text.strip():
            raise AIProviderError(
                "Original text cannot be empty",
                "OpenRouter", self.model
            )

        if not self.api_key:
            raise AIProviderError(
                "API key not configured",
                "OpenRouter", self.model
            )

        client = await self._get_client()

        # Базовый payload с унифицированной структурой
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": text},
            ],
            "stream": False,
            "think": False,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "top_p": settings.AI_OPENROUTER_TOP_P
        }

        try:
            logger.debug(
                f"Sending request to OpenRouter: {self.model}"
            )
            response = await client.post(self.url, json=payload)

            if response.status_code != 200:
                error_info = self._parse_error_response(
                    response.text, response.status_code
                )
                raise AIProviderError(
                    error_info,
                    "OpenRouter", self.model
                )

            result = response.json()

            if "choices" not in result or not result["choices"]:
                raise AIProviderError(
                    f"Invalid response format: {result}",
                    "OpenRouter", self.model
                )

            rewritten_text = None
            choice = result["choices"][0]
            if choice and "message" in choice \
                    and "content" in choice["message"]:
                content = choice["message"]["content"]
                rewritten_text = content.strip() if content else None

            if not rewritten_text:
                raise AIProviderError(
                    "Empty response from model",
                    "OpenRouter",
                    self.model
                )

            # Log usage if available
            if "usage" in result:
                usage = result["usage"]
                logger.info(
                    f"OpenRouter {self.model}: tokens used "
                    f"{usage.get('total_tokens', 'unknown')}"
                )

            logger.info(
                f"Successfully rewritten text using OpenRouter {self.model}"
            )
            return rewritten_text

        except httpx.HTTPError as e:
            raise AIProviderError(
                f"Network error: {str(e)}",
                "OpenRouter", self.model
            )
        except Exception as e:
            if isinstance(e, AIProviderError):
                raise
            raise AIProviderError(
                f"Unexpected error: {str(e)}",
                "OpenRouter", self.model
            )

    def _parse_error_response(self, response_text: str, status_code: int) -> str:
        """Parse error response from OpenRouter."""
        try:
            import json
            error_data = json.loads(response_text)
            if "error" in error_data:
                error = error_data["error"]
                if isinstance(error, dict):
                    message = error.get("message", str(error))
                    error_type = error.get("type", "unknown")
                    return f"HTTP {status_code} ({error_type}): {message}"
                else:
                    return f"HTTP {status_code}: {error}"
        except (json.JSONDecodeError, KeyError):
            pass

        return f"HTTP {status_code}: {response_text}"
