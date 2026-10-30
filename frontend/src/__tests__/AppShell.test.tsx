import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppShell } from "../components/layout/AppShell";
import { AnalysisProvider } from "../context/AnalysisContext";
import { ThemeProvider } from "../context/ThemeContext";
const mockData = {
  document_id: "doc-001",
  raw_text: "contract text for testing which is long enough to show details and clauses",
  clauses: [
    { id: "c1", title: "Indemnification", content: "Provider indemnifies Client", char_start: 0, char_end: 20, level: 1, section_number: "8.2", clause_type: "general" },
    { id: "c2", title: "Liability", content: "Liability cap", char_start: 21, char_end: 35, level: 1, section_number: "9.1", clause_type: "general" },
  ],
  defined_terms: { "Confidential Information": "definition" },
  flagged_clause_ids: ["c1"],
  verified_findings: [
    { clause_id: "c1", title: "Uncapped", category: "Indemnification", severity: "HIGH", exact_quote: "Provider indemnifies", char_start: 0, char_end: 20, plain_english_explanation: "exp", worst_case_scenario: "worst", referenced_terms_used: ["Term"], recommended_redline: "fix", grounding_status: "VERIFIED_EXACT" },
  ],
  executive_summary: { risk_score: 80, risk_distribution: { HIGH: 1 }, negotiation_priorities: ["cap"], missing_protections: ["mutual"] },
  execution_trace: [{ node: "structural_indexer", started_at: 1, completed_at: 2, duration_ms: 100, status: "completed", detail: "indexed" }],
};
const renderShell = (children = <AppShell />) => render(<ThemeProvider>{children}</ThemeProvider>);
describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  it("renders shell with intake when no document and no sidebar", async () => {
    render(<ThemeProvider><AnalysisProvider><AppShell /></AnalysisProvider></ThemeProvider>);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("upload-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("intake-view")).toBeInTheDocument();
    expect(screen.getByTestId("recent-analyses-section")).toBeInTheDocument();
  });
  it("shows error banner", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const reset = vi.fn();
    const ctxValue: any = { data: null, recentAnalyses: [], status: "error", error: "boom", handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), handleRemoveRecent: vi.fn(), handleUrlSubmit: vi.fn(), reset, selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(), analyzeUrl: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    expect(screen.getByTestId("intake-error")).toBeInTheDocument();
    expect(screen.getByTestId("intake-error")).toHaveTextContent("boom");
    expect(screen.queryByTestId("error-banner")).not.toBeInTheDocument();
  });
  it("shows error banner with document", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const reset = vi.fn();
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "error", error: "boom", handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), handleRemoveRecent: vi.fn(), handleUrlSubmit: vi.fn(), reset, selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(), analyzeUrl: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("dismiss-error"));
    expect(reset).toHaveBeenCalled();
  });
  it("shows no error initially", async () => {
    render(<ThemeProvider><AnalysisProvider><AppShell /></AnalysisProvider></ThemeProvider>);
    expect(screen.queryByTestId("error-banner")).not.toBeInTheDocument();
  });
  it("renders audit report when data present", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    expect(screen.getByTestId("review-matrix")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("nav-audit")).toBeInTheDocument();
    expect(screen.getByTestId("nav-document")).toHaveTextContent("Original document");
    expect(screen.getByTestId("nav-terms")).toHaveTextContent("Defined terms");
    expect(screen.queryByTestId("nav-trace")).not.toBeInTheDocument();
  });
  it("opens and closes mobile navigation", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handleUploadFiles: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), handleRemoveRecent: vi.fn(), handleUrlSubmit: vi.fn(), reset: vi.fn(), renameDocument: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(), analyzeUrl: vi.fn() };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    const toggle = screen.getByTestId("mobile-menu-toggle");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-label", "Close menu");
    fireEvent.click(screen.getAllByTestId("nav-terms")[0]);
    expect(toggle).toHaveAttribute("aria-label", "Open menu");
  });
  it("renders defined terms view", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    fireEvent.click(screen.getByTestId("nav-terms"));
    expect(screen.getByTestId("defined-terms-view")).toBeInTheDocument();
  });
  it("renders original document view", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    fireEvent.click(screen.getByTestId("nav-document"));
    expect(screen.getByTestId("document-reader")).toBeInTheDocument();
    expect(screen.getByTestId("document-reader")).toHaveTextContent("Original document");
  });
  it("handles review finding selection", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const selectClause = vi.fn();
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause, selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    fireEvent.click(screen.getByTestId("review-row-c1"));
    expect(screen.getByTestId("inspection-drawer")).toBeInTheDocument();
    expect(selectClause).toHaveBeenCalledWith("c1");
    fireEvent.click(screen.getByTestId("drawer-close"));
    expect(screen.queryByTestId("inspection-drawer")).not.toBeInTheDocument();
  });
  it("handles drawer jump to clause", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const selectClause = vi.fn();
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause, selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    fireEvent.click(screen.getByTestId("review-row-c1"));
    expect(screen.getByTestId("inspection-drawer")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("jump-to-clause"));
    expect(screen.getByTestId("document-reader")).toBeInTheDocument();
  });
  it("handles new contract", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const reset = vi.fn();
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset, selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    fireEvent.click(screen.getByTestId("new-contract-btn"));
    expect(reset).toHaveBeenCalled();
  });
  it("document reader click opens drawer", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const selectClause = vi.fn();
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause, selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    fireEvent.click(screen.getByTestId("nav-document"));
    expect(screen.getByTestId("document-reader")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("highlighted-c1"));
    expect(screen.getByTestId("inspection-drawer")).toBeInTheDocument();
  });
  it("blocks navigation when no document hides sidebar", async () => {
    render(<ThemeProvider><AnalysisProvider><AppShell /></AnalysisProvider></ThemeProvider>);
    expect(screen.getByTestId("intake-view")).toBeInTheDocument();
    expect(screen.getByTestId("upload-navbar")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-document")).not.toBeInTheDocument();
  });
  it("resets to intake when document cleared after navigation", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const ctxWithData: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    const spy = vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxWithData);
    const { rerender } = renderShell();
    expect(screen.getByTestId("review-matrix")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("nav-document"));
    expect(screen.getByTestId("document-reader")).toBeInTheDocument();
    const ctxNoData: any = { data: null, recentAnalyses: [], status: "idle", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), reset: vi.fn(), selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(),  };
    spy.mockReturnValue(ctxNoData);
    rerender(<ThemeProvider><AppShell /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("intake-view")).toBeInTheDocument());
    expect(screen.getByTestId("upload-navbar")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });
  it("allows renaming document title via click and blur", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const rename = vi.fn();
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), handleRemoveRecent: vi.fn(), handleUrlSubmit: vi.fn(), reset: vi.fn(), renameDocument: rename, selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(), analyzeUrl: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    const title = screen.getByTestId("editable-title");
    expect(title).toHaveTextContent("doc-001");
    fireEvent.click(title);
    const input = screen.getByTestId("title-input");
    fireEvent.change(input, { target: { value: "New Doc" } });
    fireEvent.blur(input);
    expect(rename).toHaveBeenCalledWith("New Doc");
  });
  it("handles rename via Enter and Escape", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const rename = vi.fn();
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), handleRemoveRecent: vi.fn(), handleUrlSubmit: vi.fn(), reset: vi.fn(), renameDocument: rename, selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(), analyzeUrl: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    fireEvent.click(screen.getByTestId("editable-title"));
    const input = screen.getByTestId("title-input");
    fireEvent.change(input, { target: { value: "Another Doc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(rename).toHaveBeenCalledWith("Another Doc");
    fireEvent.click(screen.getByTestId("editable-title"));
    const input2 = screen.getByTestId("title-input");
    fireEvent.keyDown(input2, { key: "Escape" });
    expect(screen.getByTestId("editable-title")).toBeInTheDocument();
  });
  it("reverts title when cleared", async () => {
    const MockCtx = await import("../context/AnalysisContext");
    const rename = vi.fn();
    const ctxValue: any = { data: mockData, recentAnalyses: [], status: "complete", error: null, handleUploadFile: vi.fn(), handlePasteText: vi.fn(), handleRestoreRecent: vi.fn(), handleClearRecent: vi.fn(), handleRemoveRecent: vi.fn(), handleUrlSubmit: vi.fn(), reset: vi.fn(), renameDocument: rename, selectedClauseId: null, selectedFindingId: null, selectClause: vi.fn(), selectFinding: vi.fn(), clearSelection: vi.fn(), scrollToClause: vi.fn(), registerClauseRef: vi.fn(), analyzeText: vi.fn(), analyzeFile: vi.fn(), analyzeUrl: vi.fn(),  };
    vi.spyOn(MockCtx, "useAnalysis").mockReturnValue(ctxValue);
    renderShell();
    fireEvent.click(screen.getByTestId("editable-title"));
    const input = screen.getByTestId("title-input");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(rename).not.toHaveBeenCalled();
    expect(screen.getByTestId("editable-title")).toHaveTextContent("doc-001");
  });
});
