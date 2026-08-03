# Re-export PromptBuilder from ai.prompt_builder for services namespace compatibility
from ai.prompt_builder import PromptBuilder, prompt_builder

__all__ = ["PromptBuilder", "prompt_builder"]
