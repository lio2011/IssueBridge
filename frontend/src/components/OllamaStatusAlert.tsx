import React from 'react';
import type { LLMHealthResponse } from '../types';
import { AlertTriangle, Terminal, RefreshCw } from 'lucide-react';

interface OllamaStatusAlertProps {
  health: LLMHealthResponse | null;
  onRefresh: () => void;
  checking: boolean;
}

export const OllamaStatusAlert: React.FC<OllamaStatusAlertProps> = ({
  health,
  onRefresh,
  checking,
}) => {
  if (!health || health.status === 'ready') {
    return null;
  }

  const isUnavailable = health.status === 'ollama_unavailable';

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">
              {isUnavailable ? 'Local Ollama Service Unavailable' : `Model '${health.model}' Not Found`}
            </p>
            <p className="text-amber-700 text-xs mt-0.5">
              {isUnavailable ? (
                <>
                  IssueBridge requires a locally running Ollama instance at{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">
                    {health.endpoint}
                  </code>
                  . No cloud API key or hosted model is required.
                </>
              ) : (
                <>
                  Ollama is running, but the configured model{' '}
                  <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">
                    {health.model}
                  </code>{' '}
                  is not downloaded locally.
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-amber-800 font-medium">Run in terminal:</span>
              <code className="bg-slate-900 text-slate-100 px-2.5 py-1 rounded font-mono flex items-center gap-1.5 shadow-sm">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                {isUnavailable
                  ? 'ollama serve'
                  : `ollama pull ${health.model}`}
              </code>
              {isUnavailable && (
                <span className="text-amber-700 text-xs">
                  (then <code className="bg-slate-900 text-slate-100 px-2 py-0.5 rounded font-mono">ollama pull {health.model}</code>)
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={checking}
          className="self-end md:self-center inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          Recheck Ollama
        </button>
      </div>
    </div>
  );
};
