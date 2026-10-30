import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { AccessibilityToggle } from "./AccessibilityPanel";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSelector } from "./LanguageSelector";
import { Sidebar, SidebarView } from "./Sidebar";
import { IntakeView } from "../intake/IntakeView";
import { ReviewMatrix } from "../review/ReviewMatrix";
import { DocumentReader } from "../document/DocumentReader";
import { DefinedTermsView } from "../terms/DefinedTermsView";
import { InspectionDrawer } from "../inspection/InspectionDrawer";
import { ExportDropdown } from "./ExportDropdown";
import { ChatView } from "../chat/ChatView";
import { useAnalysis } from "../../context/AnalysisContext";
import type { RiskFinding } from "../../types/contract";
import { useLanguage } from "../../context/LanguageContext";

export function AppShell() {
  const {
    data,
    recentAnalyses,
    status,
    error,
    progress,
    stepLabel,
    currentFile,
    currentFileIndex,
    totalFiles,
    reset,
    renameDocument,
    handleUploadFile,
    handleUploadFiles,
    handlePasteText,
    handleUrlSubmit,
    handleRestoreRecent,
    handleClearRecent,
    handleRemoveRecent,
    selectedClauseId,
    selectClause,
    scrollToClause,
    registerClauseRef,
  } = useAnalysis();
  const { t: tApp } = useLanguage();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  useEffect(() => {
    if (data?.document_id) setTitleDraft(data.document_id);
  }, [data?.document_id]);
  const hasDocument = Boolean(data);
  const [activeView, setActiveView] = useState<SidebarView>("intake");
  useEffect(() => {
    if (!hasDocument && activeView !== "intake") {
      setActiveView("intake");
    }
  }, [hasDocument, activeView]);
  const [drawerFinding, setDrawerFinding] = useState<RiskFinding | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [pendingJumpId, setPendingJumpId] = useState<string | null>(null);
  const [pendingAuditJumpId, setPendingAuditJumpId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLoading = status === "loading";
  const handleNavigate = (view: SidebarView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };
  const handleNewContract = () => {
    reset();
    setActiveView("intake");
    setIsDrawerOpen(false);
    setDrawerFinding(null);
    setMobileMenuOpen(false);
  };
  const handleSelectFinding = (finding: RiskFinding) => {
    setDrawerFinding(finding);
    setIsDrawerOpen(true);
    selectClause(finding.clause_id);
  };
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerFinding(null);
  };
  const handleJumpToClause = (clauseId: string) => {
    setActiveView("document");
    setIsDrawerOpen(false);
    setPendingJumpId(clauseId);
    selectClause(clauseId);
  };
  const handleJumpToAudit = (clauseId: string) => {
    const finding = data?.verified_findings.find((f) => f.clause_id === clauseId);
    if (finding) {
      setDrawerFinding(finding);
      setIsDrawerOpen(true);
    }
    selectClause(clauseId);
    scrollToClause(clauseId);
    window.setTimeout(() => {
      setActiveView("audit");
      setPendingAuditJumpId(clauseId);
    }, 280);
  };
  const effectiveView: SidebarView = !hasDocument ? "intake" : activeView === "intake" ? "audit" : activeView;
  useEffect(() => {
    if (!pendingJumpId) return;
    const doScroll = () => scrollToClause(pendingJumpId);
    doScroll();
    const t1 = window.setTimeout(doScroll, 60);
    const t2 = window.setTimeout(doScroll, 250);
    const clear = window.setTimeout(() => setPendingJumpId(null), 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(clear);
    };
  }, [pendingJumpId, scrollToClause]);
  useEffect(() => {
    if (!pendingAuditJumpId) return;
    const doAuditScroll = () => {
      const el = document.querySelector(`[data-testid="review-row-${pendingAuditJumpId}"]`);
      if (el && typeof (el as HTMLElement).scrollIntoView === "function") {
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("pulse-highlight");
        window.setTimeout(() => el.classList.remove("pulse-highlight"), 1200);
      }
    };
    const t1 = window.setTimeout(doAuditScroll, 80);
    const t2 = window.setTimeout(doAuditScroll, 300);
    const clear = window.setTimeout(() => setPendingAuditJumpId(null), 800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(clear);
    };
  }, [pendingAuditJumpId, effectiveView]);
  if (!hasDocument) {
    return (
      <div data-testid="app-shell" className="min-h-screen bg-zinc-50">
        <nav
          data-testid="upload-navbar"
          className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:h-[72px] lg:px-9">
          <button
            type="button"
            data-testid="brand-logo-btn"
            onClick={handleNewContract}
            className="flex items-center gap-2.5 rounded px-1 py-1 hover:opacity-80">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-zinc-900">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="20" y2="20" />
            </svg>
            <span className="text-[20px] font-semibold tracking-tight text-zinc-900 lg:text-[22px]">Loupe</span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <AccessibilityToggle />
            <ThemeToggle />
          </div>
        </nav>
        <IntakeView
          recentAnalyses={recentAnalyses}
          onUploadFile={handleUploadFile}
          onUploadFiles={handleUploadFiles}
          onPasteText={handlePasteText}
          onUrlSubmit={handleUrlSubmit}
          onRestore={handleRestoreRecent}
          onClearRecent={handleClearRecent}
          onRemoveRecent={handleRemoveRecent}
          isLoading={isLoading}
          progress={progress}
          stepLabel={stepLabel}
          currentFile={currentFile}
          currentFileIndex={currentFileIndex}
          totalFiles={totalFiles}
          error={error}
        />
        <InspectionDrawer
          finding={drawerFinding}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onJumpToClause={handleJumpToClause}
        />
      </div>
    );
  }
  return (
    <div data-testid="app-shell" className="flex h-screen flex-col overflow-hidden bg-zinc-50 lg:flex-row">
      {/* Mobile top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          data-testid="mobile-menu-toggle"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-700">
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <button
          type="button"
          data-testid="brand-logo-btn-mobile"
          onClick={handleNewContract}
          className="flex items-center gap-2 rounded px-1 py-1 hover:opacity-80">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0 text-zinc-900">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="20" y2="20" />
          </svg>
          <span className="text-[17px] font-semibold tracking-tight text-zinc-900">Loupe</span>
        </button>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <AccessibilityToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden shrink-0 lg:flex">
        <Sidebar
          activeView={effectiveView}
          onNavigate={handleNavigate}
          onNewContract={handleNewContract}
          documentTitle={data?.document_id}
          clauseCount={data?.clauses.length}
          hasDocument={hasDocument}
        />
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <>
          <div data-testid="mobile-overlay" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 flex lg:hidden">
            <Sidebar
              activeView={effectiveView}
              onNavigate={handleNavigate}
              onNewContract={handleNewContract}
              documentTitle={data?.document_id}
              clauseCount={data?.clauses.length}
              hasDocument={hasDocument}
              dataTestId="mobile-sidebar"
            />
          </div>
        </>
      )}

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-50">
        {error && (
          <div
            data-testid="error-banner"
            className="flex flex-col gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span className="break-words">{error}</span>
            <button
              type="button"
              data-testid="dismiss-error"
              onClick={reset}
              className="shrink-0 self-start rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 sm:self-auto">
              {tApp("Dismiss")}
            </button>
          </div>
        )}
        <div
          data-testid="workspace-header"
          className="flex min-h-[56px] shrink-0 flex-col justify-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:h-[72px] lg:flex-row lg:px-8 lg:py-0">
          <div className="min-w-0 flex-1">
            {isEditingTitle ? (
              <input
                data-testid="title-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  setIsEditingTitle(false);
                  if (titleDraft.trim() && titleDraft !== data?.document_id) renameDocument(titleDraft);
                  else if (data?.document_id) setTitleDraft(data.document_id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    setIsEditingTitle(false);
                    if (data?.document_id) setTitleDraft(data.document_id);
                  }
                }}
                autoFocus
                className="w-full max-w-[380px] rounded border border-zinc-300 px-3 py-1.5 text-[16px] font-semibold text-zinc-900 focus:border-zinc-900 focus:outline-none lg:text-[17px]"
              />
            ) : (
              <h2
                data-testid="editable-title"
                onClick={() => setIsEditingTitle(true)}
                className="cursor-text truncate text-[16px] font-semibold leading-tight text-zinc-900 hover:bg-zinc-50 lg:text-[18px]">
                {titleDraft || data?.document_id}
              </h2>
            )}
            <p className="mt-0.5 text-[12px] text-zinc-500 lg:text-[13px]">
              {tApp(`${data?.clauses.length} clauses and ${data?.verified_findings.length} findings`)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data && <ExportDropdown data={data} />}
            <span className="flex items-center gap-2">
              <LanguageSelector />
              <AccessibilityToggle />
              <ThemeToggle />
            </span>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {effectiveView === "audit" ? (
            <div className="flex-1 overflow-y-auto">
              <ReviewMatrix data={data!} onSelectFinding={handleSelectFinding} selectedFindingId={selectedClauseId} onJumpToClause={handleJumpToClause} />
            </div>
          ) : effectiveView === "document" ? (
            <div className="flex-1 overflow-y-auto bg-zinc-50">
              <DocumentReader
                rawText={data!.raw_text}
                clauses={data!.clauses}
                findings={data!.verified_findings}
                selectedClauseId={selectedClauseId}
                onSelectClause={(id) => selectClause(id)}
                registerClauseRef={registerClauseRef}
                onJumpToAudit={handleJumpToAudit}
              />
            </div>
          ) : effectiveView === "terms" ? (
            <div className="flex-1 overflow-y-auto">
              <DefinedTermsView definedTerms={data!.defined_terms} clauses={data!.clauses} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto bg-zinc-50">
              <ChatView documentId={data!.document_id} rawText={data!.raw_text} hasDocument={hasDocument} />
            </div>
          )}
        </div>
      </main>
      <InspectionDrawer
        finding={drawerFinding}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onJumpToClause={handleJumpToClause}
      />
    </div>
  );
}
