import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DefinedTermsView } from "../components/terms/DefinedTermsView";
describe("DefinedTermsView", () => {
  const terms = { "Confidential Information": "means secret", Term2: "def2" };
  it("renders header", () => {
    render(<DefinedTermsView definedTerms={terms} />);
    expect(screen.getByTestId("defined-terms-view")).toBeInTheDocument();
    expect(screen.getByText("Defined terms")).toBeInTheDocument();
    expect(screen.getByText("Glossary extracted from the agreement")).toBeInTheDocument();
  });
  it("renders terms table", () => {
    render(<DefinedTermsView definedTerms={terms} />);
    expect(screen.getByTestId("term-Confidential Information")).toBeInTheDocument();
    expect(screen.getByText("Term")).toBeInTheDocument();
    expect(screen.getByText("Definition")).toBeInTheDocument();
  });
  it("search filters", () => {
    render(<DefinedTermsView definedTerms={terms} />);
    const input = screen.getByTestId("terms-search");
    fireEvent.change(input, { target: { value: "Confidential" } });
    expect(screen.getByTestId("term-Confidential Information")).toBeInTheDocument();
    expect(screen.queryByTestId("term-Term2")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByTestId("terms-empty")).toBeInTheDocument();
  });
  it("handles empty terms", () => {
    render(<DefinedTermsView definedTerms={{}} />);
    expect(screen.getByTestId("terms-empty")).toBeInTheDocument();
  });
  it("shows clause count", () => {
    const clauses = [{ id: "c1", title: "T", content: "x", char_start: 0, char_end: 1, level: 1, section_number: "1", clause_type: "general" }];
    render(<DefinedTermsView definedTerms={terms} clauses={clauses} />);
    expect(screen.getByTestId("terms-clause-count")).toHaveTextContent("1 clauses indexed");
    expect(screen.getByTestId("terms-map-size")).toHaveTextContent("1");
  });
  it("handles no clauses", () => {
    render(<DefinedTermsView definedTerms={terms} clauses={[]} />);
    expect(screen.queryByTestId("terms-clause-count")).not.toBeInTheDocument();
  });
});
