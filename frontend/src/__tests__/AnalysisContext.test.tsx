import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "../services/api";
import { AnalysisProvider, useAnalysis } from "../context/AnalysisContext";
vi.mock("../services/api");
function HookProbe() {
  const { handleUploadFile, handlePasteText, handleRestoreRecent, handleClearRecent, handleRemoveRecent, handleUrlSubmit, recentAnalyses, error, status, data } = useAnalysis();
  return (
    <div>
      <button data-testid="upload" onClick={() => handleUploadFile(new File(["x"], "x.txt"))}>upload</button>
      <button data-testid="paste" onClick={() => handlePasteText("hello paste")}>paste</button>
      <button data-testid="restore" onClick={() => handleRestoreRecent("doc-001")}>restore</button>
      <button data-testid="clear" onClick={() => handleClearRecent()}>clear</button>
      <button data-testid="remove" onClick={() => handleRemoveRecent("doc-001")}>remove</button>
      <button data-testid="url" onClick={() => handleUrlSubmit("https://example.com")}>url</button>
      <span data-testid="status">{status}</span>
      <span data-testid="recent-count">{recentAnalyses.length}</span>
      {error && <span data-testid="ctx-error">{error}</span>}
      {data && <span data-testid="ctx-data">{data.document_id}</span>}
    </div>
  );
}
describe("AnalysisContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.analyzeContract).mockResolvedValue({ document_id: "doc-001", raw_text: "text", clauses: [], defined_terms: {}, flagged_clause_ids: [], verified_findings: [], executive_summary: null, execution_trace: [] } as any);
    vi.mocked(api.analyzeUpload).mockResolvedValue({ document_id: "doc-001", raw_text: "text", clauses: [], defined_terms: {}, flagged_clause_ids: [], verified_findings: [], executive_summary: null, execution_trace: [] } as any);
    vi.mocked((api as any).analyzeUrl).mockResolvedValue({ document_id: "doc-001", raw_text: "text", clauses: [], defined_terms: {}, flagged_clause_ids: [], verified_findings: [], executive_summary: null, execution_trace: [] } as any);
  });
  it("provides context and handles upload/paste", async () => {
    render(<MemoryRouter><AnalysisProvider><HookProbe /></AnalysisProvider></MemoryRouter>);
    expect(screen.getByTestId("status")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("upload"));
    await waitFor(() => expect(api.analyzeUpload).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("paste"));
    await waitFor(() => expect(api.analyzeContract).toHaveBeenCalled());
  });
  it("throws when used outside provider", () => {
    function BadComponent() { useAnalysis(); return null; }
    expect(() => render(<BadComponent />)).toThrow("useAnalysis must be used within AnalysisProvider");
  });
  it("loads recent from localStorage on mount", async () => {
    const entry = { id: "doc-001", title: "doc-001", documentId: "doc-001", analyzedAt: new Date().toISOString(), clauseCount: 1, findingCount: 0, riskScore: null };
    localStorage.setItem("loupe:recent-analyses", JSON.stringify([entry]));
    render(<MemoryRouter><AnalysisProvider><HookProbe /></AnalysisProvider></MemoryRouter>);
    expect(screen.getByTestId("recent-count").textContent).toBe("1");
  });
  it("handles clear recent", async () => {
    const entry = { id: "doc-001", title: "doc-001", documentId: "doc-001", analyzedAt: new Date().toISOString(), clauseCount: 1, findingCount: 0, riskScore: null };
    localStorage.setItem("loupe:recent-analyses", JSON.stringify([entry]));
    render(<MemoryRouter><AnalysisProvider><HookProbe /></AnalysisProvider></MemoryRouter>);
    expect(screen.getByTestId("recent-count").textContent).toBe("1");
    fireEvent.click(screen.getByTestId("clear"));
    expect(screen.getByTestId("recent-count").textContent).toBe("0");
    expect(localStorage.getItem("loupe:recent-analyses")).toBeNull();
  });
  it("handles restore recent", async () => {
    const mockData = { document_id: "doc-001", raw_text: "stored text", clauses: [], defined_terms: {}, flagged_clause_ids: [], verified_findings: [], executive_summary: null, execution_trace: [] };
    const entry = { id: "doc-001", title: "doc-001", documentId: "doc-001", analyzedAt: new Date().toISOString(), clauseCount: 0, findingCount: 0, riskScore: null };
    localStorage.setItem("loupe:recent-analyses", JSON.stringify([entry]));
    localStorage.setItem("loupe:analysis:doc-001", JSON.stringify(mockData));
    render(<MemoryRouter><AnalysisProvider><HookProbe /></AnalysisProvider></MemoryRouter>);
    fireEvent.click(screen.getByTestId("restore"));
    await waitFor(() => expect(screen.getByTestId("ctx-data")).toHaveTextContent("doc-001"));
  });
  it("handles restore with missing stored data", async () => {
    render(<MemoryRouter><AnalysisProvider><HookProbe /></AnalysisProvider></MemoryRouter>);
    fireEvent.click(screen.getByTestId("restore"));
    expect(screen.getByTestId("recent-count").textContent).toBe("0");
  });
  it("persists recent after successful paste", async () => {
    render(<MemoryRouter><AnalysisProvider><HookProbe /></AnalysisProvider></MemoryRouter>);
    fireEvent.click(screen.getByTestId("paste"));
    await waitFor(() => expect(api.analyzeContract).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("recent-count").textContent).toBe("1"));
  });
  it("handles url submit", async () => {
    render(<MemoryRouter><AnalysisProvider><HookProbe /></AnalysisProvider></MemoryRouter>);
    fireEvent.click(screen.getByTestId("url"));
    await waitFor(() => expect((api as any).analyzeUrl).toHaveBeenCalledWith({ url: "https://example.com", document_id: undefined }));
  });
  it("handles remove recent", async () => {
    const entry = { id: "doc-001", title: "doc-001", documentId: "doc-001", analyzedAt: new Date().toISOString(), clauseCount: 1, findingCount: 0, riskScore: null };
    localStorage.setItem("loupe:recent-analyses", JSON.stringify([entry]));
    localStorage.setItem("loupe:analysis:doc-001", JSON.stringify({ document_id: "doc-001", raw_text: "t", clauses: [], defined_terms: {}, flagged_clause_ids: [], verified_findings: [], executive_summary: null, execution_trace: [] }));
    render(<MemoryRouter><AnalysisProvider><HookProbe /></AnalysisProvider></MemoryRouter>);
    expect(screen.getByTestId("recent-count").textContent).toBe("1");
    fireEvent.click(screen.getByTestId("remove"));
    expect(screen.getByTestId("recent-count").textContent).toBe("0");
    expect(localStorage.getItem("loupe:recent-analyses")).toBe(JSON.stringify([]));
  });
});
