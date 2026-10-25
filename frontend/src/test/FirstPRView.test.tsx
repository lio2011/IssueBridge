import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FirstPRView } from '../features/first-pr/FirstPRView';
import type { ContributionPlan } from '../types';

describe('FirstPRView component', () => {
  const samplePlan: ContributionPlan = {
    issue_summary: {
      title: 'Fix export issue',
      repository_name: 'facebook/react',
      original_issue_url: 'https://github.com/facebook/react/issues/12345',
      beginner_explanation: 'This issue occurs when exporting with filters active.',
      expected_outcome: 'Download CSV file correctly.',
      acceptance_criteria: ['Respect filter parameters'],
      unknowns: [],
    },
    repository_summary: {
      description: 'The library for web and native user interfaces.',
      default_branch: 'main',
      readme_summary: 'React documentation and core primitives.',
      contributing_summary: 'Please review guidelines before submitting PR.',
      setup_commands: ['npm install'],
      test_commands: ['npm test'],
      documentation_links: [
        { name: 'README', url: 'https://github.com/facebook/react/blob/main/README.md' },
      ],
    },
    relevant_files: [
      {
        evidence_id: 'F1',
        path: 'packages/react-dom/src/client/exportHelper.ts',
        url: 'https://github.com/facebook/react/blob/main/packages/react-dom/src/client/exportHelper.ts',
        why_relevant: 'Contains the serialization logic for table export.',
        what_to_inspect: 'Inspect serializeFilters function.',
        excerpt: 'export function serializeFilters() { ... }',
      },
    ],
    implementation_steps: [
      {
        step_number: 1,
        action: 'Locate filter logic in exportHelper.ts',
        rationale: 'Identify where date string conversion breaks.',
        evidence_ids: ['F1'],
        expected_outcome: 'Bug reproduction verified locally.',
      },
    ],
    suggested_tests: [
      {
        test_type: 'existing',
        description: 'Run export regression test suite',
        target_file_or_module: 'packages/react-dom/test/export.test.ts',
        expected_behavior: 'All existing tests pass.',
        evidence_ids: ['F1'],
      },
    ],
    unknowns: [],
    pr_checklist: [
      { item: 'Change scope is limited to the issue.', completed: false },
      { item: 'Relevant tests run locally.', completed: true },
    ],
  };

  it('renders verified file links and external GitHub anchors', () => {
    render(
      <FirstPRView
        transferredDraft={null}
        onReturnToIssueSmith={vi.fn()}
        savedPlan={samplePlan}
        onSavePlan={vi.fn()}
      />
    );

    expect(screen.getByText('C. Relevant Repository Files')).toBeInTheDocument();
    expect(screen.getAllByText('F1')[0]).toBeInTheDocument();

    const fileLink = screen.getByTitle('View verified GitHub source file');
    expect(fileLink).toHaveAttribute(
      'href',
      'https://github.com/facebook/react/blob/main/packages/react-dom/src/client/exportHelper.ts'
    );
  });

  it('allows toggling PR checklist items', () => {
    render(
      <FirstPRView
        transferredDraft={null}
        onReturnToIssueSmith={vi.fn()}
        savedPlan={samplePlan}
        onSavePlan={vi.fn()}
      />
    );

    const checkbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });
});
