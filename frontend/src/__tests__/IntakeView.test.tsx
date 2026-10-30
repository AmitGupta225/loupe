import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntakeView } from "../components/intake/IntakeView";

const recents = [
  { id: "r1", title: "Contract A", documentId: "r1", analyzedAt: "2024-01-01T00:00:00.000Z", clauseCount: 5, findingCount: 2, riskScore: 80 },
  { id: "r2", title: "Contract B", documentId: "r2", analyzedAt: "2024-01-02T00:00:00.000Z", clauseCount: 3, findingCount: 1, riskScore: null },
];

describe("IntakeView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  it("renders header and subtitle", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    expect(screen.getByTestId("intake-view")).toBeInTheDocument();
    expect(screen.getByText("Understand your contract before you sign it")).toBeInTheDocument();
    expect(screen.getByText(/Upload your agreement or paste the full text here/)).toBeInTheDocument();
    expect(screen.getByText(/Drop PDF.*files here/)).toBeInTheDocument();
  });
  it("has centered container", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    const view = screen.getByTestId("intake-view");
    expect(view.className).toContain("max-w-4xl");
    expect(view.className).toContain("mx-auto");
    expect(view.className).toContain("py-");
    expect(view.className).toContain("px-");
  });
  it("shows tab switcher with sentence case and only one panel visible", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    expect(screen.getByTestId("tab-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("tab-upload")).toHaveTextContent("Upload File");
    expect(screen.getByTestId("tab-paste")).toHaveTextContent("Paste Text");
    expect(screen.getByTestId("tab-url")).toHaveTextContent("URL");
    expect(screen.getByTestId("upload-dropzone")).toBeInTheDocument();
    expect(screen.queryByTestId("paste-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("url-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-paste"));
    expect(screen.getByTestId("paste-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("upload-dropzone")).not.toBeInTheDocument();
    expect(screen.queryByTestId("url-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-url"));
    expect(screen.getByTestId("url-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("paste-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-upload"));
    expect(screen.getByTestId("upload-dropzone")).toBeInTheDocument();
    expect(screen.queryByTestId("url-panel")).not.toBeInTheDocument();
  });
  it("upload dropzone has correct styling", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    const dz = screen.getByTestId("upload-dropzone");
    expect(dz.className).toContain("h-56");
    expect(dz.className).toContain("rounded-md");
    expect(dz.className).toContain("border-dashed");
  });
  it("handles drag over and leave", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    const dz = screen.getByTestId("upload-dropzone");
    fireEvent.dragOver(dz);
    expect(dz.className).toContain("border-zinc-900");
    fireEvent.dragLeave(dz);
    expect(dz.className).toContain("border-zinc-300");
  });
  it("drop file triggers onUploadFile", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={fn} onPasteText={vi.fn()} />);
    const dz = screen.getByTestId("upload-dropzone");
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    fireEvent.drop(dz, { dataTransfer: { files: [file] } });
    expect(fn).toHaveBeenCalledWith(file);
  });
  it("falls back to first file when multi-upload callback is absent", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={fn} onPasteText={vi.fn()} />);
    const dz = screen.getByTestId("upload-dropzone");
    const first = new File(["a"], "a.txt", { type: "text/plain" });
    const second = new File(["b"], "b.txt", { type: "text/plain" });
    fireEvent.drop(dz, { dataTransfer: { files: [first, second] } });
    expect(fn).toHaveBeenCalledWith(first);
  });
  it("file input change triggers onUploadFile", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={fn} onPasteText={vi.fn()} />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(fn).toHaveBeenCalledWith(file);
  });
  it("paste panel textarea and analyze button", async () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={fn} />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    const area = screen.getByTestId("paste-textarea");
    expect(area.className).toContain("h-56");
    expect(area.className).toContain("rounded-md");
    expect(screen.getByTestId("analyze-contract-btn")).toBeDisabled();
    await userEvent.type(area, "contract text");
    expect(screen.getByTestId("analyze-contract-btn")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("analyze-contract-btn"));
    expect(fn).toHaveBeenCalledWith("contract text");
  });
  it("paste submit disabled when empty", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    fireEvent.click(screen.getByTestId("tab-paste"));
    expect(screen.getByTestId("analyze-contract-btn")).toBeDisabled();
  });
  it("shows loading indicator", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} isLoading />);
    expect(screen.getByTestId("upload-loading")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-paste"));
    expect(screen.getByTestId("paste-loading")).toBeInTheDocument();
  });
  it("renders recent analyses section with cards", () => {
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByTestId("recent-analyses-section")).toBeInTheDocument();
    expect(screen.getByText("Recent analyses")).toBeInTheDocument();
    expect(screen.getByTestId("recent-card-r1")).toBeInTheDocument();
    expect(screen.getByTestId("recent-card-r2")).toBeInTheDocument();
    const card = screen.getByTestId("recent-card-r1");
    expect(card.className).toContain("rounded");
    expect(card.className).toContain("border-zinc-200");
    expect(screen.getByTestId("recent-open-r1")).toHaveTextContent("Open");
    expect(screen.getByTestId("recent-open-r1").className).toContain("rounded");
    expect(screen.getByTestId("clear-recent-btn")).toBeInTheDocument();
  });
  it("recent card shows risk score when present and hides when null", () => {
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByText(/Risk 80/)).toBeInTheDocument();
    const r2Card = screen.getByTestId("recent-card-r2");
    expect(r2Card.textContent).not.toContain("Risk");
  });
  it("recent open triggers onRestore", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} onRestore={fn} />);
    fireEvent.click(screen.getByTestId("recent-open-r1"));
    expect(fn).toHaveBeenCalledWith("r1");
  });
  it("handles empty recent", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    expect(screen.getByTestId("recent-empty")).toBeInTheDocument();
    expect(screen.getByText("No recent analyses yet")).toBeInTheDocument();
    expect(screen.getByText("Analyzed contracts will appear here for quick access.")).toBeInTheDocument();
    expect(screen.queryByTestId("clear-recent-btn")).not.toBeInTheDocument();
  });
  it("click dropzone triggers file input", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    const dz = screen.getByTestId("upload-dropzone");
    const input = screen.getByTestId("file-input");
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(dz);
    expect(clickSpy).toHaveBeenCalled();
  });
  it("clear button calls onClearRecent when provided", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} onClearRecent={fn} />);
    fireEvent.click(screen.getByTestId("clear-recent-btn"));
    expect(fn).toHaveBeenCalled();
  });
  it("clear button clears localStorage when onClearRecent not provided", () => {
    localStorage.setItem("loupe:recent-analyses", JSON.stringify(recents));
    render(<IntakeView onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    expect(screen.getByTestId("recent-card-r1")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("clear-recent-btn"));
    expect(screen.getByTestId("recent-empty")).toBeInTheDocument();
    expect(localStorage.getItem("loupe:recent-analyses")).toBeNull();
  });
  it("loads recent from localStorage when prop not provided", () => {
    localStorage.setItem("loupe:recent-analyses", JSON.stringify(recents));
    render(<IntakeView onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    expect(screen.getByTestId("recent-card-r1")).toBeInTheDocument();
    expect(screen.getByTestId("recent-card-r2")).toBeInTheDocument();
  });
  it("hides open button when onRestore not provided", () => {
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    expect(screen.queryByTestId("recent-open-r1")).not.toBeInTheDocument();
  });
  it("clear button disabled when loading", () => {
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} isLoading onClearRecent={vi.fn()} />);
    expect(screen.getByTestId("clear-recent-btn")).toBeDisabled();
  });
  it("open button disabled when loading", () => {
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} isLoading onRestore={vi.fn()} />);
    expect(screen.getByTestId("recent-open-r1")).toBeDisabled();
  });
  it("renders url panel with note", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    expect(screen.getByTestId("url-panel")).toBeInTheDocument();
    expect(screen.getByTestId("url-input")).toBeInTheDocument();
    expect(screen.getByTestId("analyze-url-btn")).toBeInTheDocument();
    expect(screen.getByText(/scraping will not always work/)).toBeInTheDocument();
  });
  it("url input change and submit valid url", async () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={fn} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    const input = screen.getByTestId("url-input") as HTMLInputElement;
    await userEvent.type(input, "https://example.com");
    expect(input.value).toBe("https://example.com");
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    expect(fn).toHaveBeenCalledWith("https://example.com");
  });
  it("url submit trims and validates empty", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={fn} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    const btn = screen.getByTestId("analyze-url-btn");
    expect(btn.className).toContain("opacity-40");
    fireEvent.click(btn);
    expect(screen.queryByTestId("url-error")).not.toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
  it("url submit validates bad scheme", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={fn} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    const input = screen.getByTestId("url-input");
    fireEvent.change(input, { target: { value: "ftp://example.com" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    expect(screen.getByTestId("url-error")).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });
  it("url submit validates invalid url", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={fn} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    const input = screen.getByTestId("url-input");
    fireEvent.change(input, { target: { value: "not a url" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    expect(screen.getByTestId("url-error")).toHaveTextContent("Please enter a valid URL");
    expect(fn).not.toHaveBeenCalled();
  });
  it("url button disabled when empty and when loading", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} isLoading />);
    fireEvent.click(screen.getByTestId("tab-url"));
    expect(screen.getByTestId("analyze-url-btn")).toBeDisabled();
  });
  it("shows url loading indicator", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} isLoading />);
    fireEvent.click(screen.getByTestId("tab-url"));
    expect(screen.getByTestId("url-loading")).toBeInTheDocument();
  });
  it("url input clears error on change", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={vi.fn()} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    const input = screen.getByTestId("url-input");
    fireEvent.change(input, { target: { value: "ftp://example.com" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    expect(screen.getByTestId("url-error")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "https://example.com" } });
    expect(screen.queryByTestId("url-error")).not.toBeInTheDocument();
  });
  it("renders per-item remove button", () => {
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByTestId("recent-remove-r1")).toBeInTheDocument();
    expect(screen.getByTestId("recent-remove-r2")).toBeInTheDocument();
  });
  it("remove button calls onRemoveRecent when provided", () => {
    const fn = vi.fn();
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} onRemoveRecent={fn} />);
    fireEvent.click(screen.getByTestId("recent-remove-r1"));
    expect(fn).toHaveBeenCalledWith("r1");
  });
  it("remove button fallback removes from localStorage", () => {
    localStorage.setItem("loupe:recent-analyses", JSON.stringify(recents));
    localStorage.setItem("loupe:analysis:r1", JSON.stringify({}));
    render(<IntakeView onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    expect(screen.getByTestId("recent-card-r1")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("recent-remove-r1"));
    expect(screen.queryByTestId("recent-card-r1")).not.toBeInTheDocument();
    expect(screen.getByTestId("recent-card-r2")).toBeInTheDocument();
    expect(localStorage.getItem("loupe:analysis:r1")).toBeNull();
  });
  it("remove button disabled when loading", () => {
    render(<IntakeView recentAnalyses={recents} onUploadFile={vi.fn()} onPasteText={vi.fn()} isLoading />);
    expect(screen.getByTestId("recent-remove-r1")).toBeDisabled();
  });
  it("shows inline intake error", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} error="analysis failed" />);
    expect(screen.getByTestId("intake-error")).toBeInTheDocument();
    expect(screen.getByTestId("intake-error")).toHaveTextContent("analysis failed");
  });
  it("hides intake error when url api error exists", async () => {
    const onUrlSubmit = vi.fn().mockRejectedValue(new Error("Not Found"));
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={onUrlSubmit} error="global boom" />);
    fireEvent.click(screen.getByTestId("tab-url"));
    fireEvent.change(screen.getByTestId("url-input"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    await screen.findByTestId("url-api-error");
    expect(screen.getByTestId("url-api-error")).toHaveTextContent("We could not fetch that page");
    expect(screen.queryByTestId("intake-error")).not.toBeInTheDocument();
  });
  it("url api error shows friendly for Not Found", async () => {
    const onUrlSubmit = vi.fn().mockRejectedValue(new Error("Not Found"));
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={onUrlSubmit} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    fireEvent.change(screen.getByTestId("url-input"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    expect(await screen.findByTestId("url-api-error")).toHaveTextContent("We could not fetch that page");
  });
  it("url api error shows friendly for 404", async () => {
    const onUrlSubmit = vi.fn().mockRejectedValue(new Error("Failed to fetch URL: HTTP 404"));
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={onUrlSubmit} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    fireEvent.change(screen.getByTestId("url-input"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    expect(await screen.findByTestId("url-api-error")).toHaveTextContent("We could not fetch that page");
  });
  it("url api error shows raw for other errors", async () => {
    const onUrlSubmit = vi.fn().mockRejectedValue(new Error("Access denied (403). The website is blocking automated requests."));
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={onUrlSubmit} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    fireEvent.change(screen.getByTestId("url-input"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    expect(await screen.findByTestId("url-api-error")).toHaveTextContent("Access denied");
  });
  it("url api error for non-Error shows fallback", async () => {
    const onUrlSubmit = vi.fn().mockRejectedValue("string error");
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={onUrlSubmit} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    fireEvent.change(screen.getByTestId("url-input"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    expect(await screen.findByTestId("url-api-error")).toHaveTextContent("Failed to fetch URL");
  });
  it("rejects file larger than 100 MB", () => {
    const onUpload = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={onUpload} onPasteText={vi.fn()} />);
    const bigFile = new File(["a"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(bigFile, "size", { value: 51 * 1024 * 1024 });
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile] } });
    expect(screen.getByTestId("file-error")).toBeInTheDocument();
    expect(screen.getByTestId("file-error")).toHaveTextContent("Maximum size is 50 MB");
    expect(onUpload).not.toHaveBeenCalled();
  });
  it("rejects dropped file larger than 100 MB", () => {
    const onUpload = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={onUpload} onPasteText={vi.fn()} />);
    const dz = screen.getByTestId("upload-dropzone");
    const bigFile = new File(["a"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(bigFile, "size", { value: 60 * 1024 * 1024 });
    fireEvent.drop(dz, { dataTransfer: { files: [bigFile] } });
    expect(screen.getByTestId("file-error")).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });
  it("handles drop with no file", () => {
    const onUpload = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={onUpload} onPasteText={vi.fn()} />);
    const dz = screen.getByTestId("upload-dropzone");
    fireEvent.dragOver(dz);
    fireEvent.drop(dz, { dataTransfer: { files: [] } });
    expect(onUpload).not.toHaveBeenCalled();
    expect(dz.className).toContain("border-zinc-300");
  });
  it("handles file change with no file", () => {
    const onUpload = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={onUpload} onPasteText={vi.fn()} />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(onUpload).not.toHaveBeenCalled();
  });
  it("accepts file under 100 MB", () => {
    const onUpload = vi.fn();
    render(<IntakeView recentAnalyses={[]} onUploadFile={onUpload} onPasteText={vi.fn()} />);
    const smallFile = new File(["a"], "small.pdf", { type: "application/pdf" });
    Object.defineProperty(smallFile, "size", { value: 10 * 1024 * 1024 });
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [smallFile] } });
    expect(screen.queryByTestId("file-error")).not.toBeInTheDocument();
    expect(onUpload).toHaveBeenCalled();
  });
  it("url button disabled when empty", () => {
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    const btn = screen.getByTestId("analyze-url-btn");
    expect(btn.className).toContain("opacity-40");
    fireEvent.change(screen.getByTestId("url-input"), { target: { value: "https://example.com" } });
    expect(btn.className).not.toContain("opacity-40");
    expect(btn).not.toBeDisabled();
  });
  it("url api error cleared on input change", async () => {
    const onUrlSubmit = vi.fn().mockRejectedValue(new Error("Not Found"));
    render(<IntakeView recentAnalyses={[]} onUploadFile={vi.fn()} onPasteText={vi.fn()} onUrlSubmit={onUrlSubmit} />);
    fireEvent.click(screen.getByTestId("tab-url"));
    fireEvent.change(screen.getByTestId("url-input"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByTestId("analyze-url-btn"));
    await screen.findByTestId("url-api-error");
    fireEvent.change(screen.getByTestId("url-input"), { target: { value: "https://example.com/2" } });
    expect(screen.queryByTestId("url-api-error")).not.toBeInTheDocument();
  });
});
