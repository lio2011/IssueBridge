import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IssueSmithView } from '../features/issue-smith/IssueSmithView';
import type { IssueDraft } from '../types';

describe('IssueSmithView component', () => {
  const sampleDraft: IssueDraft = {
    title: 'Fix table export failure when filters applied',
    issue_type: 'bug',
    summary: 'Export fails silently on filtered views',
    markdown_body: '## Problem\nExport button does not download when date filters are active.',
    acceptance_criteria: ['Respect date filters', 'Add unit test'],
    suggested_labels: ['bug', 'export'],
    missing_information: [
      {
        field: 'Browser logs',
        question: 'Are there console errors logged when clicking export?',
        why_needed: 'Helps pinpoint uncaught promises',
      },
    ],
    readiness_status: 'ready_for_review',
    readiness_checklist: [
      {
        item: 'Clear problem statement',
        status: 'present',
        explanation: 'Detail is provided',
      },
    ],
  };

  it('renders input form and loads sample data on click', () => {
    render(
      <IssueSmithView
        onTransferToFirstPR={vi.fn()}
        savedDraft={null}
        savedInput={null}
        onSaveState={vi.fn()}
      />
    );

    const fillSampleBtn = screen.getByRole('button', { name: /Fill with sample report/i });
    fireEvent.click(fillSampleBtn);

    const repoInput = screen.getByPlaceholderText('https://github.com/owner/repository') as HTMLInputElement;
    expect(repoInput.value).toBe('https://github.com/facebook/react');
  });

  it('renders draft and transfers edited state to FirstPR', () => {
    const onTransferToFirstPR = vi.fn();

    render(
      <IssueSmithView
        onTransferToFirstPR={onTransferToFirstPR}
        savedDraft={sampleDraft}
        savedInput={{
          repo_url: 'https://github.com/facebook/react',
          raw_description: 'Export fails',
        }}
        onSaveState={vi.fn()}
      />
    );

    // Draft card should be rendered
    expect(screen.getByText('Generated Issue Draft')).toBeInTheDocument();
    const titleInput = screen.getByDisplayValue('Fix table export failure when filters applied');
    expect(titleInput).toBeInTheDocument();

    // Edit title
    fireEvent.change(titleInput, { target: { value: 'Updated Issue Title' } });
    expect(titleInput).toHaveValue('Updated Issue Title');

    // Click "Generate contributor plan"
    const transferBtn = screen.getByRole('button', { name: /Generate contributor plan/i });
    fireEvent.click(transferBtn);

    expect(onTransferToFirstPR).toHaveBeenCalledTimes(1);
    const transferred = onTransferToFirstPR.mock.calls[0][0];
    expect(transferred.repo_url).toBe('https://github.com/facebook/react');
    expect(transferred.draft.title).toBe('Updated Issue Title');
  });
});
