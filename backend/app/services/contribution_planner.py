from typing import Optional, Dict, List, Any
import httpx
from pydantic import BaseModel, Field

from app.models.schemas import (
    ContributionPlanRequest,
    ContributionPlan,
    IssueSummarySection,
    RepositorySummarySection,
    EvidenceReference,
    ImplementationStep,
    SuggestedTest,
    PRChecklistItem,
    DocLink,
)
from app.services.github_service import (
    GitHubService,
    EvidenceRecord,
    parse_and_validate_repo_url,
    parse_and_validate_issue_url,
    InvalidGitHubURLError,
)
from app.services.ai_service import AIService, FIRSTPR_SYSTEM_PROMPT


class RawRelevantFile(BaseModel):
    evidence_id: str
    why_relevant: Optional[str] = None
    what_to_inspect: Optional[str] = None

class RawImplementationStep(BaseModel):
    step_number: int
    action: str
    rationale: str
    evidence_ids: List[str] = Field(default_factory=list)
    expected_outcome: str

class RawSuggestedTest(BaseModel):
    test_type: str
    description: str
    target_file_or_module: str
    expected_behavior: str
    evidence_ids: List[str] = Field(default_factory=list)

class RawFirstPRResponse(BaseModel):
    issue_summary: Dict[str, Any]
    repository_summary: Dict[str, Any]
    relevant_files: List[RawRelevantFile] = Field(default_factory=list)
    implementation_steps: List[RawImplementationStep] = Field(default_factory=list)
    suggested_tests: List[RawSuggestedTest] = Field(default_factory=list)
    unknowns: List[str] = Field(default_factory=list)
    pr_checklist: List[Dict[str, Any]] = Field(default_factory=list)


