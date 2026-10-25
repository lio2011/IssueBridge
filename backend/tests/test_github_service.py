import pytest
import base64
import httpx
from unittest.mock import AsyncMock, patch

from app.services.github_service import (
    GitHubService,
    GitHubNotFoundError,
    GitHubRateLimitError,
    GitHubTimeoutError,
    EvidenceRecord,
)

@pytest.fixture
def github_service():
    return GitHubService()

@pytest.mark.asyncio
async def test_get_repository_metadata_success(github_service):
    mock_resp = httpx.Response(
        200,
        json={
            "full_name": "owner/repo",
            "description": "A sample repo",
            "default_branch": "main",
            "html_url": "https://github.com/owner/repo",
            "language": "Python",
            "stargazers_count": 100,
            "open_issues_count": 12,
            "topics": ["developer-tools"],
        },
        request=httpx.Request("GET", "https://api.github.com/repos/owner/repo")
    )
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get.return_value = mock_resp

    meta = await github_service.get_repository_metadata(mock_client, "owner", "repo")
    assert meta["full_name"] == "owner/repo"
    assert meta["default_branch"] == "main"
    assert meta["language"] == "Python"

@pytest.mark.asyncio
async def test_get_repository_metadata_404(github_service):
    mock_resp = httpx.Response(
        404,
        json={"message": "Not Found"},
        request=httpx.Request("GET", "https://api.github.com/repos/owner/nonexistent")
    )
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get.return_value = mock_resp

    with pytest.raises(GitHubNotFoundError):
        await github_service.get_repository_metadata(mock_client, "owner", "nonexistent")

@pytest.mark.asyncio
async def test_get_repository_rate_limit(github_service):
    mock_resp = httpx.Response(
        403,
        headers={"x-ratelimit-remaining": "0"},
        json={"message": "API rate limit exceeded"},
        request=httpx.Request("GET", "https://api.github.com/repos/owner/repo")
    )
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get.return_value = mock_resp

    with pytest.raises(GitHubRateLimitError):
        await github_service.get_repository_metadata(mock_client, "owner", "repo")

@pytest.mark.asyncio
async def test_get_readme_success(github_service):
    content_raw = "# Test Repo\nThis is a test readme."
    encoded = base64.b64encode(content_raw.encode("utf-8")).decode("utf-8")
    mock_resp = httpx.Response(
        200,
        json={"content": encoded, "path": "README.md"},
        request=httpx.Request("GET", "https://api.github.com/repos/owner/repo/readme")
    )
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.get.return_value = mock_resp

    record = await github_service.get_readme(mock_client, "owner", "repo", "main")
    assert record is not None
    assert record.evidence_id == "README"
    assert record.path == "README.md"
    assert "This is a test readme" in record.content
    assert record.verified_url == "https://github.com/owner/repo/blob/main/README.md"

def test_rank_candidate_files(github_service):
    tree_paths = [
        "src/components/ExportButton.tsx",
        "src/utils/filterHelper.ts",
        "src/api/auth.ts",
        "tests/export.test.ts",
        "docs/setup.md",
        "package.json",
        "README.md",
        "vendor/ignore.ts",
    ]
    query = "The export feature fails when filters are applied."
    top_candidates = github_service.rank_candidate_files(tree_paths, query, max_files=4)
    assert len(top_candidates) <= 4
    # Highest ranked should have export and filter in path
    assert "src/components/ExportButton.tsx" in top_candidates or "src/utils/filterHelper.ts" in top_candidates
