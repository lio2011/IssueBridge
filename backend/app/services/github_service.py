import base64
import re
import urllib.parse
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
import httpx

from app.core.config import get_settings

# --- Custom GitHub Exceptions ---

class GitHubServiceError(Exception):
    def __init__(self, message: str, code: str = "GITHUB_ERROR", status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code

class InvalidGitHubURLError(GitHubServiceError):
    def __init__(self, message: str):
        super().__init__(message, code="INVALID_GITHUB_URL", status_code=400)

class GitHubNotFoundError(GitHubServiceError):
    def __init__(self, message: str):
        super().__init__(message, code="GITHUB_NOT_FOUND", status_code=404)

class GitHubRateLimitError(GitHubServiceError):
    def __init__(self, message: str):
        super().__init__(message, code="GITHUB_RATE_LIMIT", status_code=429)

class GitHubTimeoutError(GitHubServiceError):
    def __init__(self, message: str):
        super().__init__(message, code="GITHUB_TIMEOUT", status_code=504)


# --- Evidence Record Dataclass ---

@dataclass
class EvidenceRecord:
    evidence_id: str
    path: str
    content: str
    repo_full_name: str
    verified_url: str
    is_test: bool = False


# --- URL Parsing and Validation ---

GITHUB_HOSTS = {"github.com", "www.github.com"}
FIXED_API_BASE = "https://api.github.com"

# Ignored paths / files for tree filtering
IGNORED_DIRECTORIES = {
    "node_modules", "vendor", ".git", "dist", "build", ".venv", "venv", "env",
    "target", "bin", "obj", "__pycache__", ".pytest_cache", ".next", ".nuxt",
    ".idea", ".vscode", "coverage", ".turbo", ".cache"
}

IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".pdf",
    ".exe", ".dll", ".so", ".dylib", ".zip", ".tar", ".gz", ".lock",
    ".min.js", ".min.css", ".map", ".ttf", ".woff", ".woff2"
}

SOURCE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".cpp",
    ".c", ".h", ".cs", ".rb", ".php", ".swift", ".kt", ".scala", ".sh",
    ".json", ".yaml", ".yml", ".toml", ".md"
}

def parse_and_validate_repo_url(url: str) -> Tuple[str, str]:
    """
    Validates that the URL is a canonical public GitHub repository URL.
    Returns (owner, repo).
    Rejects lookalike hosts, PR URLs, non-GitHub domains, and malformed inputs.
    """
    if not url or not isinstance(url, str):
        raise InvalidGitHubURLError("Repository URL must be a non-empty string.")

    cleaned_url = url.strip()
    parsed = urllib.parse.urlparse(cleaned_url)

    if parsed.scheme not in ("http", "https"):
        raise InvalidGitHubURLError("Repository URL must use HTTP or HTTPS protocol.")

    host = (parsed.hostname or "").lower()
    if host not in GITHUB_HOSTS:
        raise InvalidGitHubURLError(
            f"Invalid repository host '{host}'. Only public 'github.com' repositories are supported."
        )

    # Normalize path segments
    path = parsed.path.strip("/")
    parts = [p for p in path.split("/") if p]

    if len(parts) < 2:
        raise InvalidGitHubURLError("Repository URL must include both owner and repository name (e.g. https://github.com/owner/repo).")

    owner = parts[0]
    repo = parts[1]

    # Clean optional .git suffix
    if repo.endswith(".git"):
        repo = repo[:-4]

    # Validate owner and repo characters (alphanumeric, dashes, underscores, dots)
    valid_name_pattern = re.compile(r"^[a-zA-Z0-9_\-\.]+$")
    if not valid_name_pattern.match(owner) or not valid_name_pattern.match(repo):
        raise InvalidGitHubURLError("Repository owner and name contain invalid characters.")

    if owner in (".", "..") or repo in (".", ".."):
        raise InvalidGitHubURLError("Invalid repository name specified.")

    # Reject if URL path points to issues, pull requests, commits, etc. when parsing repo URL
    if len(parts) > 2 and parts[2] in ("pull", "pulls", "commit", "releases"):
        raise InvalidGitHubURLError("Expected repository root URL, but found a pull request or commit URL.")

    return owner, repo


