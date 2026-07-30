"""
Utility functions for test data generation, payload assertions, and file mocks.
"""
import io
from typing import Dict, Any


def generate_dummy_file(filename: str = "test_document.pdf", content: bytes = b"%PDF-1.4 Mock PDF Content", content_type: str = "application/pdf"):
    """Generates a tuple suitable for multipart form file upload in FastAPI TestClient."""
    return ("file", (filename, io.BytesIO(content), content_type))


def assert_status_and_json(response, expected_status: int, expected_keys: list = None):
    """Asserts HTTP status code and verifies JSON response contains expected keys."""
    assert response.status_code == expected_status, f"Expected {expected_status}, got {response.status_code}. Response: {response.text}"
    if expected_keys and expected_status < 400:
        data = response.json()
        if isinstance(data, dict):
            for key in expected_keys:
                assert key in data, f"Key '{key}' missing from response JSON: {data}"
        elif isinstance(data, list) and len(data) > 0:
            for key in expected_keys:
                assert key in data[0], f"Key '{key}' missing from first element of response JSON list: {data[0]}"


def get_auth_headers(token: str = "mock_valid_token") -> Dict[str, str]:
    """Generates Authorization header for authenticated requests."""
    return {"Authorization": f"Bearer {token}"}
