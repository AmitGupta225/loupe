import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportDropdown } from "../components/layout/ExportDropdown";
import type { AnalyzeResponse } from "../types/contract";

const mockData: AnalyzeResponse = {
  document_id: "doc-001",
  raw_text: "text",
  clauses: [{ id: "c1", title: "T", content: "content", char_start: 0, char_end: 7, level: 1, section_number: "1", clause_type: "general" }],
  defined_terms: {},
  flagged_clause_ids: [],
  verified_findings: [],
  executive_summary: null,
  execution_trace: [],
};

vi.mock("../services/export", () => ({
  exportAnalysisPdf: vi.fn(),
  exportAnalysisJson: vi.fn(),
}));

import { exportAnalysisJson, exportAnalysisPdf } from "../services/export";

describe("ExportDropdown", () => {
  it("renders button", () => {
    render(<ExportDropdown data={mockData} />);
    expect(screen.getByTestId("export-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("export-menu")).not.toBeInTheDocument();
  });
  it("opens menu", () => {
    render(<ExportDropdown data={mockData} />);
    fireEvent.click(screen.getByTestId("export-btn"));
    expect(screen.getByTestId("export-menu")).toBeInTheDocument();
    expect(screen.getByTestId("export-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("export-json")).toBeInTheDocument();
  });
  it("calls pdf export", () => {
    render(<ExportDropdown data={mockData} />);
    fireEvent.click(screen.getByTestId("export-btn"));
    fireEvent.click(screen.getByTestId("export-pdf"));
    expect(exportAnalysisPdf).toHaveBeenCalledWith(mockData);
    expect(screen.queryByTestId("export-menu")).not.toBeInTheDocument();
  });
  it("calls json export", () => {
    render(<ExportDropdown data={mockData} />);
    fireEvent.click(screen.getByTestId("export-btn"));
    fireEvent.click(screen.getByTestId("export-json"));
    expect(exportAnalysisJson).toHaveBeenCalledWith(mockData);
  });
  it("toggles and closes on outside click", () => {
    render(
      <div>
        <ExportDropdown data={mockData} />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.click(screen.getByTestId("export-btn"));
    expect(screen.getByTestId("export-menu")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("export-btn"));
    expect(screen.queryByTestId("export-menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("export-btn"));
    expect(screen.getByTestId("export-menu")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByTestId("export-menu")).not.toBeInTheDocument();
  });
});
