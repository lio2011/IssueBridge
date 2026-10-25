import pytest
from unittest.mock import AsyncMock
from app.services.contribution_planner import ContributionPlanner, RawFirstPRResponse
from app.services.github_service import GitHubService, EvidenceRecord
from app.services.ai_service import AIService
from app.models.schemas import ContributionPlanRequest, PlanDraftInput

@pytest.mark.asyncio
async def test_contribution_planner_evidence_validation():
    mock_gh = AsyncMock(spec=GitHubService)
    mock_gh.collect_repository_evidence.return_value = (
        {"default_branch": "main", "description": "Awesome repo", "language": "TypeScript"},
        {
            "README": EvidenceRecord(
                evidence_id="README",
                path="README.md",
                content="# Awesome Repo\nDocumentation here",
                repo_full_name="owner/repo",
                verified_url="https://github.com/owner/repo/blob/main/README.md",
            ),
            "F1": EvidenceRecord(
                evidence_id="F1",
                path="src/components/ExportTable.tsx",
                content="export function ExportTable() { ... }",
                repo_full_name="owner/repo",
                verified_url="https://github.com/owner/repo/blob/main/src/components/ExportTable.tsx",
                is_test=False,
            ),
        }
    )

    mock_ai = AsyncMock(spec=AIService)
    mock_ai.generate_structured.return_value = RawFirstPRResponse(
        issue_summary={
            "title": "Fix export issue",
            "repository_name": "owner/repo",
            "beginner_explanation": "This issue is about handling date filters properly.",
            "expected_outcome": "Export produces valid CSV rows.",
            "acceptance_criteria": ["Filters applied correctly"],
            "unknowns": ["What happens if date is null?"],
        },
        repository_summary={
            "readme_summary": "Core UI components library",
            "setup_commands": ["npm install", "npm run dev"],
            "test_commands": ["npm test"],
        },
        relevant_files=[
            # Model references F1 (valid) and F99 (hallucinated/invalid)
            {"evidence_id": "F1", "why_relevant": "Contains table export handler", "what_to_inspect": "Lines 40-50"},
            {"evidence_id": "F99", "why_relevant": "Hallucinated file", "what_to_inspect": "Does not exist"},
        ],
        implementation_steps=[
            {
                "step_number": 1,
                "action": "Inspect ExportTable component",
                "rationale": "Locate filter serialization logic",
                "evidence_ids": ["F1", "F99"],
                "expected_outcome": "Filter bug identified",
            }
        ],
        suggested_tests=[
            {
                "test_type": "existing",
                "description": "Run ExportTable unit tests",
                "target_file_or_module": "src/components/ExportTable.tsx",
                "expected_behavior": "Passes existing tests",
                "evidence_ids": ["F1"],
            }
        ],
        unknowns=[],
        pr_checklist=[],
    )

    planner = ContributionPlanner(github_service=mock_gh, ai_service=mock_ai)

    req = ContributionPlanRequest(
        repo_url="https://github.com/owner/repo",
        draft=PlanDraftInput(
            title="Fix export issue",
            markdown_body="## Problem\nExport fails with date filters",
            acceptance_criteria=["Filters applied correctly"],
        )
    )

    plan = await planner.plan_contribution(req)

    # 1. Verify invalid F99 is dropped from relevant_files
    assert len(plan.relevant_files) == 1
    assert plan.relevant_files[0].evidence_id == "F1"
    assert plan.relevant_files[0].path == "src/components/ExportTable.tsx"
    assert plan.relevant_files[0].url == "https://github.com/owner/repo/blob/main/src/components/ExportTable.tsx"

    # 2. Verify invalid F99 is stripped from step evidence_ids
    assert plan.implementation_steps[0].evidence_ids == ["F1"]

    # 3. Verify PR checklist has standard items
    assert len(plan.pr_checklist) == 6
    assert any("Change scope" in item.item for item in plan.pr_checklist)