def parse_and_validate_issue_url(url: str) -> Tuple[str, str, int]:
    """
    Validates a canonical GitHub issue URL (https://github.com/owner/repo/issues/123).
    Returns (owner, repo, issue_number).
    Rejects pull-request URLs (e.g. /pull/123).
    """
    if not url or not isinstance(url, str):
        raise InvalidGitHubURLError("Issue URL must be a non-empty string.")

    cleaned_url = url.strip()
    parsed = urllib.parse.urlparse(cleaned_url)

    if parsed.scheme not in ("http", "https"):
        raise InvalidGitHubURLError("Issue URL must use HTTP or HTTPS protocol.")

    host = (parsed.hostname or "").lower()
    if host not in GITHUB_HOSTS:
        raise InvalidGitHubURLError(f"Invalid host '{host}'. Only 'github.com' URLs are supported.")

    path = parsed.path.strip("/")
    parts = [p for p in path.split("/") if p]

    # Reject pull requests explicitly
    if "pull" in parts or "pulls" in parts:
        raise InvalidGitHubURLError(
            "The provided URL is a Pull Request, not a GitHub issue. FirstPR requires an Issue URL."
        )

    # Expected: owner / repo / issues / number
    if len(parts) != 4 or parts[2] != "issues":
        raise InvalidGitHubURLError(
            "Invalid GitHub issue URL format. Expected: https://github.com/OWNER/REPO/issues/NUMBER"
        )

    owner = parts[0]
    repo = parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]

    try:
        issue_number = int(parts[3])
        if issue_number <= 0:
            raise ValueError()
    except ValueError:
        raise InvalidGitHubURLError(f"Invalid issue number '{parts[3]}'. Must be a positive integer.")

    return owner, repo, issue_number


