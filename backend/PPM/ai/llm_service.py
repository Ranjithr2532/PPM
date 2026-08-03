from ollama import Client

class LLMService:
    def __init__(self):
        self.client = Client(host="http://localhost:11434")
        self.model = "qwen2.5:7b"

    def ask(self, prompt: str):
        response = self.client.chat(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        return response["message"]["content"]


llm_service = LLMService()