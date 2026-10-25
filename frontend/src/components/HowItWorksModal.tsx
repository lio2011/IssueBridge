import React from 'react';
import { X, ShieldCheck, Cpu, FileCode, CheckCircle } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">How IssueBridge Works</h2>
              <p className="text-xs text-slate-400">Architecture, Local AI & Contributor Workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-slate-700 text-sm">
          {/* Dual Workflow Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-indigo-50/70 border border-indigo-100">
              <div className="flex items-center gap-2 font-semibold text-indigo-950 text-sm mb-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                IssueSmith
              </div>
              <p className="text-xs text-indigo-900 leading-relaxed">
                Maintainers provide a rough bug report. IssueSmith fetches public repo context and prompts local Gemma 4 to produce an editable, structured issue draft, clarifying missing information and acceptance criteria.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-50/70 border border-purple-100">
              <div className="flex items-center gap-2 font-semibold text-purple-950 text-sm mb-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                FirstPR
              </div>
              <p className="text-xs text-purple-900 leading-relaxed">
                Contributors input an existing GitHub issue URL or seamlessly carry over an IssueSmith draft. FirstPR gathers real repository files via GitHub API and grounds Gemma 4 to produce verified file references, implementation steps, and test checklists.
              </p>
            </div>
          </div>

          {/* Core Technical Highlights */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Design Guarantees</h4>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900">100% Local Inference:</span> Runs Gemma 4 (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded">gemma4:e4b</code> or fallback <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">gemma4:e2b</code>) via local Ollama. No Gemini API key or external cloud LLM is used.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <FileCode className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900">Evidence ID Grounding:</span> Retrieved files receive strict internal IDs (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded">README</code>, <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">F1</code>, <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">F2</code>). Model responses are strictly validated so that only verified, existing GitHub file paths are ever presented.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900">Deterministic Readiness:</span> Objective checklist logic (problem clarity, reproduction steps, behavior, acceptance criteria) computed deterministically on the backend.
                </div>
              </div>
            </div>
          </div>

          {/* Notice */}
          <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 border border-slate-200">
            <strong>Honest Assistance:</strong> IssueBridge assists humans in understanding code and refining issues. It never claims generated suggestions are guaranteed correct, and does not automatically execute shell commands or publish issues to GitHub.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Got it, let's build!
          </button>
        </div>
      </div>
    </div>
  );
};
