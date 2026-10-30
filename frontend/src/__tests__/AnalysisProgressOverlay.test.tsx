import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AnalysisProgressOverlay } from "../components/intake/AnalysisProgressOverlay";

describe("AnalysisProgressOverlay", () => {
  it("renders nothing when not loading", () => {
    const { container } = render(<AnalysisProgressOverlay isLoading={false} />);
    expect(container.innerHTML).not.toContain("Analysing contract");
    expect(screen.queryByTestId("analysis-overlay")).not.toBeInTheDocument();
  });
  it("renders overlay with progress when loading", () => {
    render(<AnalysisProgressOverlay isLoading={true} />);
    expect(screen.getByTestId("analysis-overlay")).toBeInTheDocument();
    expect(screen.getByText("Analysing contract")).toBeInTheDocument();
    expect(screen.getByTestId("circular-progress")).toBeInTheDocument();
    expect(screen.getByTestId("progress-percent")).toBeInTheDocument();
    expect(screen.getByTestId("progress-step")).toBeInTheDocument();
    expect(screen.getByTestId("progress-circle")).toBeInTheDocument();
  });
  it("advances progress with timers and cleans up on unmount", () => {
    const { rerender, unmount } = render(<AnalysisProgressOverlay isLoading={true} progress={12} stepLabel="Indexing clauses" />);
    expect(screen.getByTestId("progress-percent").textContent).toContain("12%");
    expect(screen.getByTestId("progress-step").textContent).toContain("Indexing clauses");
    rerender(<AnalysisProgressOverlay isLoading={false} />);
    expect(screen.queryByTestId("analysis-overlay")).not.toBeInTheDocument();
    unmount();
  });
  it("shows file progress when multi-file", () => {
    render(
      <AnalysisProgressOverlay isLoading={true} progress={24} stepLabel="Parsing document" currentFile="contract2.pdf" currentFileIndex={2} totalFiles={5} />,
    );
    expect(screen.getByTestId("progress-file")).toHaveTextContent("2/5");
    expect(screen.getByTestId("progress-file")).toHaveTextContent("contract2.pdf");
    expect(screen.getByTestId("progress-percent").textContent).toContain("24%");
  });
});
