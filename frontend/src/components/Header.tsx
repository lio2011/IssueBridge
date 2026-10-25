import React from 'react';
import type { LLMHealthResponse } from '../types';
import { Sparkles, BookOpen, CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react';

interface HeaderProps {
  activeTab: 'issue-smith' | 'first-pr';
  setActiveTab: (tab: 'issue-smith' | 'first-pr') => void;
  llmHealth: LLMHealthResponse | null;
  checkingHealth: boolean;
  onRefreshHealth: () => void;
  onOpenHowItWorks: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  llmHealth,
  checkingHealth,
  onRefreshHealth,
  onOpenHowItWorks,
}) => {
  const getStatusBadge = () => {
    if (checkingHealth) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
          Checking local runtime...
        </span>
      );
    }
    if (!llmHealth || llmHealth.status === 'ollama_unavailable') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-950/80 text-red-300 border border-red-800 cursor-pointer hover:bg-red-900/90 transition-colors"
          onClick={onRefreshHealth}
          title="Ollama is not responding at http://127.0.0.1:11434. Click to recheck."
        >
          <XCircle className="w-3 h-3 text-red-400" />
          Ollama Offline
        </span>
      );
    }
    if (llmHealth.status === 'model_not_found') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800 cursor-pointer hover:bg-amber-900/90 transition-colors"
          onClick={onRefreshHealth}
          title={`Ollama running, but model '${llmHealth.model}' is not pulled.`}
        >
          <AlertCircle className="w-3 h-3 text-amber-400" />
          Model Missing ({llmHealth.model})
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800"
        title={`Connected to local Ollama running ${llmHealth.model}`}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        Local AI: {llmHealth.model}
      </span>
    );
  };

  return (
    <header className="bg-slate-950 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('issue-smith')}>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-900/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  IssueBridge
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs text-slate-400 font-normal">
                  Open-Source Workflow Bridge
                </span>
              </div>
            </div>

            {/* Workflow Navigation */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('issue-smith')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'issue-smith'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-300" />
                IssueSmith — Improve an Issue
              </button>
              <button
                onClick={() => setActiveTab('first-pr')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'first-pr'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-300" />
                FirstPR — Explore an Issue
              </button>
            </nav>
          </div>

          {/* Right Action Utilities */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenHowItWorks}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">How It Works</span>
            </button>

            {getStatusBadge()}
          </div>
        </div>
      </div>

      {/* Mobile Workflow Tabs */}
      <div className="md:hidden flex border-t border-slate-800 bg-slate-900/90 px-4 py-2 gap-2">
        <button
          onClick={() => setActiveTab('issue-smith')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
            activeTab === 'issue-smith'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          IssueSmith
        </button>
        <button
          onClick={() => setActiveTab('first-pr')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center cursor-pointer ${
            activeTab === 'first-pr'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          FirstPR
        </button>
      </div>
    </header>
  );
};
