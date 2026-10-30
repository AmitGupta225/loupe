import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../components/layout/Sidebar";

describe("Sidebar", () => {
  it("renders brand and nav links in sentence case", () => {
    render(<Sidebar activeView="audit" onNavigate={vi.fn()} onNewContract={vi.fn()} />);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("brand-wordmark")).toHaveTextContent("Loupe");
    expect(screen.getByTestId("sidebar-nav")).toBeInTheDocument();
    expect(screen.getByTestId("nav-audit")).toHaveTextContent("Audit report");
    expect(screen.getByTestId("nav-document")).toHaveTextContent("Original document");
    expect(screen.getByTestId("nav-terms")).toHaveTextContent("Defined terms");
    expect(screen.queryByTestId("nav-trace")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-review")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-audit").textContent).not.toMatch(/WORKSPACE|AUDIT|\[|\/\//);
  });
  it("highlights active view", () => {
    render(<Sidebar activeView="document" onNavigate={vi.fn()} onNewContract={vi.fn()} />);
    const active = screen.getByTestId("nav-document");
    expect(active.className).toContain("bg-zinc-900");
    const inactive = screen.getByTestId("nav-audit");
    expect(inactive.className).not.toContain("bg-zinc-900");
  });
  it("calls onNavigate", () => {
    const fn = vi.fn();
    render(<Sidebar activeView="audit" onNavigate={fn} onNewContract={vi.fn()} />);
    fireEvent.click(screen.getByTestId("nav-document"));
    expect(fn).toHaveBeenCalledWith("document");
    fireEvent.click(screen.getByTestId("nav-terms"));
    expect(fn).toHaveBeenCalledWith("terms");
    fireEvent.click(screen.getByTestId("nav-audit"));
    expect(fn).toHaveBeenCalledWith("audit");
  });
  it("shows doc indicator when hasDocument", () => {
    render(<Sidebar activeView="audit" onNavigate={vi.fn()} onNewContract={vi.fn()} hasDocument documentTitle="My Agreement" clauseCount={42} />);
    expect(screen.getByTestId("sidebar-doc-indicator")).toBeInTheDocument();
    expect(screen.getByText("42 clauses indexed")).toBeInTheDocument();
  });
  it("hides doc indicator when no document", () => {
    render(<Sidebar activeView="intake" onNavigate={vi.fn()} onNewContract={vi.fn()} hasDocument={false} />);
    expect(screen.queryByTestId("sidebar-doc-indicator")).not.toBeInTheDocument();
    expect(screen.getByTestId("sidebar-no-document")).toBeInTheDocument();
  });
  it("handles missing title even with hasDocument", () => {
    render(<Sidebar activeView="audit" onNavigate={vi.fn()} onNewContract={vi.fn()} hasDocument clauseCount={5} />);
    expect(screen.queryByTestId("sidebar-doc-indicator")).not.toBeInTheDocument();
  });
  it("renders new contract button with rounded", () => {
    const fn = vi.fn();
    render(<Sidebar activeView="audit" onNavigate={vi.fn()} onNewContract={fn} />);
    const btn = screen.getByTestId("new-contract-btn");
    expect(btn).toHaveTextContent("New contract");
    expect(btn.className).toContain("rounded");
    expect(btn.className).toContain("bg-zinc-900");
    fireEvent.click(btn);
    expect(fn).toHaveBeenCalled();
  });
  it("has correct width and border", () => {
    render(<Sidebar activeView="audit" onNavigate={vi.fn()} onNewContract={vi.fn()} />);
    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar.className).toContain("w-[260px]");
    expect(sidebar.className).toContain("border-r");
    expect(sidebar.className).toContain("bg-zinc-50");
  });
  it("handles terms navigation", () => {
    const fn = vi.fn();
    render(<Sidebar activeView="intake" onNavigate={fn} onNewContract={vi.fn()} />);
    fireEvent.click(screen.getByTestId("nav-terms"));
    expect(fn).toHaveBeenCalledWith("terms");
  });
});
