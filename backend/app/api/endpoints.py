from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
import uuid

from app.models.schemas import (
    HealthResponse,
    LLMHealthResponse,
    IssueInput,
    IssueDraft,
    ContributionPlanRequest,
    ContributionPlan,
    APIError,
    ErrorResponse,
)
from app.services.ai_service import AIService, AIServiceError
from app.services.github_service import GitHubService, GitHubServiceError
from app.services.issue_analyzer import IssueAnalyzer
from app.services.contribution_planner import ContributionPlanner

router = APIRouter(prefix="/api")

# Dependency helpers
def get_ai_service() -> AIService:
    return AIService()

def get_github_service() -> GitHubService:
    return GitHubService()

def get_issue_analyzer(
    github_service: GitHubService = Depends(get_github_service),
    ai_service: AIService = Depends(get_ai_service),
) -> IssueAnalyzer:
    return IssueAnalyzer(github_service=github_service, ai_service=ai_service)

def get_contribution_planner(
    github_service: GitHubService = Depends(get_github_service),
    ai_service: AIService = Depends(get_ai_service),
) -> ContributionPlanner:
    return ContributionPlanner(github_service=github_service, ai_service=ai_service)


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Standard backend health check.
    """
    return HealthResponse()


@router.get("/health/llm", response_model=LLMHealthResponse)
async def llm_health_check(ai_service: AIService = Depends(get_ai_service)):
    """
    Live local Ollama health check verifying model availability.
    """
    result = await ai_service.check_health()
    return LLMHealthResponse(**result)


@router.post(
    "/issues/analyze",
    response_model=IssueDraft,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def analyze_issue(
    input_data: IssueInput,
    analyzer: IssueAnalyzer = Depends(get_issue_analyzer),
):
    """
    IssueSmith: Analyzes a rough bug report, retrieves public GitHub context,
    and uses local Gemma 4 to produce an editable, structured issue draft with readiness checks.
    """
    return await analyzer.analyze_issue(input_data)


@router.post(
    "/contributions/plan",
    response_model=ContributionPlan,
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def plan_contribution(
    req: ContributionPlanRequest,
    planner: ContributionPlanner = Depends(get_contribution_planner),
):
    """
    FirstPR: Takes an existing GitHub issue URL or an IssueSmith draft,
    collects verified repository evidence, and generates an actionable contribution plan.
    """
    return await planner.plan_contribution(req)
