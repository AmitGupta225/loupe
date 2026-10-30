import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageSelector } from "../components/layout/LanguageSelector";
import { LanguageProvider } from "../context/LanguageContext";

describe("LanguageSelector", () => {
  it("opens language choices and changes language", () => {
    render(<LanguageProvider><LanguageSelector /></LanguageProvider>);
    fireEvent.click(screen.getByTestId("language-toggle"));
    expect(screen.getByTestId("language-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("lang-option-hi"));
    expect(localStorage.getItem("loupe:lang")).toBe("hi");
  });

  it("closes on escape and outside click", () => {
    render(<LanguageProvider><LanguageSelector /></LanguageProvider>);
    fireEvent.click(screen.getByTestId("language-toggle"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("language-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("language-toggle"));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("language-panel")).not.toBeInTheDocument();
  });
});
