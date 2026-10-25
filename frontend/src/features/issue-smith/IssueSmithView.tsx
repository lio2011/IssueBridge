import React, { useState } from 'react';
import type {
  IssueInput,
  IssueDraft,
  PlanDraftInput,
  ItemStatus,
} from '../../types';
import { analyzeIssue } from '../../services/api';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  RotateCcw,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  FileEdit,
} from 'lucide-react';

interface IssueSmithViewProps {
  onTransferToFirstPR: (data: { repo_url: string; draft: PlanDraftInput }) => void;
  savedDraft: IssueDraft | null;
  savedInput: IssueInput | null;
  onSaveState: (input: IssueInput, draft: IssueDraft) => void;
}

const SAMPLE_INPUT: IssueInput = {
  repo_url: 'https://github.com/facebook/react',
  raw_description: 'The export feature fails sometimes when filters are applied.',
  actual_behavior: 'When a user selects a date filter and clicks export, the spinner shows but nothing downloads.',
  expected_behavior: 'The filtered data should download as a CSV file matching the active filter parameters.',
  steps_to_reproduce: '1. Navigate to Reports view\n2. Set Date Range filter to Last 30 Days\n3. Click Export CSV button',
  environment: 'Chrome 130 on Windows 11',
  additional_context: 'Console logs show an uncaught rejection in table export serializer.',
};

