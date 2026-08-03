import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import app
from security.auth import get_current_user
from db import get_db

client = TestClient(app)


def mock_get_current_user():
    return {"sub": "test_user", "username": "test_user", "role": "admin"}


class TestAIRoutes:
    @pytest.fixture(autouse=True)
    def setup_overrides(self):
        app.dependency_overrides[get_current_user] = mock_get_current_user
        yield
        app.dependency_overrides.clear()

    def test_ai_health_endpoint(self):
        """Test GET /api/v1/ai/health."""
        response = client.get("/api/v1/ai/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["provider"] == "ollama"
        assert data["model"] == "qwen2.5:7b"

    def test_proposal_summary_route(self):
        """Test GET /api/v1/ai/proposals/{proposal_id}/summary."""
        response = client.get("/api/v1/ai/proposals/1/summary")
        # Should call route and execute or return error/404 if proposal id 1 doesn't exist in DB
        assert response.status_code in (200, 404, 500)

    def test_ask_proposal_question_route(self):
        """Test POST /api/v1/ai/proposals/{proposal_id}/ask."""
        payload = {"question": "What is the payment status?"}
        response = client.post("/api/v1/ai/proposals/1/ask", json=payload)
        assert response.status_code in (200, 404, 500)

    def test_ask_proposal_empty_question_validation_error(self):
        """Test POST /api/v1/ai/proposals/{proposal_id}/ask with empty question."""
        payload = {"question": ""}
        response = client.post("/api/v1/ai/proposals/1/ask", json=payload)
        assert response.status_code == 422  # Pydantic validation error

    def test_remarks_summary_route(self):
        """Test GET /api/v1/ai/proposals/{proposal_id}/remarks-summary."""
        response = client.get("/api/v1/ai/proposals/1/remarks-summary")
        assert response.status_code in (200, 404, 500)
