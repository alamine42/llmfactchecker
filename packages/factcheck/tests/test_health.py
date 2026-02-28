"""Tests for health endpoint."""

from fastapi.testclient import TestClient

from factcheck.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    """Health endpoint returns status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "groundcheck-factcheck"
