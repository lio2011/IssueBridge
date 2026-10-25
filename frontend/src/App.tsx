import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { OllamaStatusAlert } from './components/OllamaStatusAlert';
import { HowItWorksModal } from './components/HowItWorksModal';
import { IssueSmithView } from './features/issue-smith/IssueSmithView';
import { FirstPRView } from './features/first-pr/FirstPRView';
import { fetchLLMHealth } from './services/api';
import type {
  IssueInput,
  IssueDraft,
  PlanDraftInput,
  ContributionPlan,
  LLMHealthResponse,
} from './types';
import { ShieldCheck } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'issue-smith' | 'first-pr'>('issue-smith');
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  // Local Ollama Health Status
  const [llmHealth, setLlmHealth] = useState<LLMHealthResponse | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);

  // IssueSmith saved state
  const [savedInput, setSavedInput] = useState<IssueInput | null>(null);
  const [savedDraft, setSavedDraft] = useState<IssueDraft | null>(null);

  // Transferred state to FirstPR
  const [transferredDraft, setTransferredDraft] = useState<{
    repo_url: string;
    draft: PlanDraftInput;
  } | null>(null);

  // FirstPR saved plan
  const [savedPlan, setSavedPlan] = useState<ContributionPlan | null>(null);

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const res = await fetchLLMHealth();
      setLlmHealth(res);
    } catch {
      // handled in fetchLLMHealth
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const handleTransferToFirstPR = (data: {
    repo_url: string;
    draft: PlanDraftInput;
  }) => {
    setTransferredDraft(data);
    setActiveTab('first-pr');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReturnToIssueSmith = () => {
    setActiveTab('issue-smith');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveIssueSmithState = (input: IssueInput, draft: IssueDraft) => {
    setSavedInput(input);
    setSavedDraft(draft);
  };

  const handleSavePlan = (plan: ContributionPlan) => {
    setSavedPlan(plan);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        llmHealth={llmHealth}
        checkingHealth={checkingHealth}
        onRefreshHealth={checkHealth}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
      />

      {/* Ollama Alert Banner */}
      <OllamaStatusAlert
        health={llmHealth}
        onRefresh={checkHealth}
        checking={checkingHealth}
      />

      {/* Main Workspace */}
      <main className="flex-1 pb-16">
        {activeTab === 'issue-smith' && (
          <IssueSmithView
            onTransferToFirstPR={handleTransferToFirstPR}
            savedDraft={savedDraft}
            savedInput={savedInput}
            onSaveState={handleSaveIssueSmithState}
          />
        )}

        {activeTab === 'first-pr' && (
          <FirstPRView
            transferredDraft={transferredDraft}
            onReturnToIssueSmith={handleReturnToIssueSmith}
            savedPlan={savedPlan}
            onSavePlan={handleSavePlan}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">IssueBridge</span>
            <span>—</span>
            <span>Local AI Developer Tool (Gemma 4 via Ollama + GitHub REST API)</span>
          </div>
          <div className="flex items-center gap-4 text-2xs">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              100% Private Local Inference
            </span>
            <span>•</span>
            <span>No Hosted LLM Keys Required</span>
          </div>
        </div>
      </footer>

      {/* How It Works Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />
    </div>
  );
}

export default App;
