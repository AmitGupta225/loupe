export type Severity = "HIGH" | "MEDIUM" | "LOW";

export type GroundingStatus = "VERIFIED_EXACT" | "CLAUSE_ANCHORED";

export interface ClauseNode {
  id: string;
  title: string;
  content: string;
  char_start: number;
  char_end: number;
  level: number;
  section_number: string;
  clause_type: string;
}

export interface RiskFinding {
  clause_id: string;
  title: string;
  category: string;
  severity: Severity;
  exact_quote: string;
  char_start: number;
  char_end: number;
  plain_english_explanation: string;
  worst_case_scenario: string;
  referenced_terms_used: string[];
  recommended_redline: string;
  grounding_status: GroundingStatus;
}

export interface ExecutivePosture {
  risk_score: number;
  risk_distribution: Record<string, number>;
  negotiation_priorities: string[];
  missing_protections: string[];
  verdict?: string;
  conclusion?: string;
  advice?: string;
}

export interface TraceEvent {
  node: string;
  started_at: number;
  completed_at: number;
  duration_ms: number;
  status: string;
  detail: string;
}

export interface AnalyzeRequest {
  raw_text: string;
  document_id?: string;
  title?: string;
}

export interface AnalyzeResponse {
  document_id: string;
  raw_text: string;
  clauses: ClauseNode[];
  defined_terms: Record<string, string>;
  flagged_clause_ids: string[];
  verified_findings: RiskFinding[];
  executive_summary: ExecutivePosture | null;
  execution_trace: TraceEvent[];
}

export interface HealthResponse {
  status: string;
  version: string;
  model: string;
  app_name: string;
}
