import pytest
import json
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.api.endpoints import get_ai_service, get_github_service
from app.services.ai_service import AIService, OllamaUnavailableError
from app.services.github_service import GitHubService, EvidenceRecord
from app.services.issue_analyzer import RawIssueSmithResponse
from app.services.contribution_planner import RawFirstPRResponse

client = TestClient(app)

def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "IssueBridge" in data["service"]

def test_health_llm_endpoint_mocked():
    mock_ai = AsyncMock(spec=AIService)
    mock_ai.check_health.return_value = {
        "status": "ready",
        "provider": "ollama",
        "model": "gemma4:e4b",
        "endpoint": "http://127.0.0.1:11434",
        "details": "Ollama is running with gemma4:e4b available.",
        "available_models": ["gemma4:e4b"],
    }
    app.dependency_overrides[get_ai_service] = lambda: mock_ai

    resp = client.get("/api/health/llm")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"
    assert resp.json()["model"] == "gemma4:e4b"

    app.dependency_overrides.clear()

def test_analyze_issue_success():
    mock_ai = AsyncMock(spec=AIService)
    mock_ai.generate_structured.return_value = RawIssueSmithResponse(
        title="Fix export failure when filters applied",
        issue_type="bug",
        summary="Export fails silently when date filters are selected.",
        markdown_body="## Problem\nExport fails.\n\n## Steps to reproduce\n1. Filter\n2. Export",
        acceptance_criteria=["Export respects date filter", "Unit test added for filter export"],
        suggested_labels=["bug", "export"],
        missing_information=[],
    )

    mock_gh = AsyncMock(spec=GitHubService)
    mock_gh.get_repository_metadata.return_value = {
        "description": "An open source project",
        "default_branch": "main",
    }
    mock_gh.get_readme.return_value = None

    app.dependency_overrides[get_ai_service] = lambda: mock_ai
    app.dependency_overrides[get_github_service] = lambda: mock_gh

    payload = {
        "repo_url": "https://github.com/facebook/react",
        "raw_description": "The export feature fails sometimes when filters are applied.",
        "actual_behavior": "Nothing downloads when filters are active.",
        "expected_behavior": "Download starts immediately with filtered rows.",
        "steps_to_reproduce": "1. Apply filter\n2. Click export",
    }

    resp = client.post("/api/issues/analyze", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Fix export failure when filters applied"
    assert data["issue_type"] == "bug"
    assert data["readiness_status"] == "ready_for_review"
    assert len(data["acceptance_criteria"]) == 2

    app.dependency_overrides.clear()

def test_analyze_issue_ollama_unavailable_error():
    mock_ai = AsyncMock(spec=AIService)
    mock_ai.generate_structured.side_effect = OllamaUnavailableError()

    app.dependency_overrides[get_ai_service] = lambda: mock_ai

    payload = {
        "repo_url": "https://github.com/facebook/react",
        "raw_description": "The export feature fails sometimes when filters are applied.",
    }

    resp = client.post("/api/issues/analyze", json=payload)
    assert resp.status_code == 503
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == "OLLAMA_UNAVAILABLE"
    assert "local AI service" in data["error"]["message"]
    assert "request_id" in data["error"]

    app.dependency_overrides.clear()

def test_plan_contribution_ambiguous_source_error():
    # Sending both issue_url AND draft must fail validation with 400
    payload = {
        "repo_url": "https://github.com/facebook/react",
        "issue_url": "https://github.com/facebook/react/issues/123",
        "draft": {
            "title": "Draft title",
            "markdown_body": "Draft body",
        },
    }
    resp = client.post("/api/contributions/plan", json=payload)
    assert resp.status_code == 400
    data = resp.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_INPUT"
