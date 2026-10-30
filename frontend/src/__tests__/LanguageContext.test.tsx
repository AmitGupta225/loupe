import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../services/translator", () => ({
  translateTexts: vi.fn(async (texts: string[]) => texts.map((text) => `T:${text}`)),
}));

import { LanguageProvider, useLanguage } from "../context/LanguageContext";

function Harness() {
  const { lang, setLang, t, translateBatch, ensureTranslated } = useLanguage();
  return (
    <div>
      <button onClick={() => setLang("hi")}>Hindi</button>
      <button onClick={() => void translateBatch(["Hello", "", "World"]).then((v) => document.body.setAttribute("data-result", v.join("|")))}>Batch</button>
      <button onClick={() => void ensureTranslated(["Queued"])}>Ensure</button>
      <span title="Tooltip">{lang === "en" ? t("Hello") : t("Visible")}</span>
      <span data-translation-skip>Original clause</span>
    </div>
  );
}

describe("LanguageContext", () => {
  it("uses identity behavior outside a provider", () => {
    function Outside() {
      const { lang, t } = useLanguage();
      return <span>{lang}:{t("Text")}</span>;
    }
    render(<Outside />);
    expect(screen.getByText("en:Text")).toBeInTheDocument();
  });

  it("translates batches and rendered DOM while preserving skipped text", async () => {
    render(<LanguageProvider><Harness /></LanguageProvider>);
    fireEvent.click(screen.getByText("Hindi"));
    await waitFor(() => expect(screen.getByText("T:Visible")).toBeInTheDocument());
    expect(screen.getByText("Original clause")).toBeInTheDocument();
    fireEvent.click(screen.getByText("T:Batch"));
    await waitFor(() => expect(document.body.getAttribute("data-result")).toBe("T:Hello||T:World"));
    fireEvent.click(screen.getByText("T:Ensure"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  });

});
