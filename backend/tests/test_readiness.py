import pytest
from app.models.schemas import IssueInput
from app.services.readiness import compute_readiness

class TestReadiness:
    def test_complete_report_readiness(self):
        input_data = IssueInput(
            repo_url="https://github.com/facebook/react",
            raw_description="A critical memory leak occurs when unmounting the virtualized table with active subscribers.",
            actual_behavior="Memory usage continues to climb past 1GB and detached DOM nodes remain.",
            expected_behavior="Detached DOM nodes and subscribers should be completely cleaned up on unmount.",
            steps_to_reproduce="1. Open table\n2. Scroll 500 rows\n3. Navigate to home view\n4. Inspect memory heap snapshot",
            environment="Chrome 130, Windows 11, React 19",
            additional_context="Heap snapshot attached in previous issue.",
        )
        status, items = compute_readiness(
            input_data=input_data,
            acceptance_criteria=["Ensure unmount callback runs cleanups", "Verify heap snapshot contains 0 detached nodes"],
            has_repo_metadata=True,
        )
        assert status == "ready_for_review"
        assert len(items) == 6
        for item in items:
            assert item.status == "present"

    def test_vague_report_readiness(self):
        input_data = IssueInput(
            repo_url="https://github.com/owner/repo",
            raw_description="Export fails",
            actual_behavior="",
            expected_behavior="",
            steps_to_reproduce="",
        )
        status, items = compute_readiness(
            input_data=input_data,
            acceptance_criteria=[],
            has_repo_metadata=True,
        )
        assert status == "needs_details"
        problem_item = next(i for i in items if i.item == "Clear problem statement")
        assert problem_item.status == "needs_review"
        actual_item = next(i for i in items if i.item == "Actual observed behavior")
        assert actual_item.status == "missing"
        criteria_item = next(i for i in items if i.item == "Acceptance criteria")
        assert criteria_item.status == "missing"

    def test_missing_repo_metadata_readiness(self):
        input_data = IssueInput(
            repo_url="https://github.com/owner/repo",
            raw_description="The navigation bar does not expand when clicked on mobile viewports.",
            actual_behavior="Clicking hamburger menu does not open side drawer.",
            expected_behavior="Menu opens and shows links.",
        )
        status, items = compute_readiness(
            input_data=input_data,
            acceptance_criteria=["Side drawer opens on tap"],
            has_repo_metadata=False,
        )
        repo_item = next(i for i in items if i.item == "Repository context")
        assert repo_item.status == "needs_review"
