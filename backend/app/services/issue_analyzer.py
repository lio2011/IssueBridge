from typing import Optional
import httpx
from pydantic import BaseModel, Field
from typing import List, Literal

from app.models.schemas import IssueInput, IssueDraft, MissingInformationItem
from app.services.github_service import GitHubService, parse_and_validate_repo_url
from app.services.ai_service import AIService, ISSUESMITH_SYSTEM_PROMPT
from app.services.readiness import compute_readiness


class RawIssueSmithResponse(BaseModel):
    title: str = Field(..., description="Concise issue title")
    issue_type: Literal["bug", "feature_request", "documentation", "other"] = Field(default="bug")
    summary: str = Field(..., description="Concise problem summary")
    markdown_body: str = Field(..., description="Structured Markdown body")
    acceptance_criteria: List[str] = Field(default_factory=list)
    suggested_labels: List[str] = Field(default_factory=list)
    missing_information: List[MissingInformationItem] = Field(default_factory=list)


class IssueAnalyzer:
    def __init__(self, github_service: Optional[GitHubService] = None, ai_service: Optional[AIService] = None):
        self.github_service = github_service or GitHubService()
        self.ai_service = ai_service or AIService()

    async def analyze_issue(self, input_data: IssueInput) -> IssueDraft:
        # 1. Validate repository URL
        owner, repo = parse_and_validate_repo_url(input_data.repo_url)

        # 2. Retrieve bounded repository context (best-effort)
        repo_desc = ""
        readme_snippet = ""
        has_repo_metadata = False

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                meta = await self.github_service.get_repository_metadata(client, owner, repo)
                repo_desc = meta.get("description", "")
                default_branch = meta.get("default_branch", "main")
                readme = await self.github_service.get_readme(client, owner, repo, default_branch)
                if readme:
                    readme_snippet = readme.content[:2000]
                has_repo_metadata = True
            except Exception:
                # Still proceed if GitHub metadata is unreachable, but record it
                has_repo_metadata = False

        # 3. Construct bounded prompt for local Gemma 4
        user_prompt_sections = [
            f"# Target Repository: {owner}/{repo}",
        ]
        if repo_desc:
            user_prompt_sections.append(f"Repository description: {repo_desc}")
        if readme_snippet:
            user_prompt_sections.append(f"README Excerpt:\n{readme_snippet}\n")

        user_prompt_sections.append(f"## Reported Problem:\n{input_data.raw_description.strip()}")

        if input_data.actual_behavior and input_data.actual_behavior.strip():
            user_prompt_sections.append(f"## Actual Behavior (User provided):\n{input_data.actual_behavior.strip()}")
        else:
            user_prompt_sections.append("## Actual Behavior: Not provided by user")

        if input_data.expected_behavior and input_data.expected_behavior.strip():
            user_prompt_sections.append(f"## Expected Behavior (User provided):\n{input_data.expected_behavior.strip()}")
        else:
            user_prompt_sections.append("## Expected Behavior: Not provided by user")

        if input_data.steps_to_reproduce and input_data.steps_to_reproduce.strip():
            user_prompt_sections.append(f"## Steps to Reproduce (User provided):\n{input_data.steps_to_reproduce.strip()}")
        else:
            user_prompt_sections.append("## Steps to Reproduce: Not provided by user")

        if input_data.environment and input_data.environment.strip():
            user_prompt_sections.append(f"## Environment (User provided):\n{input_data.environment.strip()}")

        if input_data.additional_context and input_data.additional_context.strip():
            user_prompt_sections.append(f"## Additional Context (User provided):\n{input_data.additional_context.strip()}")

        user_prompt = "\n\n".join(user_prompt_sections)

        # 4. Generate structured response with local Gemma 4
        raw_res: RawIssueSmithResponse = await self.ai_service.generate_structured(
            system_prompt=ISSUESMITH_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=RawIssueSmithResponse,
        )

        # 5. Compute deterministic readiness checks
        readiness_status, checklist = compute_readiness(
            input_data=input_data,
            acceptance_criteria=raw_res.acceptance_criteria,
            has_repo_metadata=has_repo_metadata,
        )

        return IssueDraft(
            title=raw_res.title,
            issue_type=raw_res.issue_type,
            summary=raw_res.summary,
            markdown_body=raw_res.markdown_body,
            acceptance_criteria=raw_res.acceptance_criteria,
            suggested_labels=raw_res.suggested_labels,
            missing_information=raw_res.missing_information,
            readiness_status=readiness_status,
            readiness_checklist=checklist,
        )
