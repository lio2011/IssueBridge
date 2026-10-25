import pytest
from app.services.github_service import (
    parse_and_validate_repo_url,
    parse_and_validate_issue_url,
    InvalidGitHubURLError,
)

class TestURLValidation:
    def test_valid_repo_urls(self):
        urls = [
            ("https://github.com/facebook/react", ("facebook", "react")),
            ("http://github.com/torvalds/linux", ("torvalds", "linux")),
            ("https://github.com/owner/repo.git", ("owner", "repo")),
            ("https://github.com/owner/repo/", ("owner", "repo")),
            ("https://www.github.com/org-name/repo_name.js", ("org-name", "repo_name.js")),
        ]
        for url, expected in urls:
            assert parse_and_validate_repo_url(url) == expected

    def test_reject_lookalike_hosts(self):
        lookalikes = [
            "https://github.com.evil.com/owner/repo",
            "https://evil-github.com/owner/repo",
            "https://githubb.com/owner/repo",
            "https://githhub.com/owner/repo",
            "https://notgithub.com/owner/repo",
            "https://gitlab.com/owner/repo",
            "https://bitbucket.org/owner/repo",
        ]
        for url in lookalikes:
            with pytest.raises(InvalidGitHubURLError) as exc_info:
                parse_and_validate_repo_url(url)
            assert "Invalid repository host" in exc_info.value.message or "github.com" in exc_info.value.message

    def test_reject_malformed_repo_urls(self):
        malformed = [
            "",
            "not-a-url",
            "ftp://github.com/owner/repo",
            "https://github.com/justowner",
            "https://github.com//repo",
            "https://github.com/owner/../repo",
        ]
        for url in malformed:
            with pytest.raises(InvalidGitHubURLError):
                parse_and_validate_repo_url(url)

    def test_reject_pr_url_in_repo_parser(self):
        with pytest.raises(InvalidGitHubURLError) as exc:
            parse_and_validate_repo_url("https://github.com/owner/repo/pull/123")
        assert "pull request" in exc.value.message.lower()

    def test_valid_issue_urls(self):
        urls = [
            ("https://github.com/facebook/react/issues/1234", ("facebook", "react", 1234)),
            ("https://www.github.com/owner/repo/issues/1", ("owner", "repo", 1)),
            ("https://github.com/org/project.git/issues/999", ("org", "project", 999)),
        ]
        for url, expected in urls:
            assert parse_and_validate_issue_url(url) == expected

    def test_reject_pr_urls_in_issue_parser(self):
        pr_urls = [
            "https://github.com/facebook/react/pull/1234",
            "https://github.com/owner/repo/pulls/56",
        ]
        for url in pr_urls:
            with pytest.raises(InvalidGitHubURLError) as exc:
                parse_and_validate_issue_url(url)
            assert "pull request" in exc.value.message.lower()

    def test_reject_invalid_issue_numbers(self):
        invalid_issue_urls = [
            "https://github.com/owner/repo/issues/0",
            "https://github.com/owner/repo/issues/-5",
            "https://github.com/owner/repo/issues/abc",
            "https://github.com/owner/repo/issues/",
        ]
        for url in invalid_issue_urls:
            with pytest.raises(InvalidGitHubURLError):
                parse_and_validate_issue_url(url)
