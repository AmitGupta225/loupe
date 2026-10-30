import { useEffect, useState, useRef } from "react";
import { Clock3, Trash2, Upload, X, FileText } from "lucide-react";
import type { RecentAnalysisEntry } from "../../services/recentAnalyses";
import { clearRecentAnalyses, formatAnalyzedAt, getRecentAnalyses, removeRecentAnalysis } from "../../services/recentAnalyses";
import { AnalysisProgressOverlay } from "./AnalysisProgressOverlay";
import { useLanguage } from "../../context/LanguageContext";
export interface IntakeViewProps {
  onUploadFile: (file: File) => void | Promise<void>;
  onUploadFiles?: (files: File[]) => void | Promise<void>;
  onPasteText: (text: string) => void | Promise<void>;
  onUrlSubmit?: (url: string) => void | Promise<void>;
  isLoading?: boolean;
  progress?: number;
  stepLabel?: string;
  currentFile?: string | null;
  currentFileIndex?: number;
  totalFiles?: number;
  recentAnalyses?: RecentAnalysisEntry[];
  onRestore?: (id: string) => void | Promise<void>;
  onClearRecent?: () => void;
  onRemoveRecent?: (id: string) => void;
  error?: string | null;
}
type Tab = "upload" | "paste" | "url";
export function IntakeView({
  onUploadFile,
  onUploadFiles,
  onPasteText,
  onUrlSubmit,
  isLoading = false,
  progress,
  stepLabel,
  currentFile,
  currentFileIndex,
  totalFiles,
  recentAnalyses: recentProp,
  onRestore,
  onClearRecent,
  onRemoveRecent,
  error,
}: IntakeViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [pasted, setPasted] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [recentLocal, setRecentLocal] = useState<RecentAnalysisEntry[]>([]);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlApiError, setUrlApiError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    if (recentProp === undefined) {
      setRecentLocal(getRecentAnalyses());
    }
  }, [recentProp]);

  const recent = recentProp !== undefined ? recentProp : recentLocal;

  const handleClear = () => {
    if (onClearRecent) {
      onClearRecent();
    } else {
      clearRecentAnalyses();
      setRecentLocal([]);
    }
  };

  const handleRestore = (id: string) => {
    if (onRestore) onRestore(id);
  };

  const handleRemove = (id: string) => {
    if (onRemoveRecent) {
      onRemoveRecent(id);
    } else {
      removeRecentAnalysis(id);
      setRecentLocal(getRecentAnalyses());
    }
  };

  const [fileError, setFileError] = useState<string | null>(null);

  const validateFiles = (files: File[]): string | null => {
    if (files.length === 0) return "No files selected";
    if (files.length > 50) return "Too many files. Maximum is 50 files.";
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024) return `File ${f.name} is too large. Maximum size is 50 MB per file.`;
    }
    return null;
  };

  const submitFiles = (files: File[]) => {
    const err = validateFiles(files);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    if (onUploadFiles) onUploadFiles(files);
    else if (files.length === 1) onUploadFile(files[0]);
    else {
      // fallback: upload sequentially via onUploadFile? but we have multiple
      // send all as single via onUploadFile first if available
      onUploadFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const list = Array.from(e.dataTransfer.files || []);
    if (list.length === 0) return;
    setSelectedFiles(list);
    submitFiles(list);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;
    setSelectedFiles(list);
    submitFiles(list);
  };
  const handlePasteSubmit = () => {
    if (pasted.trim()) onPasteText(pasted);
  };
  const handleUrlSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setUrlError("URL must start with http:// or https://");
        return;
      }
    } catch {
      setUrlError("Please enter a valid URL starting with http:// or https://");
      return;
    }
    setUrlError(null);
    setUrlApiError(null);
    if (onUrlSubmit) {
      try {
        await onUrlSubmit(trimmed);
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Failed to fetch URL";
        const friendly =
          raw.toLowerCase().includes("not found") || raw.includes("404")
            ? "We could not fetch that page. The link may be wrong or the site may block automated access. Try downloading the file or copying the text."
            : raw;
        setUrlApiError(friendly);
      }
    }
  };
  return (
    <div
      data-testid="intake-view"
      className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <AnalysisProgressOverlay
        isLoading={Boolean(isLoading)}
        progress={progress}
        stepLabel={stepLabel}
        currentFile={currentFile}
        currentFileIndex={currentFileIndex}
        totalFiles={totalFiles}
      />
      <div className="mb-6 lg:mb-8">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900 sm:text-3xl lg:text-[42px]">
          {t("Understand your contract before you sign it")}
        </h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-6 text-zinc-600 sm:text-base sm:leading-7 lg:mt-5">
          {t(
            "Upload your agreement or paste the full text here. We will highlight the risky clauses, show what protections are missing, and suggest clear redlines you can share with the other party.",
          )}
        </p>
      </div>
      {error && !urlApiError && (
        <div data-testid="intake-error" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mb-8">
        <div data-testid="tab-switcher" className="inline-flex w-full flex-wrap gap-1 rounded border border-zinc-200 bg-zinc-100 p-1 sm:w-auto sm:flex-nowrap">
          <button
            type="button"
            data-testid="tab-upload"
            onClick={() => setActiveTab("upload")}
            className={
              activeTab === "upload"
                ? "rounded bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 shadow-sm"
                : "rounded px-4 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700"
            }>
            {t("Upload File")}
          </button>
          <button
            type="button"
            data-testid="tab-paste"
            onClick={() => setActiveTab("paste")}
            className={
              activeTab === "paste"
                ? "rounded bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 shadow-sm"
                : "rounded px-4 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700"
            }>
            {t("Paste Text")}
          </button>
          <button
            type="button"
            data-testid="tab-url"
            onClick={() => setActiveTab("url")}
            className={
              activeTab === "url"
                ? "rounded bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 shadow-sm"
                : "rounded px-4 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700"
            }>
            {t("URL")}
          </button>
        </div>
        <div className="mt-4">
          {activeTab === "upload" && (
            <>
              <div
                data-testid="upload-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 py-6 text-center transition-colors sm:h-56 sm:py-0 ${dragOver ? "border-zinc-900 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800" : "border-zinc-300 bg-white hover:border-zinc-500 hover:bg-[#eceae7] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"}`}>
                <Upload size={28} className="text-zinc-400" aria-hidden />
                <span className="text-sm font-medium text-zinc-700">{t("Drop PDF, DOCX, TXT, PNG or JPEG files here, or click to browse")}</span>
                <span className="text-xs text-zinc-500">{t("Up to 50 files · 50 MB each")}</span>
                <input
                  ref={fileRef}
                  data-testid="file-input"
                  type="file"
                  accept=".pdf,.docx,.txt,.text,.md,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              {selectedFiles.length > 0 && (
                <div data-testid="selected-files" className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-medium text-zinc-700">{t(`${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`)}</p>
                  <ul className="mt-2 space-y-1">
                    {selectedFiles.slice(0, 10).map((f) => (
                      <li key={f.name} className="flex items-center gap-2 text-xs text-zinc-600">
                        <FileText size={12} /> {f.name} <span className="text-zinc-400">({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </li>
                    ))}
                    {selectedFiles.length > 10 && <li className="text-xs text-zinc-500">+{selectedFiles.length - 10} more</li>}
                  </ul>
                  <button type="button" onClick={() => setSelectedFiles([])} className="mt-2 text-xs text-zinc-500 hover:text-zinc-700">
                    {t("Clear")}
                  </button>
                </div>
              )}
              {fileError && (
                <p data-testid="file-error" className="mt-2 text-xs text-red-600">
                  {t(fileError)}
                </p>
              )}
              {isLoading && (
                <span data-testid="upload-loading" className="mt-2 text-xs text-zinc-500">
                  {t("Analyzing…")}
                </span>
              )}
            </>
          )}
          {activeTab === "paste" && (
            <div data-testid="paste-panel">
              <label htmlFor="paste-textarea" className="text-sm font-medium text-zinc-700">
                {t("Paste contract text")}
              </label>
              <textarea
                id="paste-textarea"
                data-testid="paste-textarea"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder={t("Paste the full agreement text here...")}
                className="mt-2 h-56 w-full rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
              <button
                type="button"
                data-testid="analyze-contract-btn"
                onClick={handlePasteSubmit}
                disabled={!pasted.trim() || isLoading}
                className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {t("Analyze contract")}
              </button>
              {isLoading && (
                <span data-testid="paste-loading" className="ml-2 text-xs text-zinc-500">
                  {t("Analyzing…")}
                </span>
              )}
            </div>
          )}
          {activeTab === "url" && (
            <div data-testid="url-panel">
              <label htmlFor="url-input" className="text-sm font-medium text-zinc-700">
                {t("Contract url")}
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="url-input"
                  data-testid="url-input"
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError(null);
                    if (urlApiError) setUrlApiError(null);
                  }}
                  placeholder="https://example.com/agreement"
                  className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />
                <button
                  type="button"
                  data-testid="analyze-url-btn"
                  onClick={handleUrlSubmit}
                  disabled={isLoading}
                  className={`shrink-0 rounded bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 sm:py-2 ${!url.trim() ? "opacity-40 cursor-not-allowed" : ""}`}>
                  {t("Fetch and analyse")}
                </button>
              </div>
              {urlError && (
                <p data-testid="url-error" className="mt-2 text-xs text-red-600">
                  {t(urlError)}
                </p>
              )}
              {urlApiError && (
                <p data-testid="url-api-error" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-4 text-red-700">
                  {t(urlApiError)}
                </p>
              )}
              <p className="mt-3 text-xs leading-4 text-zinc-500">
                {t(
                  "Note: scraping will not always work as some websites block automated access or need login. If the fetch fails, try downloading the file or copying the text.",
                )}
              </p>
              {isLoading && (
                <span data-testid="url-loading" className="mt-2 inline-block text-xs text-zinc-500">
                  {t("Fetching and analyzing…")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div data-testid="recent-analyses-section" className="mt-8 lg:mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-900">{t("Recent analyses")}</p>
          {recent.length > 0 && (
            <button
              type="button"
              data-testid="clear-recent-btn"
              onClick={handleClear}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50">
              <Trash2 size={12} aria-hidden />
              {t("Clear")}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {recent.map((r) => (
            <div
              key={r.id}
              data-testid={`recent-card-${r.id}`}
              className="flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-zinc-900">{r.title}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                  <Clock3 size={12} aria-hidden />
                  <span>{formatAnalyzedAt(r.analyzedAt)}</span>
                  <span aria-hidden>·</span>
                  <span>{r.clauseCount} clauses</span>
                  <span aria-hidden>·</span>
                  <span>{r.findingCount} findings</span>
                  {r.riskScore !== null && r.riskScore !== undefined && (
                    <>
                      <span aria-hidden>·</span>
                      <span>Risk {r.riskScore}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:ml-3">
                {onRestore && (
                  <button
                    type="button"
                    data-testid={`recent-open-${r.id}`}
                    onClick={() => handleRestore(r.id)}
                    disabled={isLoading}
                    className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                    {t("Open")}
                  </button>
                )}
                <button
                  type="button"
                  data-testid={`recent-remove-${r.id}`}
                  onClick={() => handleRemove(r.id)}
                  disabled={isLoading}
                  aria-label={`Remove ${r.title}`}
                  className="inline-flex h-[36px] w-[36px] items-center justify-center rounded border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50">
                  <X size={14} aria-hidden />
                </button>
              </div>
            </div>
          ))}
          {recent.length === 0 && (
            <div data-testid="recent-empty" className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-6 text-center">
              <p className="text-[15px] text-zinc-700">{t("No recent analyses yet")}</p>
              <p className="mt-1 text-sm text-zinc-500">{t("Analyzed contracts will appear here for quick access.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
