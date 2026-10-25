import React, { useState, useEffect } from 'react';
import type {
  ContributionPlanRequest,
  ContributionPlan,
  PlanDraftInput,
  PRChecklistItem,
} from '../../types';
import { planContribution } from '../../services/api';
import {
  Compass,
  FileCode,
  CheckSquare,
  ListOrdered,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
  Terminal,
  FileText,
  GitPullRequest,
  BookOpen,
  Code,
} from 'lucide-react';

interface FirstPRViewProps {
  transferredDraft: {
    repo_url: string;
    draft: PlanDraftInput;
  } | null;
  onReturnToIssueSmith: () => void;
  savedPlan: ContributionPlan | null;
  onSavePlan: (plan: ContributionPlan) => void;
}

export const FirstPRView: React.FC<FirstPRViewProps> = ({
  transferredDraft,
  onReturnToIssueSmith,
  savedPlan,
  onSavePlan,
}) => {
  // Mode: 'existing-issue' | 'draft'
  const [entryMode, setEntryMode] = useState<'existing-issue' | 'draft'>(
    transferredDraft ? 'draft' : 'existing-issue'
  );

  const [issueUrl, setIssueUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState(transferredDraft?.repo_url || '');

  // Loading & error
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Plan result state
  const [plan, setPlan] = useState<ContributionPlan | null>(savedPlan);
  const [checklist, setChecklist] = useState<PRChecklistItem[]>(
    savedPlan?.pr_checklist || []
  );

  // Copy feedback states
  const [copiedPlan, setCopiedPlan] = useState(false);
  const [copiedChecklist, setCopiedChecklist] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // Whenever transferred draft changes, update mode and fields
  useEffect(() => {
    if (transferredDraft) {
      setEntryMode('draft');
      setRepoUrl(transferredDraft.repo_url);
    }
  }, [transferredDraft]);

  const handleGeneratePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    let reqPayload: ContributionPlanRequest;

    if (entryMode === 'existing-issue') {
      if (!issueUrl.trim()) {
        setErrorMessage('Please enter a public GitHub issue URL.');
        return;
      }
      // Extract repo URL from issue URL (https://github.com/owner/repo/issues/123)
      const parts = issueUrl.trim().split('/');
      if (parts.length >= 5 && parts[2]?.includes('github.com')) {
        const derivedRepoUrl = `https://github.com/${parts[3]}/${parts[4]}`;
        reqPayload = {
          repo_url: derivedRepoUrl,
          issue_url: issueUrl.trim(),
        };
      } else {
        reqPayload = {
          repo_url: repoUrl.trim() || issueUrl.trim(),
          issue_url: issueUrl.trim(),
        };
      }
    } else {
      if (!transferredDraft) {
        setErrorMessage('No IssueSmith draft available. Please enter a GitHub issue URL or create a draft in IssueSmith.');
        return;
      }
      reqPayload = {
        repo_url: transferredDraft.repo_url,
        draft: transferredDraft.draft,
      };
    }

    setLoading(true);
    try {
      const result = await planContribution(reqPayload);
      setPlan(result);
      setChecklist(result.pr_checklist);
      onSavePlan(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate contribution plan.');
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = (index: number) => {
    const updated = [...checklist];
    updated[index].completed = !updated[index].completed;
    setChecklist(updated);
  };

  const handleCopyPlan = () => {
    if (!plan) return;
    const planText = `
# Contribution Plan: ${plan.issue_summary.title}
Repository: ${plan.issue_summary.repository_name}

## Issue Explanation
${plan.issue_summary.beginner_explanation}

## Expected Outcome
${plan.issue_summary.expected_outcome}

## Implementation Steps
${plan.implementation_steps
  .map((s) => `${s.step_number}. ${s.action} - ${s.rationale}\n   Outcome: ${s.expected_outcome}`)
  .join('\n\n')}

## Suggested Tests
${plan.suggested_tests
  .map((t) => `- [${t.test_type.toUpperCase()}] ${t.target_file_or_module}: ${t.description}\n  Expected: ${t.expected_behavior}`)
  .join('\n\n')}
`.trim();

    navigator.clipboard.writeText(planText);
    setCopiedPlan(true);
    setTimeout(() => setCopiedPlan(false), 2000);
  };

  const handleCopyChecklist = () => {
    const listText = checklist
      .map((item) => `- [${item.completed ? 'x' : ' '}] ${item.item}`)
      .join('\n');
    navigator.clipboard.writeText(listText);
    setCopiedChecklist(true);
    setTimeout(() => setCopiedChecklist(false), 2000);
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(cmd);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const completedCount = checklist.filter((c) => c.completed).length;
  const progressPercent = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Title & Introduction */}
      <div>
        <div className="flex items-center gap-2 text-purple-600 text-xs font-semibold tracking-wider uppercase mb-1">
          <Compass className="w-4 h-4" /> Workflow B — Contributor Onboarding & Planning
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Explore an issue & prepare your First PR
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Inspect public GitHub repository evidence, identify verified source files, and receive a step-by-step implementation plan with suggested test cases and PR checklist.
        </p>
      </div>

      {/* Entry Mode Switcher Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">Entry Path:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setEntryMode('existing-issue')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  entryMode === 'existing-issue'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Existing GitHub Issue URL
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('draft')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  entryMode === 'draft'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                IssueSmith Draft {transferredDraft && '✓'}
              </button>
            </div>
          </div>

          {transferredDraft && (
            <button
              type="button"
              onClick={onReturnToIssueSmith}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to IssueSmith editor
            </button>
          )}
        </div>

        {/* Path A: Existing GitHub Issue */}
        {entryMode === 'existing-issue' && (
          <form onSubmit={handleGeneratePlan} className="space-y-4">
            <div>
              <label htmlFor="issue-url" className="block text-xs font-semibold text-slate-800 uppercase tracking-wide mb-1">
                Public GitHub Issue URL <span className="text-rose-500">*</span>
              </label>
              <input
                id="issue-url"
                type="url"
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                placeholder="https://github.com/owner/repository/issues/123"
                className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
                required
              />
              <p className="text-2xs text-slate-500 mt-1">
                Example: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">https://github.com/facebook/react/issues/24294</code> (Pull request URLs are rejected)
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Retrieving repo evidence & planning...
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" />
                    Generate Contributor Plan
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Path B: Transferred IssueSmith Draft */}
        {entryMode === 'draft' && (
          <div className="space-y-4">
            {transferredDraft ? (
              <div className="p-4 rounded-lg bg-purple-50/60 border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-purple-200 text-purple-900">
                    Draft Imported from IssueSmith
                  </span>
                  <span className="text-2xs text-slate-500 font-mono">{transferredDraft.repo_url}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{transferredDraft.draft.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-2">{transferredDraft.draft.markdown_body}</p>
                <div className="text-2xs text-purple-800 font-medium">
                  {transferredDraft.draft.acceptance_criteria.length} acceptance criteria attached
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg">
                No draft currently transferred from IssueSmith. You can either switch to 'Existing GitHub Issue URL' above or return to IssueSmith to draft an issue first.
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleGeneratePlan()}
                disabled={loading || !transferredDraft}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Retrieving repo evidence & planning...
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" />
                    Generate Contributor Plan
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plan Results Display */}
      {plan && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Action Bar for Plan */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-5 h-5 text-purple-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">{plan.issue_summary.title}</h2>
                <p className="text-xs text-slate-500">{plan.issue_summary.repository_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPlan}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy entire plan to clipboard"
              >
                {copiedPlan ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPlan ? 'Plan Copied' : 'Copy Plan'}
              </button>
              <button
                type="button"
                onClick={handleCopyChecklist}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy PR checklist"
              >
                {copiedChecklist ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <CheckSquare className="w-3.5 h-3.5" />}
                {copiedChecklist ? 'Checklist Copied' : 'Copy Checklist'}
              </button>
            </div>
          </div>

          {/* Section A: Understand the Issue */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">A. Understand the Issue</h3>
              </div>
              {plan.issue_summary.original_issue_url && (
                <a
                  href={plan.issue_summary.original_issue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 hover:underline font-medium"
                >
                  View on GitHub <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Beginner-Friendly Explanation</h4>
                <p className="text-xs text-slate-700 leading-relaxed">{plan.issue_summary.beginner_explanation}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Expected Outcome</h4>
                <p className="text-xs text-slate-700 leading-relaxed">{plan.issue_summary.expected_outcome}</p>
              </div>
            </div>

            {/* Criteria & Unknowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">Acceptance Criteria to Satisfy:</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {plan.issue_summary.acceptance_criteria.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">Unknowns / Questions for Maintainer:</h4>
                {plan.issue_summary.unknowns.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {plan.issue_summary.unknowns.map((u, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>{u}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">No critical unknowns identified.</p>
                )}
              </div>
            </div>
          </div>

          {/* Section B: Understand the Repository */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">B. Understand the Repository</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">Branch: {plan.repository_summary.default_branch}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">README Summary</h4>
                <p className="text-xs text-slate-700 leading-relaxed">{plan.repository_summary.readme_summary}</p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Contribution Guidelines</h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {plan.repository_summary.contributing_summary || 'No dedicated contributing guidelines found in inspected locations.'}
                </p>
              </div>
            </div>

            {/* Documented Setup & Test Commands */}
            {(plan.repository_summary.setup_commands.length > 0 || plan.repository_summary.test_commands.length > 0) && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-700">Documented Commands:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {plan.repository_summary.setup_commands.map((cmd, i) => (
                    <div key={`setup-${i}`} className="flex items-center justify-between p-2 rounded-md bg-slate-900 text-slate-100 font-mono text-xs">
                      <div className="flex items-center gap-2 overflow-hidden text-ellipsis">
                        <Terminal className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{cmd}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(cmd)}
                        className="text-slate-400 hover:text-white p-1 ml-2 transition-colors flex-shrink-0 cursor-pointer"
                        title="Copy command"
                      >
                        {copiedCommand === cmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}

                  {plan.repository_summary.test_commands.map((cmd, i) => (
                    <div key={`test-${i}`} className="flex items-center justify-between p-2 rounded-md bg-slate-900 text-slate-100 font-mono text-xs">
                      <div className="flex items-center gap-2 overflow-hidden text-ellipsis">
                        <Terminal className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        <span className="truncate">{cmd}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(cmd)}
                        className="text-slate-400 hover:text-white p-1 ml-2 transition-colors flex-shrink-0 cursor-pointer"
                        title="Copy command"
                      >
                        {copiedCommand === cmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Doc Links */}
            <div className="pt-2 flex flex-wrap gap-2">
              {plan.repository_summary.documentation_links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors"
                >
                  {link.name} <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              ))}
            </div>
          </div>

          {/* Section C: Relevant Files (Verified Evidence) */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">C. Relevant Repository Files</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {plan.relevant_files.length} verified {plan.relevant_files.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            {plan.relevant_files.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No specific source files could be verified from the initial repository tree.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.relevant_files.map((file, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-1.5 py-0.5 rounded text-2xs font-bold font-mono bg-purple-100 text-purple-900">
                          {file.evidence_id}
                        </span>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline font-mono truncate"
                          title="View verified GitHub source file"
                        >
                          <span className="truncate">{file.path}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>

                      {file.why_relevant && (
                        <p className="text-xs text-slate-700 mt-2 font-medium">
                          {file.why_relevant}
                        </p>
                      )}

                      {file.what_to_inspect && (
                        <p className="text-2xs text-slate-500 mt-1">
                          <strong>What to inspect:</strong> {file.what_to_inspect}
                        </p>
                      )}
                    </div>

                    {file.excerpt && (
                      <div className="bg-slate-900 text-slate-200 rounded p-2.5 text-2xs font-mono overflow-x-auto max-h-28">
                        <pre>{file.excerpt}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section D: Implementation Plan */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">D. Implementation Plan</h3>
              </div>
              <span className="text-xs text-slate-500">{plan.implementation_steps.length} ordered steps</span>
            </div>

            <div className="space-y-4">
              {plan.implementation_steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-slate-50/70 border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.step_number || idx + 1}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{step.action}</h4>
                      {step.evidence_ids.length > 0 && (
                        <div className="flex items-center gap-1">
                          {step.evidence_ids.map((eid, eIdx) => (
                            <span key={eIdx} className="text-2xs font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                              {eid}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{step.rationale}</p>
                    <div className="text-2xs text-purple-900 font-medium bg-purple-50 p-2 rounded border border-purple-100">
                      <strong>Expected Outcome:</strong> {step.expected_outcome}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section E: Suggested Tests */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">E. Suggested Tests</h3>
              </div>
              <span className="text-2xs font-semibold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Suggested — Not Executed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plan.suggested_tests.map((test, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-2xs font-bold uppercase px-2 py-0.5 rounded ${
                      test.test_type === 'existing'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {test.test_type === 'existing' ? 'Inspect Existing Test' : 'New Test Case'}
                    </span>
                    <span className="text-2xs font-mono text-slate-500 truncate max-w-40">{test.target_file_or_module}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-900">{test.description}</h4>
                  <p className="text-2xs text-slate-600">
                    <strong>Expected Behavior:</strong> {test.expected_behavior}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section F: Pull-Request Checklist */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">F. Pull-Request Checklist</h3>
                <p className="text-xs text-slate-500">Interactive contributor verification before opening PR</p>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-700">{progressPercent}% Completed</span>
                <div className="w-32 bg-slate-200 h-2 rounded-full mt-1 overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {checklist.map((item, idx) => (
                <label
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    item.completed
                      ? 'bg-purple-50/50 border-purple-200 text-purple-950'
                      : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggleChecklistItem(idx)}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 mt-0.5"
                  />
                  <div className="text-xs font-medium">
                    <span>{item.item}</span>
                    {item.description && <p className="text-2xs text-slate-500 mt-0.5">{item.description}</p>}
                  </div>
                </label>
              ))}
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onReturnToIssueSmith}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Return to IssueSmith
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyChecklist}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  {copiedChecklist ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedChecklist ? 'Checklist Copied' : 'Copy PR Checklist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
