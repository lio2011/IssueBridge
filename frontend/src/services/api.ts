import type {
  IssueInput,
  IssueDraft,
  ContributionPlanRequest,
  ContributionPlan,
  LLMHealthResponse,
  APIErrorResponse,
} from '../types';

export class AppApiError extends Error {
  code: string;
  requestId?: string;

  constructor(message: string, code: string, requestId?: string) {
    super(message);
    this.name = 'AppApiError';
    this.code = code;
    this.requestId = requestId;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorData: APIErrorResponse | null = null;
    try {
      errorData = await res.json();
    } catch {
      // not JSON
    }
    if (errorData?.error) {
      throw new AppApiError(
        errorData.error.message,
        errorData.error.code,
        errorData.error.request_id
      );
    }
    throw new AppApiError(
      `Request failed with HTTP status ${res.status}: ${res.statusText}`,
      'HTTP_ERROR'
    );
  }
  return res.json();
}

export async function fetchLLMHealth(): Promise<LLMHealthResponse> {
  try {
    const res = await fetch('/api/health/llm');
    return await handleResponse<LLMHealthResponse>(res);
  } catch (err: any) {
    return {
      status: 'ollama_unavailable',
      provider: 'ollama',
      model: 'gemma4:e4b',
      endpoint: 'http://127.0.0.1:11434',
      details: err.message || 'Cannot connect to backend or Ollama.',
      available_models: [],
    };
  }
}

export async function analyzeIssue(input: IssueInput): Promise<IssueDraft> {
  const res = await fetch('/api/issues/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<IssueDraft>(res);
}

export async function planContribution(
  req: ContributionPlanRequest
): Promise<ContributionPlan> {
  const res = await fetch('/api/contributions/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse<ContributionPlan>(res);
}
