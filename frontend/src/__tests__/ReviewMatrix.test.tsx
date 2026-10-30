import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewMatrix } from "../components/review/ReviewMatrix";
import type { AnalyzeResponse } from "../types/contract";
const mockData: AnalyzeResponse = {
  document_id: "Test Agreement",
  raw_text: "contract text",
  clauses: [
    {
      id: "c1",
      title: "Indemnification",
      content: "Provider indemnifies",
      char_start: 0,
      char_end: 20,
      level: 1,
      section_number: "8.2",
      clause_type: "general",
    },
    { id: "c2", title: "Liability", content: "Liability cap", char_start: 21, char_end: 35, level: 1, section_number: "9.1", clause_type: "general" },
    { id: "c3", title: "Termination", content: "Termination clause", char_start: 36, char_end: 50, level: 1, section_number: "4", clause_type: "general" },
  ],
  defined_terms: { "Confidential Information": "def" },
  flagged_clause_ids: ["c1"],
  verified_findings: [
    {
      clause_id: "c1",
      title: "Uncapped indemnity",
      category: "Indemnification",
      severity: "HIGH",
      exact_quote: "Provider indemnifies",
      char_start: 0,
      char_end: 20,
      plain_english_explanation: "This exposes you to unlimited liability",
      worst_case_scenario: "Bankruptcy",
      referenced_terms_used: [],
      recommended_redline: "fix",
      grounding_status: "VERIFIED_EXACT",
    },
    {
      clause_id: "c2",
      title: "Low cap",
      category: "Liability",
      severity: "HIGH",
      exact_quote: "Liability cap",
      char_start: 21,
      char_end: 35,
      plain_english_explanation: "Cap is too low",
      worst_case_scenario: "Loss",
      referenced_terms_used: [],
      recommended_redline: "fix2",
      grounding_status: "VERIFIED_EXACT",
    },
    {
      clause_id: "c3",
      title: "Medium risk",
      category: "Termination",
      severity: "MEDIUM",
      exact_quote: "Termination clause",
      char_start: 36,
      char_end: 50,
      plain_english_explanation: "Medium exposure",
      worst_case_scenario: "Delay",
      referenced_terms_used: [],
      recommended_redline: "fix3",
      grounding_status: "VERIFIED_EXACT",
    },
  ],
  executive_summary: { risk_score: 75, risk_distribution: { HIGH: 1 }, negotiation_priorities: ["Add cap"], missing_protections: ["Mutual indemnity"] },
  execution_trace: [],
};
describe("ReviewMatrix", () => {
  it("renders header with sentence case", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("review-matrix")).toBeInTheDocument();
    expect(screen.getByText("Test Agreement")).toBeInTheDocument();
    expect(screen.getByTestId("risk-gauge")).toBeInTheDocument();
  });
  it("renders filter bar", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("filter-bar")).toBeInTheDocument();
    expect(screen.getByTestId("filter-all")).toHaveTextContent("All findings");
    expect(screen.getByTestId("filter-high")).toHaveTextContent("High");
    expect(screen.getByTestId("filter-medium")).toHaveTextContent("Medium");
    expect(screen.getByTestId("filter-low")).toHaveTextContent("Low");
    expect(screen.getByTestId("review-search")).toBeInTheDocument();
  });
  it("renders table with correct headers", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("review-table")).toBeInTheDocument();
    expect(screen.getByTestId("risk-gauge")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-label")).toBeInTheDocument();
    expect(screen.getByText("Overall Analysis")).toBeInTheDocument();
    expect(screen.getByText("Missing standard protections")).toBeInTheDocument();
    expect(screen.getByTestId("review-table").className).toContain("space-y-4");
  });
  it("renders rows with correct data", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("review-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("risk-level-c1")).toHaveTextContent("High");

    expect(screen.getByTestId("review-row-c1")).toHaveTextContent("Indemnification");
    expect(screen.getByText("This exposes you to unlimited liability")).toBeInTheDocument();
    expect(screen.getByTestId("quote-c1")).toBeInTheDocument();
  });
  it("shows high and medium labels correctly", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("risk-level-c2")).toHaveTextContent("High");
    expect(screen.getByTestId("risk-level-c3")).toHaveTextContent("Medium");
  });
  it("calls onSelectFinding when row clicked", () => {
    const fn = vi.fn();
    render(<ReviewMatrix data={mockData} onSelectFinding={fn} />);
    fireEvent.click(screen.getByTestId("review-row-c1"));
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ clause_id: "c1" }));
  });
  it("highlights selected row", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} selectedFindingId="c2" />);
    expect(screen.getByTestId("review-row-c2").className).toContain("border-zinc-900");
  });
  it("filters critical", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    fireEvent.click(screen.getByTestId("filter-high"));
    expect(screen.getByTestId("review-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("review-row-c2")).toBeInTheDocument();
  });
  it("filters high", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    fireEvent.click(screen.getByTestId("filter-high"));
    expect(screen.getByTestId("review-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("review-row-c2")).toBeInTheDocument();
    expect(screen.queryByTestId("review-row-c3")).not.toBeInTheDocument();
  });
  it("filters medium", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    fireEvent.click(screen.getByTestId("filter-medium"));
    expect(screen.getByTestId("review-row-c3")).toBeInTheDocument();
    expect(screen.queryByTestId("review-row-c1")).not.toBeInTheDocument();
  });
  it("search filters", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    const input = screen.getByTestId("review-search");
    fireEvent.change(input, { target: { value: "uncapped" } });
    expect(screen.getByTestId("review-row-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("review-row-c2")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("No findings match filter")).toBeInTheDocument();
  });
  it("renders missing protections always visible", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("missing-protections")).toBeInTheDocument();
    expect(screen.getByText("Mutual indemnity")).toBeInTheDocument();
    expect(screen.getByTestId("missing-content")).toBeInTheDocument();
  });
  it("shows no missing protections", () => {
    const dataNoMissing = { ...mockData, executive_summary: { ...mockData.executive_summary!, missing_protections: [] } };
    render(<ReviewMatrix data={dataNoMissing} onSelectFinding={vi.fn()} />);
    expect(screen.getByText("No missing protections detected")).toBeInTheDocument();
  });
  it("renders executive posture always visible", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("executive-posture")).toBeInTheDocument();
    expect(screen.getByTestId("posture-score")).toHaveTextContent("Risk score: 75/100");
    expect(screen.getByTestId("posture-content")).toBeInTheDocument();
  });
  it("handles no executive summary", () => {
    const noSummary = { ...mockData, executive_summary: null };
    render(<ReviewMatrix data={noSummary} onSelectFinding={vi.fn()} />);
    expect(screen.getByText("No posture available")).toBeInTheDocument();
  });
  it("handles empty findings", () => {
    const empty = { ...mockData, verified_findings: [] };
    render(<ReviewMatrix data={empty} onSelectFinding={vi.fn()} />);
    expect(screen.getByText("No findings match filter")).toBeInTheDocument();
  });
  it("filters all returns all", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    fireEvent.click(screen.getByTestId("filter-high"));
    fireEvent.click(screen.getByTestId("filter-all"));
    expect(screen.getByTestId("review-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("review-row-c2")).toBeInTheDocument();
  });
  it("renders low severity correctly", () => {
    const lowData: AnalyzeResponse = {
      ...mockData,
      clauses: [
        ...mockData.clauses,
        { id: "c4", title: "Payment", content: "Pay fees", char_start: 51, char_end: 60, level: 1, section_number: "5", clause_type: "general" },
      ],
      verified_findings: [
        ...mockData.verified_findings,
        {
          clause_id: "c4",
          title: "Low risk",
          category: "Payment",
          severity: "LOW",
          exact_quote: "Pay fees",
          char_start: 51,
          char_end: 60,
          plain_english_explanation: "Low",
          worst_case_scenario: "Low",
          referenced_terms_used: [],
          recommended_redline: "fix",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    render(<ReviewMatrix data={lowData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("risk-level-c4")).toHaveTextContent("Low");
  });
  it("handles missing clause fallback", () => {
    const missingClauseData: AnalyzeResponse = {
      ...mockData,
      clauses: [],
      verified_findings: [
        {
          clause_id: "missing-id",
          title: "Fallback title",
          category: "Test",
          severity: "LOW",
          exact_quote: "quote",
          char_start: 0,
          char_end: 5,
          plain_english_explanation: "exp",
          worst_case_scenario: "worst",
          referenced_terms_used: [],
          recommended_redline: "fix",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    render(<ReviewMatrix data={missingClauseData} onSelectFinding={vi.fn()} />);
    expect(screen.getByText("Fallback title")).toBeInTheDocument();
    expect(screen.getByTestId("quote-missing-id")).toHaveTextContent("quote");
  });
  it("renders severity backgrounds correctly", () => {
    const sevData: AnalyzeResponse = {
      ...mockData,
      verified_findings: [
        {
          clause_id: "c1",
          title: "Critical",
          category: "Cat",
          severity: "HIGH",
          exact_quote: "q1",
          char_start: 0,
          char_end: 2,
          plain_english_explanation: "e",
          worst_case_scenario: "w",
          referenced_terms_used: [],
          recommended_redline: "r",
          grounding_status: "VERIFIED_EXACT",
        },
        {
          clause_id: "c2",
          title: "High",
          category: "Cat",
          severity: "HIGH",
          exact_quote: "q2",
          char_start: 3,
          char_end: 5,
          plain_english_explanation: "e",
          worst_case_scenario: "w",
          referenced_terms_used: [],
          recommended_redline: "r",
          grounding_status: "VERIFIED_EXACT",
        },
        {
          clause_id: "c3",
          title: "Medium",
          category: "Cat",
          severity: "MEDIUM",
          exact_quote: "q3",
          char_start: 6,
          char_end: 8,
          plain_english_explanation: "e",
          worst_case_scenario: "w",
          referenced_terms_used: [],
          recommended_redline: "r",
          grounding_status: "VERIFIED_EXACT",
        },
        {
          clause_id: "c4",
          title: "Low",
          category: "Cat",
          severity: "LOW",
          exact_quote: "q4",
          char_start: 9,
          char_end: 11,
          plain_english_explanation: "e",
          worst_case_scenario: "w",
          referenced_terms_used: [],
          recommended_redline: "r",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    render(<ReviewMatrix data={sevData} onSelectFinding={vi.fn()} />);
    expect(screen.getByTestId("risk-level-c1")).toBeInTheDocument();
    expect(screen.getByTestId("risk-level-c2")).toBeInTheDocument();
    expect(screen.getByTestId("risk-level-c3")).toBeInTheDocument();
    expect(screen.getByTestId("risk-level-c4")).toBeInTheDocument();
    expect(screen.getByTestId("quote-c1").style.background).toContain("rgb");
    expect(screen.getByTestId("quote-c4").style.background).toContain("rgb");
  });
  it("calls onJumpToClause via quote click", () => {
    const jump = vi.fn();
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} onJumpToClause={jump} />);
    fireEvent.click(screen.getByTestId("quote-c1"));
    expect(jump).toHaveBeenCalledWith("c1");
  });
  it("calls onJumpToClause via inspect button", () => {
    const jump = vi.fn();
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} onJumpToClause={jump} />);
    fireEvent.click(screen.getByTestId("quote-c1"));
    expect(jump).toHaveBeenCalledWith("c1");
  });
  it("filters low", () => {
    render(<ReviewMatrix data={mockData} onSelectFinding={vi.fn()} />);
    fireEvent.click(screen.getByTestId("filter-low"));
    expect(screen.queryByTestId("review-row-c1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-row-c2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-row-c3")).not.toBeInTheDocument();
  });
  it("filters low shows low when present", () => {
    const lowData: AnalyzeResponse = {
      ...mockData,
      clauses: [
        ...mockData.clauses,
        { id: "c4", title: "Payment", content: "Pay fees", char_start: 51, char_end: 60, level: 1, section_number: "5", clause_type: "general" },
      ],
      verified_findings: [
        ...mockData.verified_findings,
        {
          clause_id: "c4",
          title: "Low risk",
          category: "Payment",
          severity: "LOW",
          exact_quote: "Pay fees",
          char_start: 51,
          char_end: 60,
          plain_english_explanation: "Low",
          worst_case_scenario: "Low",
          referenced_terms_used: [],
          recommended_redline: "fix",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    render(<ReviewMatrix data={lowData} onSelectFinding={vi.fn()} />);
    fireEvent.click(screen.getByTestId("filter-low"));
    expect(screen.getByTestId("review-row-c4")).toBeInTheDocument();
    expect(screen.queryByTestId("review-row-c1")).not.toBeInTheDocument();
  });
});
