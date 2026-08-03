# Re-export AIService from ai.ai_service for services namespace compatibility
from ai.ai_service import AIService, ai_service

__all__ = ["AIService", "ai_service"]
