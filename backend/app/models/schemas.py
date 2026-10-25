from __future__ import annotations
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, model_validator
import uuid

# --- Error models ---

class APIError(BaseModel):
    code: str
    message: str
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])

class ErrorResponse(BaseModel):
    error: APIError

# --- Health models ---

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    service: str = "IssueBridge API"

class LLMHealthResponse(BaseModel):
    status: Literal["ready", "ollama_unavailable", "model_not_found", "configuration_error"]
    provider: str = "ollama"
    model: str
    endpoint: str
    details: str
    available_models: List[str] = Field(default_factory=list)

# --- Workflow A: IssueSmith models ---

class IssueInput(BaseModel):
    repo_url: str = Field(..., min_length=10, max_length=500, description="Public GitHub repository URL")
    raw_description: str = Field(..., min_length=5, max_length=15000, description="Rough bug or feature description")
    actual_behavior: Optional[str] = Field(default="", max_length=5000)
    expected_behavior: Optional[str] = Field(default="", max_length=5000)
    steps_to_reproduce: Optional[str] = Field(default="", max_length=5000)
    environment: Optional[str] = Field(default="", max_length=2000)
    additional_context: Optional[str] = Field(default="", max_length=5000)

class MissingInformationItem(BaseModel):
    field: str
    question: str
    why_needed: str

class ReadinessItem(BaseModel):
    item: str
    status: Literal["present", "missing", "needs_review", "not_applicable"]
    explanation: str

class IssueDraft(BaseModel):
    title: str
    issue_type: Literal["bug", "feature_request", "documentation", "other"]
    summary: str
    markdown_body: str
    acceptance_criteria: List[str] = Field(default_factory=list)
    suggested_labels: List[str] = Field(default_factory=list)
    missing_information: List[MissingInformationItem] = Field(default_factory=list)
    readiness_status: Literal["needs_details", "ready_for_review"]
    readiness_checklist: List[ReadinessItem] = Field(default_factory=list)

# --- Workflow B: FirstPR models ---

class PlanDraftInput(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    markdown_body: str = Field(..., min_length=5, max_length=25000)
    acceptance_criteria: List[str] = Field(default_factory=list)
    additional_context: Optional[str] = Field(default="")

class ContributionPlanRequest(BaseModel):
    repo_url: str = Field(..., min_length=10, max_length=500)
    issue_url: Optional[str] = Field(default=None, max_length=500)
    draft: Optional[PlanDraftInput] = None

    @model_validator(mode="after")
    def validate_one_source(self) -> ContributionPlanRequest:
        has_issue = bool(self.issue_url and self.issue_url.strip())
        has_draft = bool(self.draft and self.draft.title.strip() and self.draft.markdown_body.strip())
        if has_issue and has_draft:
            raise ValueError("Provide either 'issue_url' or 'draft', but not both.")
        if not has_issue and not has_draft:
            raise ValueError("Must provide either a valid 'issue_url' or an IssueSmith 'draft'.")
        return self

class EvidenceReference(BaseModel):
    evidence_id: str
    path: str
    url: str
    excerpt: Optional[str] = None
    why_relevant: Optional[str] = None
    what_to_inspect: Optional[str] = None

class ImplementationStep(BaseModel):
    step_number: int
    action: str
    rationale: str
    evidence_ids: List[str] = Field(default_factory=list)
    expected_outcome: str

class SuggestedTest(BaseModel):
    test_type: Literal["existing", "suggested_new"]
    description: str
    target_file_or_module: str
    expected_behavior: str
    evidence_ids: List[str] = Field(default_factory=list)

class PRChecklistItem(BaseModel):
    item: str
    completed: bool = False
    description: Optional[str] = None

class DocLink(BaseModel):
    name: str
    url: str

class IssueSummarySection(BaseModel):
    title: str
    repository_name: str
    original_issue_url: Optional[str] = None
    beginner_explanation: str
    expected_outcome: str
    acceptance_criteria: List[str] = Field(default_factory=list)
    unknowns: List[str] = Field(default_factory=list)

class RepositorySummarySection(BaseModel):
    description: Optional[str] = None
    default_branch: str = "main"
    readme_summary: str
    contributing_summary: Optional[str] = None
    setup_commands: List[str] = Field(default_factory=list)
    test_commands: List[str] = Field(default_factory=list)
    documentation_links: List[DocLink] = Field(default_factory=list)

class ContributionPlan(BaseModel):
    issue_summary: IssueSummarySection
    repository_summary: RepositorySummarySection
    relevant_files: List[EvidenceReference] = Field(default_factory=list)
    implementation_steps: List[ImplementationStep] = Field(default_factory=list)
    suggested_tests: List[SuggestedTest] = Field(default_factory=list)
    unknowns: List[str] = Field(default_factory=list)
    pr_checklist: List[PRChecklistItem] = Field(default_factory=list)
