"""Factory for creating AI providers."""

import logging

from typing import Any, Dict, Type

from .base import AIProvider, AIProviderError
from .ollama import OllamaProvider
from .openrouter import OpenRouterProvider


logger = logging.getLogger(__name__)


class AIProviderFactory:
    """Factory class for creating AI provider instances."""

    # Регистр доступных провайдеров
    _providers: Dict[str, Type[AIProvider]] = {
        'ollama': OllamaProvider,
        'openrouter': OpenRouterProvider
    }

    # Обязательные поля для каждого провайдера
    _required_fields: Dict[str, list] = {
        'ollama': ['api_key'],  #, 'model'],
        'openrouter': ['api_key'],  #, 'model']
    }

    @classmethod
    def create(cls, provider: str, config: Dict[str, Any]) -> AIProvider:
        """Create AI provider instance.

        Args:
            provider: Provider name ('ollama' or 'openrouter')
            config: Configuration dictionary with provider-specific parameters

        Returns:
            AI provider instance

        Raises:
            AIProviderError: If provider is unknown or configuration is invalid
        """
        provider = provider.lower().strip()

        # Проверяем, что провайдер зарегистрирован
        if provider not in cls._providers:
            supported = list(cls._providers.keys())
            raise AIProviderError(
                f"Unknown provider: {provider}. Supported: {supported}",
                "Factory", None
            )

        # Валидируем конфигурацию
        cls._validate_config(provider, config)

        # Создаем экземпляр провайдера
        provider_class = cls._providers[provider]

        try:
            return provider_class(
                api_key=config['api_key'],
                model=config['model']
            )
        except Exception as e:
            raise AIProviderError(
                f"Failed to create {provider} provider: {str(e)}",
                "Factory", None
            )

    @classmethod
    def _validate_config(cls, provider: str, config: Dict[str, Any]) -> None:
        """Validate provider configuration."""
        if not isinstance(config, dict):
            raise AIProviderError(
                "Configuration must be a dictionary",
                "Factory", None
            )

        # Проверяем обязательные поля
        required = cls._required_fields.get(provider, [])
        missing = [
            field for field in required
            if field not in config or not config[field]
        ]

        if missing:
            raise AIProviderError(
                f"Missing required fields for {provider}: {missing}",
                "Factory", None
            )

