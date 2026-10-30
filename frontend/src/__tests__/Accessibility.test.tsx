import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccessibilityControls, AccessibilityToggle } from "../components/layout/AccessibilityPanel";
import { AccessibilityProvider } from "../context/AccessibilityContext";

const renderControls = () => render(<AccessibilityProvider><AccessibilityControls /></AccessibilityProvider>);

describe("accessibility controls", () => {
  it("toggles visual settings and resets them", () => {
    renderControls();
    fireEvent.click(screen.getByTestId("a11y-high-contrast"));
    fireEvent.click(screen.getByTestId("a11y-dark-contrast"));
    fireEvent.click(screen.getByTestId("a11y-invert"));
    fireEvent.click(screen.getByTestId("a11y-saturation"));
    fireEvent.click(screen.getByTestId("a11y-line-height"));
    fireEvent.click(screen.getByTestId("a11y-text-spacing"));
    fireEvent.click(screen.getByTestId("a11y-big-cursor"));
    fireEvent.click(screen.getByTestId("a11y-screen-reader"));
    expect(document.documentElement.className).toContain("a11y-screen-reader");
    fireEvent.click(screen.getByTestId("a11y-increase-text"));
    fireEvent.click(screen.getByTestId("a11y-decrease-text"));
    fireEvent.click(screen.getByTestId("a11y-reset-text"));
    fireEvent.click(screen.getByTestId("a11y-reset-all"));
    expect(document.documentElement.className).not.toContain("a11y-screen-reader");
  });

  it("opens and closes the accessibility panel", () => {
    render(<AccessibilityProvider><AccessibilityToggle /></AccessibilityProvider>);
    fireEvent.click(screen.getByTestId("a11y-toggle"));
    expect(screen.getByTestId("a11y-panel")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("a11y-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("a11y-toggle"));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("a11y-panel")).not.toBeInTheDocument();
  });
});
