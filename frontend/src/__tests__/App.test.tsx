import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import * as api from "../services/api";
vi.mock("../services/api");
const mockAnalyzeResponse = {
  document_id: "doc-001",
  raw_text: "contract text for audit which is long enough to show excerpt and clauses",
  clauses: [
    { id: "clause-1", title: "Indemnification", content: "Provider indemnifies", char_start: 0, char_end: 20, level: 1, section_number: "8.2", clause_type: "general" },
    { id: "clause-2", title: "Liability", content: "Liability cap", char_start: 21, char_end: 35, level: 1, section_number: "9.1", clause_type: "general" },
  ],
  defined_terms: { "Confidential Information": "definition" },
  flagged_clause_ids: ["clause-1"],
  verified_findings: [
    { clause_id: "clause-1", title: "Uncapped", category: "Indemnification", severity: "HIGH", exact_quote: "Provider indemnifies", char_start: 0, char_end: 20, plain_english_explanation: "exp", worst_case_scenario: "worst", referenced_terms_used: [], recommended_redline: "fix", grounding_status: "VERIFIED_EXACT" },
  ],
  executive_summary: { risk_score: 80, risk_distribution: { HIGH: 1 }, negotiation_priorities: ["cap"], missing_protections: ["mutual"] },
  execution_trace: [{ node: "structural_indexer", started_at: 1, completed_at: 2, duration_ms: 100, status: "completed", detail: "indexed" }],
};
describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  it("renders app shell and intake without sidebar initially", () => {
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("upload-navbar")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("intake-view")).toBeInTheDocument();
    expect(screen.queryByTestId("brand-wordmark")).not.toBeInTheDocument();
  });
  it("shows intake view initially with recent analyses section", () => {
    render(<App />);
    expect(screen.getByTestId("intake-view")).toBeInTheDocument();
    expect(screen.getByText("Understand your contract before you sign it")).toBeInTheDocument();
    expect(screen.getByTestId("tab-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("upload-dropzone")).toBeInTheDocument();
    expect(screen.getByTestId("recent-analyses-section")).toBeInTheDocument();
    expect(screen.getByText("Recent analyses")).toBeInTheDocument();
    expect(screen.getByTestId("recent-empty")).toBeInTheDocument();
  });
  it("switches tabs in intake", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    expect(screen.getByTestId("paste-panel")).toBeInTheDocument();
    expect(screen.getByTestId("paste-textarea")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-upload"));
    expect(screen.getByTestId("upload-dropzone")).toBeInTheDocument();
  });
  it("pastes text and shows audit report", async () => {
    vi.mocked(api.analyzeContract).mockResolvedValue(mockAnalyzeResponse as any);
    render(<App />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    await userEvent.type(screen.getByTestId("paste-textarea"), "doc view test");
    fireEvent.click(screen.getByTestId("analyze-contract-btn"));
    expect(await screen.findByTestId("review-matrix")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("nav-audit")).toBeInTheDocument();
    expect(screen.getByTestId("nav-audit")).toHaveTextContent("Audit report");
  });
  it("uploads file and shows audit", async () => {
    vi.mocked(api.analyzeUpload).mockResolvedValue(mockAnalyzeResponse as any);
    render(<App />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    await userEvent.upload(input, file);
    await waitFor(() => expect(api.analyzeUpload).toHaveBeenCalled());
    expect(await screen.findByTestId("review-matrix")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });
  it("restores recent analysis from localStorage", async () => {
    const entry = { id: "doc-001", title: "doc-001", documentId: "doc-001", analyzedAt: new Date().toISOString(), clauseCount: 2, findingCount: 1, riskScore: 80 };
    localStorage.setItem("loupe:recent-analyses", JSON.stringify([entry]));
    localStorage.setItem("loupe:analysis:doc-001", JSON.stringify(mockAnalyzeResponse));
    render(<App />);
    expect(screen.getByTestId("recent-card-doc-001")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("recent-open-doc-001"));
    expect(await screen.findByTestId("review-matrix")).toBeInTheDocument();
  });
  it("clears recent analyses", async () => {
    const entry = { id: "doc-001", title: "doc-001", documentId: "doc-001", analyzedAt: new Date().toISOString(), clauseCount: 2, findingCount: 1, riskScore: 80 };
    localStorage.setItem("loupe:recent-analyses", JSON.stringify([entry]));
    localStorage.setItem("loupe:analysis:doc-001", JSON.stringify(mockAnalyzeResponse));
    render(<App />);
    expect(screen.getByTestId("recent-card-doc-001")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("clear-recent-btn"));
    expect(screen.getByTestId("recent-empty")).toBeInTheDocument();
    expect(localStorage.getItem("loupe:recent-analyses")).toBeNull();
  });
  it("navigates to original document", async () => {
    vi.mocked(api.analyzeContract).mockResolvedValue(mockAnalyzeResponse as any);
    render(<App />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    await userEvent.type(screen.getByTestId("paste-textarea"), "doc view test");
    fireEvent.click(screen.getByTestId("analyze-contract-btn"));
    await screen.findByTestId("review-matrix");
    fireEvent.click(screen.getByTestId("nav-document"));
    expect(screen.getByTestId("document-reader")).toBeInTheDocument();
    expect(screen.getByTestId("document-reader")).toHaveTextContent("Original document");
  });
  it("opens drawer from audit report", async () => {
    vi.mocked(api.analyzeContract).mockResolvedValue(mockAnalyzeResponse as any);
    render(<App />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    await userEvent.type(screen.getByTestId("paste-textarea"), "drawer test");
    fireEvent.click(screen.getByTestId("analyze-contract-btn"));
    await screen.findByTestId("review-matrix");
    fireEvent.click(screen.getByTestId("review-row-clause-1"));
    expect(screen.getByTestId("inspection-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-quote")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("drawer-close"));
    expect(screen.queryByTestId("inspection-drawer")).not.toBeInTheDocument();
  });
  it("shows error banner on failure", async () => {
    vi.mocked(api.analyzeContract).mockRejectedValue(new Error("analysis failed"));
    render(<App />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    await userEvent.type(screen.getByTestId("paste-textarea"), "error trigger");
    fireEvent.click(screen.getByTestId("analyze-contract-btn"));
    expect(await screen.findByTestId("intake-error")).toBeInTheDocument();
    expect(screen.getByTestId("intake-error")).toHaveTextContent("analysis failed");
  });
  it("new contract returns to intake and hides sidebar", async () => {
    vi.mocked(api.analyzeContract).mockResolvedValue(mockAnalyzeResponse as any);
    render(<App />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    await userEvent.type(screen.getByTestId("paste-textarea"), "new contract test");
    fireEvent.click(screen.getByTestId("analyze-contract-btn"));
    await screen.findByTestId("review-matrix");
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("new-contract-btn"));
    expect(screen.getByTestId("intake-view")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });
  it("persists recent analysis to localStorage after successful analyze", async () => {
    vi.mocked(api.analyzeContract).mockResolvedValue(mockAnalyzeResponse as any);
    render(<App />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    await userEvent.type(screen.getByTestId("paste-textarea"), "persist test");
    fireEvent.click(screen.getByTestId("analyze-contract-btn"));
    await screen.findByTestId("review-matrix");
    const stored = JSON.parse(localStorage.getItem("loupe:recent-analyses") || "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe("doc-001");
    expect(stored[0].title).toBe("doc-001");
    expect(localStorage.getItem("loupe:analysis:doc-001")).toBeTruthy();
  });
});
