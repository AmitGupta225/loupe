import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalyzeResponse } from "../types/contract";

const { mockSave, mockAddPage, mockText, mockRect, mockSetFillColor, mockSetTextColor, mockSetFont, mockSetFontSize, mockSplitTextToSize, mockGetTextWidth } =
  vi.hoisted(() => ({
    mockSave: vi.fn(),
    mockAddPage: vi.fn(),
    mockText: vi.fn(),
    mockRect: vi.fn(),
    mockSetFillColor: vi.fn(),
    mockSetTextColor: vi.fn(),
    mockSetFont: vi.fn(),
    mockSetFontSize: vi.fn(),
    mockSplitTextToSize: vi.fn((t: string) => [t]),
    mockGetTextWidth: vi.fn(() => 20),
  }));

vi.mock("jspdf", () => ({
  default: class MockJspdf {
    internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    setFont = mockSetFont;
    setFontSize = mockSetFontSize;
    setTextColor = mockSetTextColor;
    setFillColor = mockSetFillColor;
    text = mockText;
    rect = mockRect;
    splitTextToSize = mockSplitTextToSize;
    addPage = mockAddPage;
    save = mockSave;
    getTextWidth = mockGetTextWidth;
  },
}));

import { exportAnalysisJson, exportAnalysisPdf } from "../services/export";

const mockData: AnalyzeResponse = {
  document_id: "doc-001",
  raw_text: "clause text",
  clauses: [
    {
      id: "c1",
      title: "Indemnification",
      content: "Provider shall indemnify",
      char_start: 0,
      char_end: 10,
      level: 1,
      section_number: "1",
      clause_type: "general",
    },
    { id: "c2", title: "Liability", content: "Liability cap", char_start: 11, char_end: 20, level: 1, section_number: "2", clause_type: "general" },
    { id: "c3", title: "Payment", content: "Pay within 30 days", char_start: 21, char_end: 30, level: 1, section_number: "3", clause_type: "general" },
    {
      id: "c4",
      title: "Termination",
      content: "Either party may terminate",
      char_start: 31,
      char_end: 40,
      level: 1,
      section_number: "4",
      clause_type: "general",
    },
  ],
  defined_terms: {},
  flagged_clause_ids: ["c1", "c2", "c3", "c4"],
  verified_findings: [
    {
      clause_id: "c1",
      title: "Indemnification Risk",
      category: "Indemnification",
      severity: "HIGH",
      exact_quote: "indemnify",
      char_start: 0,
      char_end: 9,
      plain_english_explanation: "exp",
      worst_case_scenario: "worst",
      referenced_terms_used: [],
      recommended_redline: "fix",
      grounding_status: "VERIFIED_EXACT",
    },
    {
      clause_id: "c2",
      title: "Liability Risk",
      category: "Liability",
      severity: "HIGH",
      exact_quote: "cap",
      char_start: 0,
      char_end: 3,
      plain_english_explanation: "exp2",
      worst_case_scenario: "worst2",
      referenced_terms_used: [],
      recommended_redline: "fix2",
      grounding_status: "VERIFIED_EXACT",
    },
    {
      clause_id: "c3",
      title: "Payment Risk",
      category: "Payment",
      severity: "MEDIUM",
      exact_quote: "pay",
      char_start: 0,
      char_end: 3,
      plain_english_explanation: "exp3",
      worst_case_scenario: "worst3",
      referenced_terms_used: [],
      recommended_redline: "fix3",
      grounding_status: "VERIFIED_EXACT",
    },
    {
      clause_id: "c4",
      title: "Termination Risk",
      category: "Termination",
      severity: "LOW",
      exact_quote: "terminate",
      char_start: 0,
      char_end: 9,
      plain_english_explanation: "exp4",
      worst_case_scenario: "worst4",
      referenced_terms_used: [],
      recommended_redline: "fix4",
      grounding_status: "VERIFIED_EXACT",
    },
  ],
  executive_summary: { risk_score: 80, risk_distribution: { HIGH: 1 }, negotiation_priorities: ["cap", "indemnity"], missing_protections: ["mutual cap"] },
  execution_trace: [],
};

