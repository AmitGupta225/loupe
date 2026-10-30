import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useContractAnalysis } from "../hooks/useContractAnalysis";
import { useClauseSync } from "../hooks/useClauseSync";
import { clearRecentAnalyses as clearRecentStore, getRecentAnalyses, getStoredAnalysis, removeRecentAnalysis } from "../services/recentAnalyses";
import type { RecentAnalysisEntry } from "../services/recentAnalyses";

export interface AnalysisContextValue {
  data: ReturnType<typeof useContractAnalysis>["data"];
  status: ReturnType<typeof useContractAnalysis>["status"];
  error: ReturnType<typeof useContractAnalysis>["error"];
  progress: ReturnType<typeof useContractAnalysis>["progress"];
  stepLabel: ReturnType<typeof useContractAnalysis>["stepLabel"];
  currentFile: ReturnType<typeof useContractAnalysis>["currentFile"];
  currentFileIndex: ReturnType<typeof useContractAnalysis>["currentFileIndex"];
  totalFiles: ReturnType<typeof useContractAnalysis>["totalFiles"];
  analyzeText: (rawText: string, documentId?: string) => Promise<void>;
  analyzeFile: (file: File) => Promise<void>;
  analyzeFiles: (files: File[]) => Promise<void>;
  analyzeUrl: (url: string, documentId?: string) => Promise<void>;
  reset: () => void;
  renameDocument: (newTitle: string) => void;
  recentAnalyses: RecentAnalysisEntry[];
  handleUploadFile: (file: File) => Promise<void>;
  handleUploadFiles: (files: File[]) => Promise<void>;
  handlePasteText: (text: string) => Promise<void>;
  handleRestoreRecent: (id: string) => void;
  handleClearRecent: () => void;
  handleRemoveRecent: (id: string) => void;
  handleUrlSubmit: (url: string) => Promise<void>;
  selectedClauseId: string | null;
  selectedFindingId: string | null;
  selectClause: (id: string) => void;
  selectFinding: (id: string) => void;
  clearSelection: () => void;
  scrollToClause: (id: string) => void;
  registerClauseRef: (id: string, el: HTMLElement | null) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const analysis = useContractAnalysis();
  const sync = useClauseSync();
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysisEntry[]>(() => getRecentAnalyses());

  const refreshRecent = useCallback(() => {
    setRecentAnalyses(getRecentAnalyses());
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    if (analysis.data && analysis.status === "complete") {
      refreshRecent();
    }
  }, [analysis.data, analysis.status, refreshRecent]);

  const handleUploadFile = useCallback(
    async (file: File) => {
      await analysis.analyzeFile(file);
    },
    [analysis],
  );

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      await analysis.analyzeFiles(files);
    },
    [analysis],
  );

  const handlePasteText = useCallback(
    async (text: string) => {
      await analysis.analyzeText(text, "pasted-doc");
    },
    [analysis],
  );

  const handleRestoreRecent = useCallback(
    (id: string) => {
      const stored = getStoredAnalysis(id);
      if (stored) {
        analysis.restoreAnalysis(stored);
      }
      refreshRecent();
    },
    [analysis, refreshRecent],
  );

  const handleClearRecent = useCallback(() => {
    clearRecentStore();
    refreshRecent();
  }, [refreshRecent]);

  const handleRemoveRecent = useCallback(
    (id: string) => {
      removeRecentAnalysis(id);
      refreshRecent();
    },
    [refreshRecent],
  );

  const handleUrlSubmit = useCallback(
    async (url: string) => {
      await analysis.analyzeUrl(url);
    },
    [analysis],
  );

  const value = useMemo<AnalysisContextValue>(
    () => ({
      data: analysis.data,
      status: analysis.status,
      error: analysis.error,
      progress: analysis.progress,
      stepLabel: analysis.stepLabel,
      currentFile: analysis.currentFile,
      currentFileIndex: analysis.currentFileIndex,
      totalFiles: analysis.totalFiles,
      analyzeText: analysis.analyzeText,
      analyzeFile: analysis.analyzeFile,
      analyzeFiles: analysis.analyzeFiles,
      analyzeUrl: analysis.analyzeUrl,
      reset: analysis.reset,
      renameDocument: analysis.renameDocument,
      recentAnalyses,
      handleUploadFile,
      handleUploadFiles,
      handlePasteText,
      handleRestoreRecent,
      handleClearRecent,
      handleRemoveRecent,
      handleUrlSubmit,
      selectedClauseId: sync.selectedClauseId,
      selectedFindingId: sync.selectedFindingId,
      selectClause: sync.selectClause,
      selectFinding: sync.selectFinding,
      clearSelection: sync.clearSelection,
      scrollToClause: sync.scrollToClause,
      registerClauseRef: sync.registerClauseRef,
    }),
    [
      analysis,
      sync,
      recentAnalyses,
      handleUploadFile,
      handleUploadFiles,
      handlePasteText,
      handleRestoreRecent,
      handleClearRecent,
      handleRemoveRecent,
      handleUrlSubmit,
    ],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