export const IssueSmithView: React.FC<IssueSmithViewProps> = ({
  onTransferToFirstPR,
  savedDraft,
  savedInput,
  onSaveState,
}) => {
  // Input form state
  const [repoUrl, setRepoUrl] = useState(savedInput?.repo_url || '');
  const [rawDescription, setRawDescription] = useState(savedInput?.raw_description || '');
  const [actualBehavior, setActualBehavior] = useState(savedInput?.actual_behavior || '');
  const [expectedBehavior, setExpectedBehavior] = useState(savedInput?.expected_behavior || '');
  const [stepsToReproduce, setStepsToReproduce] = useState(savedInput?.steps_to_reproduce || '');
  const [environment, setEnvironment] = useState(savedInput?.environment || '');
  const [additionalContext, setAdditionalContext] = useState(savedInput?.additional_context || '');

  // UI state
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result Draft state (editable)
  const [draft, setDraft] = useState<IssueDraft | null>(savedDraft);
  const [editedTitle, setEditedTitle] = useState(savedDraft?.title || '');
  const [editedMarkdown, setEditedMarkdown] = useState(savedDraft?.markdown_body || '');
  const [editedCriteria, setEditedCriteria] = useState<string[]>(savedDraft?.acceptance_criteria || []);
  const [newCriterionText, setNewCriterionText] = useState('');
  const [hasEdits, setHasEdits] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Copy feedback states
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const loadSample = () => {
    setRepoUrl(SAMPLE_INPUT.repo_url);
    setRawDescription(SAMPLE_INPUT.raw_description);
    setActualBehavior(SAMPLE_INPUT.actual_behavior || '');
    setExpectedBehavior(SAMPLE_INPUT.expected_behavior || '');
    setStepsToReproduce(SAMPLE_INPUT.steps_to_reproduce || '');
    setEnvironment(SAMPLE_INPUT.environment || '');
    setAdditionalContext(SAMPLE_INPUT.additional_context || '');
    setShowOptionalFields(true);
    setErrorMessage(null);
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!repoUrl.trim()) {
      setErrorMessage('Please enter a public GitHub repository URL.');
      return;
    }
    if (!rawDescription.trim()) {
      setErrorMessage('Please provide a description of the issue or bug.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const inputPayload: IssueInput = {
      repo_url: repoUrl.trim(),
      raw_description: rawDescription.trim(),
      actual_behavior: actualBehavior.trim(),
      expected_behavior: expectedBehavior.trim(),
      steps_to_reproduce: stepsToReproduce.trim(),
      environment: environment.trim(),
      additional_context: additionalContext.trim(),
    };

    try {
      const result = await analyzeIssue(inputPayload);
      setDraft(result);
      setEditedTitle(result.title);
      setEditedMarkdown(result.markdown_body);
      setEditedCriteria(result.acceptance_criteria);
      setHasEdits(false);
      onSaveState(inputPayload, result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to analyze issue.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTitle = () => {
    navigator.clipboard.writeText(editedTitle);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(editedMarkdown);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleAddCriterion = () => {
    if (!newCriterionText.trim()) return;
    setEditedCriteria([...editedCriteria, newCriterionText.trim()]);
    setNewCriterionText('');
    setHasEdits(true);
  };

  const handleDeleteCriterion = (index: number) => {
    setEditedCriteria(editedCriteria.filter((_, i) => i !== index));
    setHasEdits(true);
  };

  const handleResetDraft = () => {
    if (hasEdits && !showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }
    if (draft) {
      setEditedTitle(draft.title);
      setEditedMarkdown(draft.markdown_body);
      setEditedCriteria(draft.acceptance_criteria);
      setHasEdits(false);
    }
    setShowResetConfirm(false);
  };

  const handleTransfer = () => {
    const planDraft: PlanDraftInput = {
      title: editedTitle,
      markdown_body: editedMarkdown,
      acceptance_criteria: editedCriteria,
      additional_context: additionalContext,
    };
    onTransferToFirstPR({
      repo_url: repoUrl.trim(),
      draft: planDraft,
    });
  };

  const renderStatusBadge = (status: ItemStatus) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Present
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <HelpCircle className="w-3 h-3 text-amber-600" /> Needs Review
          </span>
        );
      case 'missing':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Missing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            N/A
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Title & Introduction */}
      <div>
        <div className="flex items-center gap-2 text-indigo-600 text-xs font-semibold tracking-wider uppercase mb-1">
          <Sparkles className="w-4 h-4" /> Workflow A — Maintainer Issue Enhancement
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Make an issue contributor-ready
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Transform rough, underspecified bug reports into clear, structured, contributor-friendly GitHub issues with suggested acceptance criteria and deterministic readiness checks.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleAnalyze} className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-semibold text-slate-900">Issue Source Details</h2>
          <button
            type="button"
            onClick={loadSample}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline flex items-center gap-1 cursor-pointer"
          >
            Fill with sample report
          </button>
        </div>

        {/* Repository URL */}
        <div>
          <label htmlFor="repo-url" className="block text-xs font-semibold text-slate-800 uppercase tracking-wide mb-1">
            Public GitHub Repository URL <span className="text-rose-500">*</span>
          </label>
          <input
            id="repo-url"
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repository"
            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50"
            required
          />
        </div>

        {/* Rough Description */}
        <div>
          <label htmlFor="raw-desc" className="block text-xs font-semibold text-slate-800 uppercase tracking-wide mb-1">
            Rough Issue / Bug Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="raw-desc"
            rows={3}
            value={rawDescription}
            onChange={(e) => setRawDescription(e.target.value)}
            placeholder="Describe what went wrong or what feature was requested in plain language..."
            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50"
            required
          />
        </div>

        {/* Optional Accordion */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
            className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-left flex items-center justify-between text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <span>Additional Reporter Notes (Optional: Actual, Expected, Reproduction, Environment)</span>
            {showOptionalFields ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {showOptionalFields && (
            <div className="p-4 space-y-4 bg-white border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Actual Behavior</label>
                  <input
                    type="text"
                    value={actualBehavior}
                    onChange={(e) => setActualBehavior(e.target.value)}
                    placeholder="Observed error or failure..."
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Expected Behavior</label>
                  <input
                    type="text"
                    value={expectedBehavior}
                    onChange={(e) => setExpectedBehavior(e.target.value)}
                    placeholder="Desired behavior..."
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Steps to Reproduce</label>
                <textarea
                  rows={2}
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  placeholder="1. Step one&#10;2. Step two..."
                  className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Environment Details</label>
                  <input
                    type="text"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    placeholder="e.g. Node 20, Chrome 128, OS..."
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Additional Context</label>
                  <input
                    type="text"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Logs, screenshots mention, or references..."
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit Action */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing with local Gemma 4...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze and improve issue
              </>
            )}
          </button>
        </div>
      </form>

      {/* Draft Results Display */}
      {draft && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main Draft Card */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-sm font-semibold">Generated Issue Draft</h2>
                  <p className="text-xs text-slate-400">Category: <span className="uppercase text-indigo-300 font-mono">{draft.issue_type}</span></p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTitle}
                  className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy issue title"
                >
                  {copiedTitle ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedTitle ? 'Title Copied' : 'Copy Title'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy full issue Markdown"
                >
                  {copiedMarkdown ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedMarkdown ? 'Markdown Copied' : 'Copy Markdown'}
                </button>
                <button
                  type="button"
                  onClick={() => handleAnalyze()}
                  disabled={loading}
                  className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Regenerate draft from inputs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reset edits to initial generated draft"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>

            {/* Reset confirmation modal */}
            {showResetConfirm && (
              <div className="bg-amber-50 border-b border-amber-200 p-3 px-6 flex items-center justify-between text-xs text-amber-900">
                <span>You have unsaved edits in this draft. Discard edits and restore initial model draft?</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetDraft}
                    className="px-2 py-0.5 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-2 py-0.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="p-6 space-y-5">
              {/* Editable Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Issue Title (Editable)
                </label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => {
                    setEditedTitle(e.target.value);
                    setHasEdits(true);
                  }}
                  className="w-full text-sm font-medium px-3.5 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              {/* Editable Markdown Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Issue Body (Markdown, Editable)
                  </label>
                  <span className="text-xs text-slate-400 font-mono">
                    {editedMarkdown.length} chars
                  </span>
                </div>
                <textarea
                  rows={14}
                  value={editedMarkdown}
                  onChange={(e) => {
                    setEditedMarkdown(e.target.value);
                    setHasEdits(true);
                  }}
                  className="w-full text-xs font-mono p-3.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50/60 leading-relaxed"
                />
              </div>

              {/* Suggested Labels */}
              {draft.suggested_labels.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-600 mr-2">Suggested Labels:</span>
                  <div className="inline-flex flex-wrap gap-1.5 mt-1">
                    {draft.suggested_labels.map((label, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full font-mono">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Missing Information & Acceptance Criteria Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Missing Information Questions */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Missing Information Identified</h3>
              </div>

              {draft.missing_information.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No missing information flags. Report contains good initial coverage.</p>
              ) : (
                <div className="space-y-3">
                  {draft.missing_information.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="font-semibold text-slate-900 flex items-center justify-between">
                        <span>{item.field}</span>
                        <span className="text-slate-400 font-normal text-2xs">Clarification</span>
                      </div>
                      <p className="text-indigo-900 font-medium">{item.question}</p>
                      <p className="text-slate-500 text-2xs mt-1">
                        <strong>Why it matters:</strong> {item.why_needed}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Editable Acceptance Criteria */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Suggested Acceptance Criteria</h3>
                </div>
                <span className="text-2xs text-slate-400 font-normal">Editable</span>
              </div>

              <div className="space-y-2">
                {editedCriteria.map((crit, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-md bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-800 leading-snug">{crit}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCriterion(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors flex-shrink-0 cursor-pointer"
                      title="Remove criterion"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add new criterion input */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newCriterionText}
                    onChange={(e) => setNewCriterionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCriterion();
                      }
                    }}
                    placeholder="Add custom acceptance criterion..."
                    className="flex-1 text-xs px-3 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 transition-colors flex items-center cursor-pointer"
                    title="Add criterion"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contribution Readiness Checklist */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Contribution Readiness Checklist</h3>
                <p className="text-xs text-slate-500">Calculated deterministically by IssueBridge backend logic</p>
              </div>

              <div>
                {draft.readiness_status === 'ready_for_review' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Ready for maintainer review
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Needs details before review
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {draft.readiness_checklist.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">{item.item}</span>
                    {renderStatusBadge(item.status)}
                  </div>
                  <p className="text-2xs text-slate-600 leading-normal">{item.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Primary Secondary Transfer Action */}
          <div className="p-6 rounded-xl bg-gradient-to-r from-indigo-900 to-purple-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <div>
              <h3 className="text-base font-bold">Ready to plan contributor implementation?</h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                Transfer this current edited draft directly to FirstPR to inspect actual repository files, implementation steps, and test checklists.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTransfer}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-indigo-900 font-bold text-xs hover:bg-indigo-50 shadow-sm transition-all hover:translate-x-0.5 flex-shrink-0 cursor-pointer"
            >
              Generate contributor plan
              <ArrowRight className="w-4 h-4 text-indigo-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
