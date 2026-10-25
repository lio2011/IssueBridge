from typing import List, Tuple
from app.models.schemas import ReadinessItem, IssueInput

def compute_readiness(
    input_data: IssueInput,
    acceptance_criteria: List[str],
    has_repo_metadata: bool = True
) -> Tuple[str, List[ReadinessItem]]:
    """
    Computes deterministic checklist items and overall readiness status.
    Readiness status is either 'ready_for_review' or 'needs_details'.
    """
    items: List[ReadinessItem] = []

    # 1. Clear problem statement
    raw_desc = (input_data.raw_description or "").strip()
    if len(raw_desc) >= 30:
        items.append(ReadinessItem(
            item="Clear problem statement",
            status="present",
            explanation="The initial description provides sufficient detail to understand the general issue."
        ))
    elif len(raw_desc) > 0:
        items.append(ReadinessItem(
            item="Clear problem statement",
            status="needs_review",
            explanation="The problem description is brief; maintainers may need additional context."
        ))
    else:
        items.append(ReadinessItem(
            item="Clear problem statement",
            status="missing",
            explanation="No problem description was provided."
        ))

    # 2. Actual behavior
    actual = (input_data.actual_behavior or "").strip()
    if actual:
        if len(actual) >= 15:
            items.append(ReadinessItem(
                item="Actual observed behavior",
                status="present",
                explanation="Observed failure or behavior is explicitly detailed."
            ))
        else:
            items.append(ReadinessItem(
                item="Actual observed behavior",
                status="needs_review",
                explanation="Actual behavior was noted but is very brief."
            ))
    else:
        # If it's a feature request or brief bug report, it might be missing
        items.append(ReadinessItem(
            item="Actual observed behavior",
            status="missing",
            explanation="Observed failure or current behavior was not specified by the reporter."
        ))

    # 3. Expected behavior
    expected = (input_data.expected_behavior or "").strip()
    if expected:
        if len(expected) >= 15:
            items.append(ReadinessItem(
                item="Expected behavior",
                status="present",
                explanation="Desired or intended behavior is clearly articulated."
            ))
        else:
            items.append(ReadinessItem(
                item="Expected behavior",
                status="needs_review",
                explanation="Expected behavior is very brief and may need maintainer refinement."
            ))
    else:
        items.append(ReadinessItem(
            item="Expected behavior",
            status="missing",
            explanation="Expected or intended behavior was not specified by the reporter."
        ))

    # 4. Reproduction steps
    steps = (input_data.steps_to_reproduce or "").strip()
    if steps:
        if len(steps) >= 20 or any(c in steps for c in ["1.", "2.", "-", "*", "\n"]):
            items.append(ReadinessItem(
                item="Reproduction steps",
                status="present",
                explanation="Structured steps to reproduce the issue were provided."
            ))
        else:
            items.append(ReadinessItem(
                item="Reproduction steps",
                status="needs_review",
                explanation="Reproduction notes were provided but could be made more step-by-step."
            ))
    else:
        items.append(ReadinessItem(
            item="Reproduction steps",
            status="missing",
            explanation="Specific steps to reproduce the issue were not provided."
        ))

    # 5. Acceptance criteria
    if acceptance_criteria and len(acceptance_criteria) >= 1:
        items.append(ReadinessItem(
            item="Acceptance criteria",
            status="present",
            explanation=f"Includes {len(acceptance_criteria)} suggested acceptance criteria for maintainer review."
        ))
    else:
        items.append(ReadinessItem(
            item="Acceptance criteria",
            status="missing",
            explanation="No acceptance criteria or test goals defined."
        ))

    # 6. Repository context
    if has_repo_metadata:
        items.append(ReadinessItem(
            item="Repository context",
            status="present",
            explanation="Repository metadata and public GitHub context verified."
        ))
    else:
        items.append(ReadinessItem(
            item="Repository context",
            status="needs_review",
            explanation="Repository metadata could not be fully verified."
        ))

    # Determine overall status:
    # If problem statement is present, and either actual/expected or steps is present, and repo verified -> ready_for_review
    # Otherwise -> needs_details
    has_problem = any(i.item == "Clear problem statement" and i.status == "present" for i in items)
    has_any_behavior = any(
        i.item in ("Actual observed behavior", "Expected behavior", "Reproduction steps") and i.status == "present"
        for i in items
    )
    has_criteria = any(i.item == "Acceptance criteria" and i.status == "present" for i in items)

    if has_problem and (has_any_behavior or has_criteria):
        overall_status = "ready_for_review"
    else:
        overall_status = "needs_details"

    return overall_status, items
