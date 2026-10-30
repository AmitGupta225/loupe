import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { RiskGauge } from "../components/review/RiskGauge";

describe("RiskGauge branches", () => {
  it("renders all score ranges", () => {
    [0, 20, 40, 60, 80, 100].forEach((score) => {
      render(<RiskGauge score={score} />);
    });
  });
});
