import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "../context/ThemeContext";
import { ThemeToggle } from "../components/layout/ThemeToggle";

describe("ThemeToggle", () => {
  it("toggles theme and persists it", () => {
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(localStorage.getItem("loupe:theme")).toBe("dark");
    fireEvent.click(button);
    expect(localStorage.getItem("loupe:theme")).toBe("light");
  });
});
