"""Base class for AI providers."""

from abc import ABC, abstractmethod
from typing import Optional


class AIProvider(ABC):
    """Abstract base class for AI text rewriting providers."""
    
    def __init__(self, model: str) -> None:
        """Initialize AI provider.
        
        Args:
            model: Model name to use for text generation
        """
        self.model = model
    
    @abstractmethod
    async def rewrite(self, prompt: str, text: str) -> str:
        """Rewrite text using AI model.
        
        Args:
            prompt: System prompt for rewriting instructions
            text: Original text to rewrite
            
        Returns:
            Rewritten text
            
        Raises:
            AIProviderError: If rewriting fails
        """
        pass
    
    @abstractmethod
    async def close(self):
        """Close any resources (HTTP connections, etc.)."""
        pass


class AIProviderError(Exception):
    """Exception raised by AI providers."""
    
    def __init__(
        self, message: str, provider: str, model: Optional[str] = None
    ) -> None:
        self.message = message
        self.provider = provider
        self.model = model
        super().__init__(f"{provider} ({model}): {message}")