class ContributionPlanner:
    def __init__(self, github_service: Optional[GitHubService] = None, ai_service: Optional[AIService] = None):
        self.github_service = github_service or GitHubService()
        self.ai_service = ai_service or AIService()

    async def plan_contribution(self, req: ContributionPlanRequest) -> ContributionPlan:
        # Determine source
        is_existing_issue = bool(req.issue_url and req.issue_url.strip())
        original_issue_url = None
        issue_title = ""
        issue_body = ""
        acceptance_criteria = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            if is_existing_issue:
                owner, repo, issue_num = parse_and_validate_issue_url(req.issue_url)
                # Verify that issue repo matches repo_url
                expected_owner, expected_repo = parse_and_validate_repo_url(req.repo_url)
                if (owner.lower(), repo.lower()) != (expected_owner.lower(), expected_repo.lower()):
                    raise InvalidGitHubURLError(
                        f"Issue URL belongs to '{owner}/{repo}', which does not match repository URL '{expected_owner}/{expected_repo}'."
                    )
                issue_data = await self.github_service.get_issue(client, owner, repo, issue_num)
                issue_title = issue_data["title"]
                issue_body = issue_data["body"]
                original_issue_url = issue_data["html_url"]
            else:
                owner, repo = parse_and_validate_repo_url(req.repo_url)
                draft = req.draft
                issue_title = draft.title
                issue_body = draft.markdown_body
                acceptance_criteria = draft.acceptance_criteria or []
                if draft.additional_context:
                    issue_body += f"\n\nAdditional Context:\n{draft.additional_context}"

            # Collect repository evidence
            query_text = f"{issue_title} {issue_body}"
            metadata, evidence_dict = await self.github_service.collect_repository_evidence(
                client, owner, repo, query_text
            )

        # Build prompt for local Gemma 4 with bounded evidence and explicit Evidence IDs
        evidence_prompt_blocks = []
        for eid, rec in evidence_dict.items():
            kind = "Documentation" if eid in ("README", "CONTRIBUTING") else ("Test File" if rec.is_test else "Source File")
            evidence_prompt_blocks.append(
                f"### Evidence ID: {eid}\n"
                f"Path: {rec.path} ({kind})\n"
                f"Content Excerpt:\n```\n{rec.content[:2000]}\n```"
            )

        evidence_section = (
            "\n\n".join(evidence_prompt_blocks)
            if evidence_prompt_blocks
            else "No source files could be retrieved."
        )

        user_prompt = f"""Target Repository: {owner}/{repo}
Default Branch: {metadata.get('default_branch', 'main')}
Description: {metadata.get('description', '')}

--- ISSUE DETAILS ---
Title: {issue_title}
Body:
{issue_body}
Existing Acceptance Criteria:
{", ".join(acceptance_criteria) if acceptance_criteria else "None specified"}

--- VERIFIED REPOSITORY EVIDENCE (REFERENCE BY ID ONLY) ---
{evidence_section}

Please produce a comprehensive, beginner-friendly onboarding and contribution plan.
IMPORTANT: In 'relevant_files', refer ONLY to the provided Evidence IDs ({', '.join(evidence_dict.keys()) if evidence_dict else 'NONE'}).
Do not invent file names, commands, or functions not supported by the evidence.
"""

        # Call local Gemma 4
        raw_res: RawFirstPRResponse = await self.ai_service.generate_structured(
            system_prompt=FIRSTPR_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            response_model=RawFirstPRResponse,
        )

        # Post-generation Evidence ID Validation & Construction of Verified URLs
        validated_relevant_files: List[EvidenceReference] = []
        for rf in raw_res.relevant_files:
            eid = rf.evidence_id.strip()
            if eid in evidence_dict:
                rec = evidence_dict[eid]
                validated_relevant_files.append(
                    EvidenceReference(
                        evidence_id=eid,
                        path=rec.path,
                        url=rec.verified_url,
                        excerpt=rec.content[:300] + ("..." if len(rec.content) > 300 else ""),
                        why_relevant=rf.why_relevant or "Identified as relevant to the issue scope.",
                        what_to_inspect=rf.what_to_inspect or "Inspect for logic related to the problem.",
                    )
                )
                if len(validated_relevant_files) >= 8:
                    break

        # If model returned no valid evidence IDs but we have retrieved source files, add the top ones
        if not validated_relevant_files and evidence_dict:
            for eid, rec in list(evidence_dict.items())[:4]:
                if eid in ("README", "CONTRIBUTING"):
                    continue
                validated_relevant_files.append(
                    EvidenceReference(
                        evidence_id=eid,
                        path=rec.path,
                        url=rec.verified_url,
                        excerpt=rec.content[:300] + ("..." if len(rec.content) > 300 else ""),
                        why_relevant="Source candidate retrieved from repository tree matching issue keywords.",
                        what_to_inspect="Review definitions and tests in this file.",
                    )
                )

        # Validate evidence IDs in implementation steps
        valid_steps: List[ImplementationStep] = []
        for step in raw_res.implementation_steps:
            cleaned_eids = [eid for eid in step.evidence_ids if eid in evidence_dict]
            valid_steps.append(
                ImplementationStep(
                    step_number=step.step_number,
                    action=step.action,
                    rationale=step.rationale,
                    evidence_ids=cleaned_eids,
                    expected_outcome=step.expected_outcome,
                )
            )

        # Validate suggested tests
        valid_tests: List[SuggestedTest] = []
        for test in raw_res.suggested_tests:
            cleaned_eids = [eid for eid in test.evidence_ids if eid in evidence_dict]
            ttype = "existing" if test.test_type.lower() == "existing" else "suggested_new"
            valid_tests.append(
                SuggestedTest(
                    test_type=ttype,
                    description=test.description,
                    target_file_or_module=test.target_file_or_module,
                    expected_behavior=test.expected_behavior,
                    evidence_ids=cleaned_eids,
                )
            )

        # Format issue summary
        raw_issue_summary = raw_res.issue_summary or {}
        issue_summary = IssueSummarySection(
            title=issue_title,
            repository_name=f"{owner}/{repo}",
            original_issue_url=original_issue_url,
            beginner_explanation=raw_issue_summary.get(
                "beginner_explanation",
                f"Issue regarding '{issue_title}' in {owner}/{repo}."
            ),
            expected_outcome=raw_issue_summary.get(
                "expected_outcome",
                "Resolve the reported problem and verify with tests without regressions."
            ),
            acceptance_criteria=(
                raw_issue_summary.get("acceptance_criteria")
                or acceptance_criteria
                or ["Ensure fix addresses reported issue", "Preserve existing test suite pass rate"]
            ),
            unknowns=raw_issue_summary.get("unknowns") or raw_res.unknowns or [],
        )

        # Documentation links
        default_branch = metadata.get("default_branch", "main")
        doc_links = [
            DocLink(name="Repository Home", url=f"https://github.com/{owner}/{repo}"),
            DocLink(name="Default Branch", url=f"https://github.com/{owner}/{repo}/tree/{default_branch}"),
        ]
        if "README" in evidence_dict:
            doc_links.append(DocLink(name="README", url=evidence_dict["README"].verified_url))
        if "CONTRIBUTING" in evidence_dict:
            doc_links.append(DocLink(name="Contributing Guide", url=evidence_dict["CONTRIBUTING"].verified_url))

        raw_repo_summary = raw_res.repository_summary or {}
        repo_summary = RepositorySummarySection(
            description=metadata.get("description"),
            default_branch=default_branch,
            readme_summary=raw_repo_summary.get(
                "readme_summary",
                f"Public repository {owner}/{repo} written primarily in {metadata.get('language', 'Unknown')}."
            ),
            contributing_summary=(
                raw_repo_summary.get("contributing_summary")
                if "CONTRIBUTING" in evidence_dict
                else "No explicit CONTRIBUTING.md was discovered in inspected root or .github directories."
            ),
            setup_commands=raw_repo_summary.get("setup_commands") or [],
            test_commands=raw_repo_summary.get("test_commands") or [],
            documentation_links=doc_links,
        )

        # Standard PR checklist items
        default_checklist = [
            PRChecklistItem(item="Change scope is strictly limited to the issue.", completed=False),
            PRChecklistItem(item="Relevant tests have been run locally by contributor.", completed=False),
            PRChecklistItem(item="Regression test coverage has been added where appropriate.", completed=False),
            PRChecklistItem(item="Documentation has been updated if user-facing behavior changed.", completed=False),
            PRChecklistItem(item="PR description clearly explains the problem and the solution.", completed=False),
            PRChecklistItem(item="Repository contribution guidelines have been checked.", completed=False),
        ]

        return ContributionPlan(
            issue_summary=issue_summary,
            repository_summary=repo_summary,
            relevant_files=validated_relevant_files,
            implementation_steps=valid_steps,
            suggested_tests=valid_tests,
            unknowns=raw_res.unknowns or issue_summary.unknowns,
            pr_checklist=default_checklist,
        )
