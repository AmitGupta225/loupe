import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InspectionDrawer } from "../components/inspection/InspectionDrawer";
import type { RiskFinding } from "../types/contract";
const finding: RiskFinding = {
  clause_id: "c1",
  title: "Uncapped liability",
  category: "Indemnification",
  severity: "HIGH",
  exact_quote: "Provider shall indemnify Client for all losses",
  char_start: 0,
  char_end: 20,
  plain_english_explanation: "This clause exposes you to unlimited liability.",
  worst_case_scenario: "Worst case is bankruptcy.",
  referenced_terms_used: ["Confidential Information", "Losses"],
  recommended_redline: "Provider liability capped at fees",
  grounding_status: "VERIFIED_EXACT",
};
describe("InspectionDrawer", () => {
  beforeEach(() => vi.clearAllMocks());
  it("renders null when closed", () => {
    const { container } = render(<InspectionDrawer finding={finding} isOpen={false} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
  it("renders null when no finding", () => {
    const { container } = render(<InspectionDrawer finding={null} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
  it("renders drawer with correct width and styling", () => {
    render(<InspectionDrawer finding={finding} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    const drawer = screen.getByTestId("inspection-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer.className).toContain("w-[520px]");
    expect(drawer.className).toContain("fixed");
    expect(drawer.className).toContain("right-0");
    expect(drawer.className).toContain("shadow-xl");
    expect(drawer.className).toContain("border-l");
  });
  it("renders title and severity sentence case", () => {
    render(<InspectionDrawer finding={finding} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    expect(screen.getByText("Uncapped liability")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-severity")).toHaveTextContent("High");
  });
  it("renders verbatim quote with correct styling", () => {
    render(<InspectionDrawer finding={finding} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    const quote = screen.getByTestId("drawer-quote");
    expect(quote).toBeInTheDocument();
    expect(quote.className).toContain("border-l-2");
    expect(quote.className).toContain("border-red-600");
    expect(quote).toHaveTextContent("Provider shall indemnify Client for all losses");
  });
  it("renders why this matters", () => {
    render(<InspectionDrawer finding={finding} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    expect(screen.getByText("Why this matters")).toBeInTheDocument();
    expect(screen.getByText("This clause exposes you to unlimited liability.")).toBeInTheDocument();
    expect(screen.getByText("Worst case is bankruptcy.")).toBeInTheDocument();
  });

  it("renders redline diff with toggle", () => {
    render(<InspectionDrawer finding={finding} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    expect(screen.getByTestId("drawer-redline")).toBeInTheDocument();
    expect(screen.getByText("Suggested Change")).toBeInTheDocument();
    expect(screen.getByTestId("inline-diff")).toBeInTheDocument();
    expect(screen.getByTestId("inline-diff").innerHTML).toContain("line-through");
  });
  it("copy button copies", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<InspectionDrawer finding={finding} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    const btn = screen.getByTestId("copy-clause");
    expect(btn).toHaveTextContent("Copy clause");
    expect(btn.className).toContain("rounded");
    fireEvent.click(btn);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Provider liability capped at fees"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
  it("handles copy failure", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("fail")) } });
    render(<InspectionDrawer finding={finding} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    fireEvent.click(screen.getByTestId("copy-clause"));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.getByTestId("copy-clause")).toHaveTextContent("Copy clause");
  });
  it("close and jump buttons", () => {
    const onClose = vi.fn();
    const onJump = vi.fn();
    render(<InspectionDrawer finding={finding} isOpen={true} onClose={onClose} onJumpToClause={onJump} />);
    expect(screen.getByTestId("drawer-close")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("drawer-close"));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId("jump-to-clause")).toHaveTextContent("View in document");
    expect(screen.getByTestId("jump-to-clause").textContent).not.toContain("§");
    fireEvent.click(screen.getByTestId("jump-to-clause"));
    expect(onJump).toHaveBeenCalledWith("c1");
  });
  it("handles low severity label", () => {
    const low = { ...finding, severity: "LOW" as const };
    render(<InspectionDrawer finding={low} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    expect(screen.getByTestId("drawer-severity")).toHaveTextContent("Low");
  });
  it("handles high severity", () => {
    const high = { ...finding, severity: "HIGH" as const };
    render(<InspectionDrawer finding={high} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    expect(screen.getByTestId("drawer-severity")).toHaveTextContent("High");
  });
  it("handles medium severity", () => {
    const med = { ...finding, severity: "MEDIUM" as const };
    render(<InspectionDrawer finding={med} isOpen={true} onClose={vi.fn()} onJumpToClause={vi.fn()} />);
    expect(screen.getByTestId("drawer-severity")).toHaveTextContent("Medium");
  });
});
