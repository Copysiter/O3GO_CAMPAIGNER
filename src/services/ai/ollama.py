"""Ollama AI provider for local text generation."""

import logging
import httpx

from core.config import settings

from .base import AIProvider, AIProviderError


logger = logging.getLogger(__name__)


class OllamaProvider(AIProvider):
    """Ollama provider for local AI text generation."""

    def __init__(self, api_key: str, model: str):
        """Initialize Ollama provider.

        Args:
            api_key: Ollama API key
            model: Model name
        """
        super().__init__(model if model else "deepseek-r1:8b")
        self.api_key = api_key
        self.url = settings.AI_OLLAMA_URL
        self.timeout = settings.AI_OLLAMA_TIMEOUT
        self.max_tokens = settings.AI_OLLAMA_MAX_TOKENS
        self.temperature = settings.AI_OLLAMA_TEMPERATURE
        self.top_p = settings.AI_OLLAMA_TOP_P
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            # Устанавливаем max_connections равным размеру батча из настроек
            # чтобы избежать "All connection attempts failed"
            batch_size = settings.REWRITE_BATCH_SIZE
            self._client = httpx.AsyncClient(
                timeout=settings.AI_OLLAMA_TIMEOUT,
                limits=httpx.Limits(
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
        """Rewrite text using Ollama API.

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
                "Ollama", self.model
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
            "options": {
                "num_predict": self.max_tokens,
                "temperature": self.temperature,
                "top_p": self.top_p
            }
        }

        try:
            logger.debug(f"Sending request to Ollama: {self.url}")
            response = await client.post(
                f"{self.url}?x_api_key={self.api_key}", json=payload
            )

            if response.status_code != 200:
                raise AIProviderError(
                    f"HTTP {response.status_code}: {response.text}",
                    "Ollama", self.model
                )

            result = response.json()

            rewritten_text = None
            if result and "message" in result \
                    and "content" in result["message"]:
                content = result["message"]["content"]
                rewritten_text = content.strip() if content else None

            if not rewritten_text:
                raise AIProviderError(
                    "Empty response from model",
                    "Ollama",
                    self.model
                )

            logger.info(
                f"Successfully rewritten text using Ollama {self.model}"
            )
            return rewritten_text

        except httpx.HTTPError as e:
            raise AIProviderError(
                f"Network error: {str(e)}",
                "Ollama", self.model
            )
        except Exception as e:
            if isinstance(e, AIProviderError):
                raise
            raise AIProviderError(
                f"Unexpected error: {str(e)}",
                "Ollama", self.model
            )
