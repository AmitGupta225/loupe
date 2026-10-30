import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskGauge } from "../components/review/RiskGauge";

describe("RiskGauge", () => {
  it("renders high risk", () => {
    render(<RiskGauge score={80} distribution={{ HIGH: 2, MEDIUM: 0 }} />);
    expect(screen.getByTestId("risk-gauge")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-label")).toHaveTextContent("High risk");
    expect(screen.getByTestId("gauge-needle")).toBeInTheDocument();
    expect(screen.getByTestId("risk-score")).toHaveTextContent("80");
    expect(screen.getByTestId("gauge-conclusion")).toHaveTextContent("Do not sign");
  });
  it("renders medium risk", () => {
    render(<RiskGauge score={60} />);
    expect(screen.getByTestId("verdict-label")).toHaveTextContent("Medium risk");
    expect(screen.getByTestId("gauge-conclusion")).toHaveTextContent("Negotiate first");
  });
  it("renders low risk", () => {
    render(<RiskGauge score={30} />);
    expect(screen.getByTestId("verdict-label")).toHaveTextContent("Low risk");
    expect(screen.getByTestId("gauge-conclusion")).toHaveTextContent("Proceed with review");
  });
  it("renders minimal risk", () => {
    render(<RiskGauge score={10} />);
    expect(screen.getByTestId("verdict-label")).toHaveTextContent("Low risk");
    expect(screen.getByTestId("gauge-conclusion")).toHaveTextContent("Proceed with review");
  });
  it("handles null score as 0", () => {
    render(<RiskGauge score={null} />);
    expect(screen.getByTestId("verdict-label")).toHaveTextContent("Low risk");
    expect(screen.getByTestId("gauge-conclusion")).toHaveTextContent("Proceed with review");
  });
  it("renders with empty distribution", () => {
    render(<RiskGauge score={50} distribution={{}} />);
    expect(screen.getByTestId("risk-gauge")).toBeInTheDocument();
    expect(screen.getByText("High: 0")).toBeInTheDocument();
  });
  it("renders LLM-provided verdict and conclusion", () => {
    render(
      <RiskGauge score={80} distribution={{ HIGH: 1 }} verdict="LLM High Verdict" conclusion="LLM Do Not Sign" advice="LLM advice paragraph from model" />,
    );
    expect(screen.getByTestId("verdict-label")).toHaveTextContent("LLM High Verdict");
    expect(screen.getByTestId("gauge-conclusion")).toHaveTextContent("LLM Do Not Sign");
    expect(screen.getByText("LLM advice paragraph from model")).toBeInTheDocument();
  });
  it("falls back when LLM fields empty", () => {
    render(<RiskGauge score={80} verdict="" conclusion="   " advice="" />);
    expect(screen.getByTestId("verdict-label")).toHaveTextContent("High risk");
    expect(screen.getByTestId("gauge-conclusion")).toHaveTextContent("Do not sign");
  });
});
