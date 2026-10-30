import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentReader, buildSegments } from "../components/document/DocumentReader";
import type { ClauseNode, RiskFinding } from "../types/contract";
const clauses: ClauseNode[] = [
  {
    id: "c1",
    title: "Indemnification",
    content: "Provider shall indemnify Client for all losses",
    char_start: 0,
    char_end: 30,
    level: 1,
    section_number: "8.2",
    clause_type: "general",
  },
  {
    id: "c2",
    title: "Liability",
    content: "Liability shall not exceed fees",
    char_start: 31,
    char_end: 60,
    level: 1,
    section_number: "9.1",
    clause_type: "general",
  },
];
const findings: RiskFinding[] = [
  {
    clause_id: "c1",
    title: "Risk",
    category: "Indemnification",
    severity: "HIGH",
    exact_quote: "Provider shall indemnify",
    char_start: 0,
    char_end: 23,
    plain_english_explanation: "exp",
    worst_case_scenario: "worst",
    referenced_terms_used: [],
    recommended_redline: "fix",
    grounding_status: "VERIFIED_EXACT",
  },
];
describe("DocumentReader", () => {
  it("renders empty when no clauses", () => {
    render(<DocumentReader rawText="" clauses={[]} />);
    expect(screen.getByTestId("document-reader-empty")).toBeInTheDocument();
  });
  it("renders empty with preview", () => {
    render(<DocumentReader rawText="preview text long enough" clauses={[]} />);
    expect(screen.getByText(/preview text/)).toBeInTheDocument();
  });
  it("renders centered sheet with correct styling", () => {
    render(<DocumentReader rawText="contract text long" clauses={clauses} findings={findings} />);
    expect(screen.getByTestId("document-reader")).toBeInTheDocument();
    expect(screen.getByTestId("document-reader").innerHTML).toContain("max-w-[840px]");
    expect(screen.getByTestId("document-reader").innerHTML).toContain("bg-white");
    expect(screen.getByTestId("document-reader").innerHTML).toContain("rounded-lg");
    expect(screen.getByText(/2 clauses/)).toBeInTheDocument();
  });
  it("renders raw text without duplicated section headers", () => {
    const raw = "4.3 Limits on liability\\nContent here with unlimited damages.";
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[]} />);
    expect(screen.getByTestId("document-raw-text")).toHaveTextContent("4.3 Limits on liability");
    expect(screen.queryByText("\u00A7 4.3")).not.toBeInTheDocument();
    expect(screen.queryByText("Click highlighted clauses")).not.toBeInTheDocument();
  });
  it("highlights flagged word-range via char offsets", () => {
    const raw = "Provider shall indemnify Client for all losses and unlimited damages.";
    const f: RiskFinding = {
      ...findings[0],
      char_start: raw.indexOf("Provider shall indemnify"),
      char_end: raw.indexOf("Provider shall indemnify") + "Provider shall indemnify".length,
      exact_quote: "Provider shall indemnify",
    };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f]} />);
    const hl = screen.getByTestId("highlighted-c1");
    expect(hl).toBeInTheDocument();
    expect(hl).toHaveTextContent("Provider shall indemnify");
    expect(hl.className).toContain("bg-red-100");
    expect(hl.className).toContain("border-red-300");
    expect(screen.getByTestId("document-raw-text")).toHaveTextContent("unlimited damages");
  });
  it("supports two different highlights in one line with different severities", () => {
    const raw = "Provider shall indemnify Client and pay unlimited damages immediately.";
    const f1: RiskFinding = {
      ...findings[0],
      clause_id: "c1",
      severity: "HIGH",
      char_start: raw.indexOf("Provider shall indemnify"),
      char_end: raw.indexOf("Provider shall indemnify") + "Provider shall indemnify".length,
      exact_quote: "Provider shall indemnify",
    };
    const f2: RiskFinding = {
      clause_id: "c2",
      title: "Risk2",
      category: "Liability",
      severity: "HIGH",
      exact_quote: "unlimited damages",
      char_start: raw.indexOf("unlimited damages"),
      char_end: raw.indexOf("unlimited damages") + "unlimited damages".length,
      plain_english_explanation: "exp2",
      worst_case_scenario: "worst2",
      referenced_terms_used: [],
      recommended_redline: "fix2",
      grounding_status: "VERIFIED_EXACT",
    };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f1, f2]} />);
    expect(screen.getByTestId("highlighted-c1")).toHaveTextContent("Provider shall indemnify");
    expect(screen.getByTestId("highlighted-c2")).toHaveTextContent("unlimited damages");
    expect(screen.getByTestId("highlighted-c1").className).toContain("bg-red-100");
    expect(screen.getByTestId("highlighted-c2").className).toContain("bg-red-100");
  });
  it("does not highlight unflagged", () => {
    const raw = "plain text without risk";
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[]} />);
    expect(screen.queryByTestId("highlighted-c1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("highlighted-c2")).not.toBeInTheDocument();
  });
  it("calls onSelectClause and onJumpToAudit when highlighted clicked", () => {
    const raw = "Provider shall indemnify Client";
    const fn = vi.fn();
    const jump = vi.fn();
    render(<DocumentReader rawText={raw} clauses={clauses} findings={findings} onSelectClause={fn} onJumpToAudit={jump} />);
    fireEvent.click(screen.getByTestId("highlighted-c1"));
    expect(fn).toHaveBeenCalledWith("c1");
    expect(jump).toHaveBeenCalledWith("c1");
  });
  it("handles selectedClauseId with ring highlight", () => {
    const raw = "Provider shall indemnify Client";
    render(<DocumentReader rawText={raw} clauses={clauses} findings={findings} selectedClauseId="c1" />);
    expect(screen.getByTestId("highlighted-c1").className).toContain("ring-2");
  });
  it("registers refs for each highlight", () => {
    const raw = "Provider shall indemnify Client";
    const reg = vi.fn();
    render(<DocumentReader rawText={raw} clauses={clauses} findings={findings} registerClauseRef={reg} />);
    expect(reg).toHaveBeenCalled();
    expect(reg).toHaveBeenCalledWith("c1", expect.anything());
  });
  it("handles no findings", () => {
    render(<DocumentReader rawText="x" clauses={clauses} />);
    expect(screen.queryByTestId("highlighted-c1")).not.toBeInTheDocument();
  });
  it("highlights with correct severity colors", () => {
    const raw = "Provider shall indemnify Client";
    const high: RiskFinding[] = [{ ...findings[0], severity: "HIGH" }];
    const { rerender } = render(<DocumentReader rawText={raw} clauses={clauses} findings={high} />);
    expect(screen.getByTestId("highlighted-c1").className).toContain("bg-red-100");
    const med: RiskFinding[] = [{ ...findings[0], severity: "MEDIUM" }];
    rerender(<DocumentReader rawText={raw} clauses={clauses} findings={med} />);
    expect(screen.getByTestId("highlighted-c1").className).toContain("bg-orange-100");
    const low: RiskFinding[] = [{ ...findings[0], severity: "LOW" }];
    rerender(<DocumentReader rawText={raw} clauses={clauses} findings={low} />);
    expect(screen.getByTestId("highlighted-c1").className).toContain("bg-yellow-100");
  });
  it("falls back to exact_quote search when char offsets invalid", () => {
    const raw = "Hello world with Provider shall indemnify phrase";
    const f: RiskFinding = { ...findings[0], char_start: 999, char_end: 1000, exact_quote: "Provider shall indemnify" } as any;
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f]} />);
    expect(screen.getByTestId("highlighted-c1")).toHaveTextContent("Provider shall indemnify");
  });
  it("handles negative and out-of-bounds offsets with fallback", () => {
    const raw = "Hello world";
    const neg: RiskFinding = { ...findings[0], char_start: -5, char_end: 5, exact_quote: "Hello" };
    const { rerender } = render(<DocumentReader rawText={raw} clauses={clauses} findings={[neg]} />);
    expect(screen.getByTestId("highlighted-c1")).toBeInTheDocument();
    const beyond: RiskFinding = { ...findings[0], char_start: 0, char_end: 100, exact_quote: "Hello world" };
    rerender(<DocumentReader rawText={raw} clauses={clauses} findings={[beyond]} />);
    expect(screen.getByTestId("highlighted-c1")).toHaveTextContent("Hello world");
  });
  it("handles overlapping findings merging", () => {
    const raw = "Alpha Bravo Charlie";
    const f1: RiskFinding = { ...findings[0], clause_id: "c1", char_start: 0, char_end: 10, exact_quote: "Alpha Brav" };
    const f2: RiskFinding = { ...findings[0], clause_id: "c2", char_start: 5, char_end: 15, exact_quote: "a Bravo Ch" };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f1, f2]} />);
    expect(screen.getByTestId("highlighted-c1")).toBeInTheDocument();
    expect(screen.getByTestId("highlighted-c2")).toBeInTheDocument();
    expect(screen.getByTestId("document-raw-text").textContent).toContain("Alpha Bravo Charlie");
  });
  it("skips findings with invalid offsets and no quote", () => {
    const raw = "Hello world";
    const bad: RiskFinding = { ...findings[0], char_start: 999, char_end: 1000, exact_quote: "NotInText" };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[bad]} />);
    expect(screen.queryByTestId("highlighted-c1")).not.toBeInTheDocument();
  });
  it("skips finding when quote not in raw and offsets invalid", () => {
    const raw = "Hello world";
    const bad: RiskFinding = { ...findings[0], char_start: -1, char_end: 2, exact_quote: "NotThere" };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[bad]} />);
    expect(screen.queryByTestId("highlighted-c1")).not.toBeInTheDocument();
  });
  it("handles finding covering end without tail", () => {
    const raw = "Hello";
    const f: RiskFinding = { ...findings[0], char_start: 0, char_end: 5, exact_quote: "Hello" };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f]} />);
    expect(screen.getByTestId("document-raw-text").textContent).toBe("Hello");
    expect(screen.getByTestId("highlighted-c1")).toHaveTextContent("Hello");
  });
  it("handles fully overlapped finding skipped", () => {
    const raw = "Alpha Bravo Charlie Delta";
    const f1: RiskFinding = { ...findings[0], clause_id: "c1", char_start: 0, char_end: 11, exact_quote: "Alpha Bravo" };
    const f2: RiskFinding = { ...findings[0], clause_id: "c2", char_start: 2, char_end: 8, exact_quote: "pha Br" };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f1, f2]} />);
    expect(screen.getByTestId("highlighted-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("highlighted-c2")).not.toBeInTheDocument();
  });
  it("skips empty quote with invalid offsets", () => {
    const raw = "Hello";
    const f: RiskFinding = { ...findings[0], char_start: -1, char_end: -1, exact_quote: "" } as any;
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f]} />);
    expect(screen.queryByTestId("highlighted-c1")).not.toBeInTheDocument();
  });
  it("handles valid offsets with quote not in raw", () => {
    const raw = "Hello world";
    const f: RiskFinding = { ...findings[0], char_start: 0, char_end: 5, exact_quote: "XYZ" };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f]} />);
    expect(screen.getByTestId("highlighted-c1")).toHaveTextContent("Hello");
  });
  it("handles empty rawText with clauses", () => {
    render(<DocumentReader rawText="" clauses={clauses} findings={[]} />);
    expect(screen.getByTestId("document-raw-text")).toBeInTheDocument();
    expect(screen.getByTestId("document-raw-text").textContent).toBe("");
  });
  it("handles adjacent findings with exact boundary", () => {
    const raw = "HelloWorld";
    const f1: RiskFinding = { ...findings[0], clause_id: "c1", char_start: 0, char_end: 5, exact_quote: "Hello" };
    const f2: RiskFinding = { ...findings[0], clause_id: "c2", char_start: 5, char_end: 10, exact_quote: "World" };
    render(<DocumentReader rawText={raw} clauses={clauses} findings={[f1, f2]} />);
    expect(screen.getByTestId("highlighted-c1")).toBeInTheDocument();
    expect(screen.getByTestId("highlighted-c2")).toBeInTheDocument();
  });
  it("buildSegments handles edge cases directly", () => {
    expect(buildSegments("", [])).toEqual([]);
    expect(buildSegments("hello", [])[0].text).toBe("hello");
    const f1 = {
      clause_id: "c1",
      title: "t",
      category: "c",
      severity: "HIGH",
      exact_quote: "hi",
      char_start: 0,
      char_end: 2,
      plain_english_explanation: "e",
      worst_case_scenario: "w",
      referenced_terms_used: [],
      recommended_redline: "r",
      grounding_status: "VERIFIED_EXACT",
    } as any;
    const segs = buildSegments("hi there", [f1]);
    expect(segs.length).toBeGreaterThan(0);
    const f2 = { ...f1, clause_id: "c2", char_start: 0, char_end: 1, exact_quote: "h" } as any;
    const segs2 = buildSegments("hi", [f1, f2]);
    expect(segs2.length).toBeGreaterThan(0);
  });
});