describe("export service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("exports json", () => {
    const createUrl = vi.fn(() => "blob:url");
    const revoke = vi.fn();
    // @ts-ignore
    global.URL.createObjectURL = createUrl;
    // @ts-ignore
    global.URL.revokeObjectURL = revoke;
    const click = vi.fn();
    const a = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(a as any);
    exportAnalysisJson(mockData);
    expect(createUrl).toHaveBeenCalled();
    expect(a.download).toBe("doc-001.json");
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:url");
  });
  it("exports json with fallback filename", () => {
    const createUrl = vi.fn(() => "blob:url");
    const revoke = vi.fn();
    // @ts-ignore
    global.URL.createObjectURL = createUrl;
    // @ts-ignore
    global.URL.revokeObjectURL = revoke;
    const click = vi.fn();
    const a = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(a as any);
    const dataEmpty: AnalyzeResponse = { ...mockData, document_id: "" };
    exportAnalysisJson(dataEmpty);
    expect(a.download).toBe("analysis.json");
  });
  it("exports pdf with all severities", () => {
    const dataWithRaw: AnalyzeResponse = {
      ...mockData,
      raw_text: "indemnify cap pay terminate words with highlights at offsets",
      verified_findings: mockData.verified_findings.map((f, i) => ({ ...f, char_start: i * 10, char_end: i * 10 + 5 })),
    };
    exportAnalysisPdf(dataWithRaw);
    expect(mockSave).toHaveBeenCalledWith("doc-001.pdf");
    expect(mockSetFillColor).toHaveBeenCalled();
    const calls = mockSetFillColor.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });
  it("exports pdf with HIGH severity triggers red", () => {
    const dataHigh: AnalyzeResponse = {
      ...mockData,
      raw_text: "indemnify extra text for high severity highlight test",
      verified_findings: [
        {
          clause_id: "c1",
          title: "High",
          category: "Indemnification",
          severity: "HIGH",
          exact_quote: "indemnify",
          char_start: 0,
          char_end: 9,
          plain_english_explanation: "exp",
          worst_case_scenario: "worst",
          referenced_terms_used: [],
          recommended_redline: "fix",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    exportAnalysisPdf(dataHigh);
    expect(mockSetFillColor).toHaveBeenCalled();
  });
  it("exports pdf with MEDIUM severity triggers orange", () => {
    const dataMed: AnalyzeResponse = {
      ...mockData,
      raw_text: "pay extra text for medium severity highlight test",
      verified_findings: [
        {
          clause_id: "c3",
          title: "Medium",
          category: "Payment",
          severity: "MEDIUM",
          exact_quote: "pay",
          char_start: 0,
          char_end: 3,
          plain_english_explanation: "exp3",
          worst_case_scenario: "worst3",
          referenced_terms_used: [],
          recommended_redline: "fix3",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    exportAnalysisPdf(dataMed);
    expect(mockSetFillColor).toHaveBeenCalled();
  });
  it("exports pdf with LOW severity triggers yellow", () => {
    const dataLow: AnalyzeResponse = {
      ...mockData,
      raw_text: "terminate extra text for low severity highlight test",
      verified_findings: [
        {
          clause_id: "c4",
          title: "Low",
          category: "Termination",
          severity: "LOW",
          exact_quote: "terminate",
          char_start: 0,
          char_end: 9,
          plain_english_explanation: "exp4",
          worst_case_scenario: "worst4",
          referenced_terms_used: [],
          recommended_redline: "fix4",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    exportAnalysisPdf(dataLow);
    expect(mockSetFillColor).toHaveBeenCalled();
  });
  it("exports pdf without executive summary", () => {
    const dataNoExec = { ...mockData, executive_summary: null };
    exportAnalysisPdf(dataNoExec);
    expect(mockSave).toHaveBeenCalled();
  });
  it("exports pdf with empty findings and fallback filename", () => {
    const dataEmpty: AnalyzeResponse = { ...mockData, document_id: "", verified_findings: [], executive_summary: null };
    exportAnalysisPdf(dataEmpty);
    expect(mockSave).toHaveBeenCalledWith("analysis.pdf");
  });
  it("exports pdf handles page overflow", () => {
    const longText = "Long content ".repeat(2000);
    const manyData: AnalyzeResponse = { ...mockData, raw_text: longText, clauses: mockData.clauses, verified_findings: [], executive_summary: null };
    exportAnalysisPdf(manyData);
    expect(mockAddPage).toHaveBeenCalled();
  });
  it("exports pdf with newline handling", () => {
    const newlineText = "indemnify\ncap pay\nterminate\nwith\nnewlines and enough words to test wrapping logic thoroughly for branch coverage";
    const dataNewline: AnalyzeResponse = { ...mockData, raw_text: newlineText, verified_findings: [], executive_summary: null };
    exportAnalysisPdf(dataNewline);
    expect(mockSave).toHaveBeenCalled();
  });
  it("exports pdf with double newline empty trim continue", () => {
    const doubleNewline = "word1\n\nword2";
    const dataDouble: AnalyzeResponse = { ...mockData, raw_text: doubleNewline, verified_findings: [], executive_summary: null };
    exportAnalysisPdf(dataDouble);
    expect(mockSave).toHaveBeenCalled();
  });
  it("exports pdf with word wrap overflow", () => {
    // Very long word forces x+wWidth>maxX (usableWidth ~515)
    mockGetTextWidth.mockReturnValue(600);
    const longWord = "SupercalifragilisticexpialidociousSuperLongWordToForceWrap ".repeat(20);
    const dataWrap: AnalyzeResponse = { ...mockData, raw_text: longWord, verified_findings: [], executive_summary: null };
    exportAnalysisPdf(dataWrap);
    expect(mockSave).toHaveBeenCalled();
    // restore default
    mockGetTextWidth.mockReturnValue(20);
  });
  it("exports pdf with empty raw_text fallback", () => {
    const dataNoRaw = { ...mockData, raw_text: "", verified_findings: [], executive_summary: null } as unknown as AnalyzeResponse;
    exportAnalysisPdf(dataNoRaw);
    expect(mockSave).toHaveBeenCalled();
  });
  it("exports pdf with undefined raw_text fallback", () => {
    const dataUndef = { ...mockData, raw_text: undefined, verified_findings: [], executive_summary: null } as unknown as AnalyzeResponse;
    exportAnalysisPdf(dataUndef);
    expect(mockSave).toHaveBeenCalled();
  });
  it("exports pdf with continuous highlight across spaces", () => {
    const dataSpace: AnalyzeResponse = {
      ...mockData,
      raw_text: "indemnify Client for all claims with continuous highlight across spaces test",
      verified_findings: [
        {
          clause_id: "c1",
          title: "High",
          category: "Indemnification",
          severity: "HIGH",
          exact_quote: "indemnify Client for all",
          char_start: 0,
          char_end: 23,
          plain_english_explanation: "exp",
          worst_case_scenario: "worst",
          referenced_terms_used: [],
          recommended_redline: "fix",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    exportAnalysisPdf(dataSpace);
    expect(mockSetFillColor).toHaveBeenCalled();
    // Should have highlighted spaces continuously - rect called for each word + space
    expect(mockRect).toHaveBeenCalled();
  });
  it("exports pdf with highlighted newline and spaces", () => {
    const dataNewlineHighlight: AnalyzeResponse = {
      ...mockData,
      raw_text: "indemnify Client\n for all claims",
      verified_findings: [
        {
          clause_id: "c1",
          title: "High",
          category: "Indemnification",
          severity: "HIGH",
          exact_quote: "indemnify Client\n ",
          char_start: 0,
          char_end: 17,
          plain_english_explanation: "exp",
          worst_case_scenario: "worst",
          referenced_terms_used: [],
          recommended_redline: "fix",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    exportAnalysisPdf(dataNewlineHighlight);
    expect(mockSave).toHaveBeenCalled();
  });
  it("exports pdf with highlight wrapping across lines", () => {
    mockGetTextWidth.mockReturnValue(100);
    const dataWrapHighlight: AnalyzeResponse = {
      ...mockData,
      raw_text: "indemnify Client for all claims that are very long and should wrap across lines",
      verified_findings: [
        {
          clause_id: "c1",
          title: "High",
          category: "Indemnification",
          severity: "HIGH",
          exact_quote: "indemnify Client for all claims that are very long",
          char_start: 0,
          char_end: 45,
          plain_english_explanation: "exp",
          worst_case_scenario: "worst",
          referenced_terms_used: [],
          recommended_redline: "fix",
          grounding_status: "VERIFIED_EXACT",
        },
      ],
    };
    exportAnalysisPdf(dataWrapHighlight);
    expect(mockSave).toHaveBeenCalled();
    mockGetTextWidth.mockReturnValue(20);
  });
});