class GitHubService:
    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._settings = get_settings()
        self._client = client

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "IssueBridge-App/1.0",
        }
        if self._settings.github_token and self._settings.github_token.strip():
            headers["Authorization"] = f"Bearer {self._settings.github_token.strip()}"
        return headers

    async def _request(self, client: httpx.AsyncClient, endpoint: str) -> httpx.Response:
        url = f"{FIXED_API_BASE}{endpoint}"
        try:
            resp = await client.get(url, headers=self._get_headers())
        except httpx.TimeoutException:
            raise GitHubTimeoutError(f"Request to GitHub timed out for endpoint {endpoint}.")
        except httpx.RequestError as e:
            raise GitHubServiceError(f"Network error connecting to GitHub: {str(e)}")

        if resp.status_code == 404:
            raise GitHubNotFoundError(f"Requested resource not found on GitHub: {endpoint}")
        elif resp.status_code == 403:
            remaining = resp.headers.get("x-ratelimit-remaining", "")
            if remaining == "0":
                raise GitHubRateLimitError("GitHub API rate limit exceeded. Please configure GITHUB_TOKEN or wait.")
            raise GitHubServiceError("Access forbidden by GitHub API (403).", code="GITHUB_FORBIDDEN", status_code=403)
        elif resp.status_code >= 400:
            raise GitHubServiceError(
                f"GitHub API returned error {resp.status_code}: {resp.text[:200]}",
                status_code=resp.status_code
            )

        return resp

    async def get_repository_metadata(self, client: httpx.AsyncClient, owner: str, repo: str) -> Dict[str, Any]:
        resp = await self._request(client, f"/repos/{owner}/{repo}")
        data = resp.json()
        return {
            "full_name": data.get("full_name", f"{owner}/{repo}"),
            "description": data.get("description") or "",
            "default_branch": data.get("default_branch", "main"),
            "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
            "language": data.get("language") or "Unknown",
            "stargazers_count": data.get("stargazers_count", 0),
            "open_issues_count": data.get("open_issues_count", 0),
            "topics": data.get("topics", []),
        }

    async def get_issue(self, client: httpx.AsyncClient, owner: str, repo: str, issue_number: int) -> Dict[str, Any]:
        resp = await self._request(client, f"/repos/{owner}/{repo}/issues/{issue_number}")
        data = resp.json()

        # GitHub issue endpoint also returns PRs with 'pull_request' key
        if "pull_request" in data and data["pull_request"]:
            raise InvalidGitHubURLError(
                f"Issue #{issue_number} in {owner}/{repo} is a Pull Request, not an Issue."
            )

        return {
            "number": data.get("number", issue_number),
            "title": data.get("title", ""),
            "body": data.get("body") or "",
            "state": data.get("state", "open"),
            "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}/issues/{issue_number}"),
            "labels": [label["name"] for label in data.get("labels", []) if isinstance(label, dict) and "name" in label],
            "author": data.get("user", {}).get("login", "unknown"),
        }

    async def get_readme(self, client: httpx.AsyncClient, owner: str, repo: str, default_branch: str) -> Optional[EvidenceRecord]:
        try:
            resp = await self._request(client, f"/repos/{owner}/{repo}/readme")
            data = resp.json()
            content_encoded = data.get("content", "")
            path = data.get("path", "README.md")
            if content_encoded:
                raw_text = base64.b64decode(content_encoded).decode("utf-8", errors="replace")
                truncated = raw_text[: self._settings.max_file_chars]
                verified_url = f"https://github.com/{owner}/{repo}/blob/{default_branch}/{path}"
                return EvidenceRecord(
                    evidence_id="README",
                    path=path,
                    content=truncated,
                    repo_full_name=f"{owner}/{repo}",
                    verified_url=verified_url,
                )
        except (GitHubNotFoundError, Exception):
            return None
        return None

    async def get_contributing_guide(
        self, client: httpx.AsyncClient, owner: str, repo: str, default_branch: str, tree_paths: List[str]
    ) -> Optional[EvidenceRecord]:
        # Candidates to check
        likely_paths = [
            "CONTRIBUTING.md",
            ".github/CONTRIBUTING.md",
            "docs/CONTRIBUTING.md",
            "contributing.md",
            "CONTRIBUTING.rst",
        ]
        chosen_path = None
        for cand in likely_paths:
            if cand in tree_paths:
                chosen_path = cand
                break
        if not chosen_path:
            # Check case-insensitive match
            for cand in tree_paths:
                if cand.lower() in ("contributing.md", ".github/contributing.md", "docs/contributing.md"):
                    chosen_path = cand
                    break

        if not chosen_path:
            return None

        try:
            resp = await self._request(client, f"/repos/{owner}/{repo}/contents/{chosen_path}")
            data = resp.json()
            content_encoded = data.get("content", "")
            if content_encoded:
                raw_text = base64.b64decode(content_encoded).decode("utf-8", errors="replace")
                truncated = raw_text[: self._settings.max_file_chars]
                verified_url = f"https://github.com/{owner}/{repo}/blob/{default_branch}/{chosen_path}"
                return EvidenceRecord(
                    evidence_id="CONTRIBUTING",
                    path=chosen_path,
                    content=truncated,
                    repo_full_name=f"{owner}/{repo}",
                    verified_url=verified_url,
                )
        except Exception:
            return None
        return None

    async def get_repository_tree(
        self, client: httpx.AsyncClient, owner: str, repo: str, default_branch: str
    ) -> List[str]:
        """
        Retrieves a bounded list of repository file paths from default branch git tree.
        Excludes dependencies, build artifacts, and vendor folders.
        """
        try:
            resp = await self._request(
                client, f"/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
            )
            data = resp.json()
            tree = data.get("tree", [])
            valid_paths = []
            for item in tree:
                if item.get("type") != "blob":
                    continue
                path = item.get("path", "")
                parts = path.split("/")
                # Check directory exclusion
                if any(part in IGNORED_DIRECTORIES for part in parts[:-1]):
                    continue
                # Check extension exclusion
                filename = parts[-1]
                ext = f".{filename.split('.')[-1].lower()}" if "." in filename else ""
                if ext in IGNORED_EXTENSIONS:
                    continue
                valid_paths.append(path)
            return valid_paths
        except Exception:
            return []

    def rank_candidate_files(
        self, tree_paths: List[str], query_text: str, max_files: int = 8
    ) -> List[str]:
        """
        Ranks repository file candidates based on keyword relevance to the query/issue text.
        Returns up to max_files top paths.
        """
        if not tree_paths:
            return []

        # Extract search keywords (lowercase, alphanumerics, len >= 3)
        raw_words = re.findall(r"[a-zA-Z0-9_\-\.]{3,}", query_text.lower())
        stopwords = {
            "the", "and", "for", "with", "that", "this", "from", "when", "then",
            "have", "will", "what", "fails", "sometimes", "applied", "error", "issue",
            "bug", "feature", "please", "some", "more", "does", "not", "cannot"
        }
        keywords = {w for w in raw_words if w not in stopwords}

        scored: List[Tuple[float, str]] = []
        for path in tree_paths:
            path_lower = path.lower()
            score = 0.0

            # Boost source extensions
            ext = f".{path_lower.split('.')[-1]}" if "." in path_lower else ""
            if ext in SOURCE_EXTENSIONS:
                score += 1.0

            # Boost if contains keywords
            for kw in keywords:
                if kw in path_lower:
                    # Give higher weight to matches in filename vs directory
                    filename = path_lower.split("/")[-1]
                    if kw in filename:
                        score += 5.0
                    else:
                        score += 2.0

            # Detect test files
            if "test" in path_lower or "spec" in path_lower:
                score += 1.5

            if score > 0:
                scored.append((score, path))

        # Sort descending by score
        scored.sort(key=lambda x: x[0], reverse=True)
        top_candidates = [item[1] for item in scored[:max_files]]

        # If we have fewer than max_files and tree_paths has other source files, fill up
        if len(top_candidates) < max_files:
            for path in tree_paths:
                if path not in top_candidates and any(path.endswith(e) for e in SOURCE_EXTENSIONS):
                    top_candidates.append(path)
                    if len(top_candidates) >= max_files:
                        break

        return top_candidates

    async def retrieve_file_content(
        self, client: httpx.AsyncClient, owner: str, repo: str, default_branch: str, path: str, evidence_id: str
    ) -> Optional[EvidenceRecord]:
        try:
            # Escape path properly for GitHub contents API
            safe_path = urllib.parse.quote(path, safe="/")
            resp = await self._request(client, f"/repos/{owner}/{repo}/contents/{safe_path}?ref={default_branch}")
            data = resp.json()
            content_encoded = data.get("content", "")
            if not content_encoded:
                return None
            raw_text = base64.b64decode(content_encoded).decode("utf-8", errors="replace")
            truncated = raw_text[: self._settings.max_file_chars]
            verified_url = f"https://github.com/{owner}/{repo}/blob/{default_branch}/{safe_path}"
            is_test = "test" in path.lower() or "spec" in path.lower()
            return EvidenceRecord(
                evidence_id=evidence_id,
                path=path,
                content=truncated,
                repo_full_name=f"{owner}/{repo}",
                verified_url=verified_url,
                is_test=is_test,
            )
        except Exception:
            return None

    async def collect_repository_evidence(
        self, client: httpx.AsyncClient, owner: str, repo: str, query_text: str
    ) -> Tuple[Dict[str, Any], Dict[str, EvidenceRecord]]:
        """
        Coordinates full evidence retrieval for a repository:
        - Metadata
        - README
        - Tree
        - CONTRIBUTING guide
        - Relevant source files (bounded)
        Returns (metadata, evidence_dict_by_id).
        """
        metadata = await self.get_repository_metadata(client, owner, repo)
        default_branch = metadata.get("default_branch", "main")

        evidence: Dict[str, EvidenceRecord] = {}
        total_chars = 0

        # README
        readme_rec = await self.get_readme(client, owner, repo, default_branch)
        if readme_rec:
            evidence["README"] = readme_rec
            total_chars += len(readme_rec.content)

        # Tree
        tree_paths = await self.get_repository_tree(client, owner, repo, default_branch)

        # CONTRIBUTING
        contrib_rec = await self.get_contributing_guide(client, owner, repo, default_branch, tree_paths)
        if contrib_rec:
            evidence["CONTRIBUTING"] = contrib_rec
            total_chars += len(contrib_rec.content)

        # Rank candidate files
        candidates = self.rank_candidate_files(tree_paths, query_text, max_files=self._settings.max_repository_files)

        # Retrieve candidate contents bounded by MAX_TOTAL_CONTEXT_CHARS
        file_idx = 1
        for path in candidates:
            if path in ("README.md", "CONTRIBUTING.md", ".github/CONTRIBUTING.md"):
                continue
            if total_chars >= self._settings.max_total_context_chars:
                break

            evidence_id = f"F{file_idx}"
            rec = await self.retrieve_file_content(client, owner, repo, default_branch, path, evidence_id)
            if rec:
                # Truncate if would exceed aggregate limit
                remaining_budget = self._settings.max_total_context_chars - total_chars
                if remaining_budget <= 0:
                    break
                if len(rec.content) > remaining_budget:
                    rec.content = rec.content[:remaining_budget] + "\n... [content truncated to fit context budget]"
                evidence[evidence_id] = rec
                total_chars += len(rec.content)
                file_idx += 1

        return metadata, evidence
