# Re-export ContextBuilder from ai.context_builder for services namespace compatibility
from ai.context_builder import ContextBuilder, context_builder

__all__ = ["ContextBuilder", "context_builder"]
