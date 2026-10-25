export type IssueType = 'bug' | 'feature_request' | 'documentation' | 'other';

export type ReadinessStatus = 'needs_details' | 'ready_for_review';

export type ItemStatus = 'present' | 'missing' | 'needs_review' | 'not_applicable';

export interface MissingInformationItem {
  field: string;
  question: string;
  why_needed: string;
}

export interface ReadinessItem {
  item: string;
  status: ItemStatus;
  explanation: string;
}

export interface IssueInput {
  repo_url: string;
  raw_description: string;
  actual_behavior?: string;
  expected_behavior?: string;
  steps_to_reproduce?: string;
  environment?: string;
  additional_context?: string;
}

export interface IssueDraft {
  title: string;
  issue_type: IssueType;
  summary: string;
  markdown_body: string;
  acceptance_criteria: string[];
  suggested_labels: string[];
  missing_information: MissingInformationItem[];
  readiness_status: ReadinessStatus;
  readiness_checklist: ReadinessItem[];
}

export interface PlanDraftInput {
  title: string;
  markdown_body: string;
  acceptance_criteria: string[];
  additional_context?: string;
}

export interface ContributionPlanRequest {
  repo_url: string;
  issue_url?: string | null;
  draft?: PlanDraftInput | null;
}

export interface EvidenceReference {
  evidence_id: string;
  path: string;
  url: string;
  excerpt?: string;
  why_relevant?: string;
  what_to_inspect?: string;
}

export interface ImplementationStep {
  step_number: number;
  action: string;
  rationale: string;
  evidence_ids: string[];
  expected_outcome: string;
}

export interface SuggestedTest {
  test_type: 'existing' | 'suggested_new';
  description: string;
  target_file_or_module: string;
  expected_behavior: string;
  evidence_ids: string[];
}

export interface PRChecklistItem {
  item: string;
  completed: boolean;
  description?: string;
}

export interface DocLink {
  name: string;
  url: string;
}

export interface IssueSummarySection {
  title: string;
  repository_name: string;
  original_issue_url?: string | null;
  beginner_explanation: string;
  expected_outcome: string;
  acceptance_criteria: string[];
  unknowns: string[];
}

export interface RepositorySummarySection {
  description?: string | null;
  default_branch: string;
  readme_summary: string;
  contributing_summary?: string | null;
  setup_commands: string[];
  test_commands: string[];
  documentation_links: DocLink[];
}

export interface ContributionPlan {
  issue_summary: IssueSummarySection;
  repository_summary: RepositorySummarySection;
  relevant_files: EvidenceReference[];
  implementation_steps: ImplementationStep[];
  suggested_tests: SuggestedTest[];
  unknowns: string[];
  pr_checklist: PRChecklistItem[];
}

export interface LLMHealthResponse {
  status: 'ready' | 'ollama_unavailable' | 'model_not_found' | 'configuration_error';
  provider: string;
  model: string;
  endpoint: string;
  details: string;
  available_models: string[];
}

export interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}
