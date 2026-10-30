import { useCallback, useState } from "react";
import type { AnalyzeResponse } from "../types/contract";
import * as api from "../services/api";
import {
  analyzeContractStream as _analyzeContractStream,
  analyzeUploadStream as _analyzeUploadStream,
  analyzeUrlStream as _analyzeUrlStream,
} from "../services/api";
import type { StreamProgress } from "../services/api";
import { renameRecentAnalysis, saveRecentAnalysis } from "../services/recentAnalyses";

async function callAnalyzeContractStream(
  payload: { raw_text: string; document_id: string },
  onProgress: (p: StreamProgress) => void,
): Promise<AnalyzeResponse> {
  const fn = (api as unknown as Record<string, unknown>).analyzeContractStream as ((p: unknown, cb: unknown) => Promise<AnalyzeResponse>) | undefined;
  if (fn) {
    try {
      const r = await fn(payload, onProgress);
      if (r) return r;
    } catch (e) {
      throw e;
    }
  }
  const legacy = (api as unknown as Record<string, unknown>).analyzeContract as ((p: unknown) => Promise<AnalyzeResponse>) | undefined;
  if (legacy) return legacy(payload);
  return _analyzeContractStream(payload, onProgress);
}
async function callAnalyzeUploadStream(files: File[], onProgress: (p: StreamProgress) => void): Promise<AnalyzeResponse> {
  const fn = (api as unknown as Record<string, unknown>).analyzeUploadStream as ((f: File[], cb: unknown) => Promise<AnalyzeResponse>) | undefined;
  if (fn) {
    try {
      const r = await fn(files, onProgress);
      if (r) return r;
    } catch (e) {
      throw e;
    }
  }
  const legacy = (api as unknown as Record<string, unknown>).analyzeUpload as ((f: File) => Promise<AnalyzeResponse>) | undefined;
  if (legacy && files.length === 1) return legacy(files[0]);
  const legacyMulti = (api as unknown as Record<string, unknown>).analyzeUploadMultiple as ((f: File[]) => Promise<AnalyzeResponse>) | undefined;
  if (legacyMulti) return legacyMulti(files);
  return _analyzeUploadStream(files, onProgress);
}
async function callAnalyzeUrlStream(payload: { url: string; document_id?: string }, onProgress: (p: StreamProgress) => void): Promise<AnalyzeResponse> {
  const fn = (api as unknown as Record<string, unknown>).analyzeUrlStream as ((p: unknown, cb: unknown) => Promise<AnalyzeResponse>) | undefined;
  if (fn) {
    try {
      const r = await fn(payload, onProgress);
      if (r) return r;
    } catch (e) {
      throw e;
    }
  }
  const legacy = (api as unknown as Record<string, unknown>).analyzeUrl as ((p: unknown) => Promise<AnalyzeResponse>) | undefined;
  if (legacy) return legacy(payload);
  return _analyzeUrlStream(payload, onProgress);
}

export type AnalysisStatus = "idle" | "loading" | "complete" | "error";

export interface UseContractAnalysisReturn {
  data: AnalyzeResponse | null;
  status: AnalysisStatus;
  error: string | null;
  progress: number;
  stepLabel: string;
  currentFile: string | null;
  currentFileIndex: number;
  totalFiles: number;
  analyzeText: (rawText: string, documentId?: string) => Promise<void>;
  analyzeFile: (file: File) => Promise<void>;
  analyzeFiles: (files: File[]) => Promise<void>;
  analyzeUrl: (url: string, documentId?: string) => Promise<void>;
  reset: () => void;
  restoreAnalysis: (stored: AnalyzeResponse) => void;
  renameDocument: (newTitle: string) => void;
}

export function useContractAnalysis(): UseContractAnalysisReturn {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const handleProgress = useCallback((p: StreamProgress) => {
    setProgress(p.progress);
    setStepLabel(p.label);
    if (p.current_file) setCurrentFile(p.current_file);
    if (typeof p.current_file_index === "number") setCurrentFileIndex(p.current_file_index);
    if (typeof p.total_files === "number") setTotalFiles(p.total_files);
  }, []);

  const analyzeText = useCallback(
    async (rawText: string, documentId = "doc-001") => {
      if (!rawText || !rawText.trim()) {
        setError("Document text cannot be empty");
        setStatus("error");
        return;
      }
      setStatus("loading");
      setError(null);
      setProgress(1);
      setStepLabel("Parsing document");
      setCurrentFile(null);
      setCurrentFileIndex(0);
      setTotalFiles(0);
      try {
        const result = await callAnalyzeContractStream({ raw_text: rawText, document_id: documentId }, handleProgress);
        setData(result);
        setStatus("complete");
        setProgress(100);
        saveRecentAnalysis(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        setError(msg);
        setStatus("error");
      }
    },
    [handleProgress],
  );

  const analyzeFile = useCallback(
    async (file: File) => {
      if (!file) {
        setError("No file provided");
        setStatus("error");
        return;
      }
      setStatus("loading");
      setError(null);
      setProgress(1);
      setStepLabel("Parsing document");
      setCurrentFile(file.name);
      setCurrentFileIndex(1);
      setTotalFiles(1);
      try {
        const result = await callAnalyzeUploadStream([file], handleProgress);
        setData(result);
        setStatus("complete");
        setProgress(100);
        saveRecentAnalysis(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "File analysis failed";
        setError(msg);
        setStatus("error");
      }
    },
    [handleProgress],
  );

  const analyzeFiles = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) {
        setError("No files provided");
        setStatus("error");
        return;
      }
      if (files.length > 50) {
        setError("Too many files. Maximum is 50.");
        setStatus("error");
        return;
      }
      for (const f of files) {
        if (f.size > 50 * 1024 * 1024) {
          setError(`File ${f.name} too large. Maximum size is 50 MB per file.`);
          setStatus("error");
          return;
        }
      }
      setStatus("loading");
      setError(null);
      setProgress(1);
      setStepLabel("Parsing document");
      setCurrentFile(files[0]?.name || null);
      setCurrentFileIndex(1);
      setTotalFiles(files.length);
      try {
        const result = await callAnalyzeUploadStream(files, handleProgress);
        setProgress(100);
        setStepLabel("Complete");
        setData(result);
        setStatus("complete");
        setProgress(100);
        saveRecentAnalysis(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "File analysis failed";
        setError(msg);
        setStatus("error");
      }
    },
    [handleProgress],
  );

  const analyzeUrl = useCallback(
    async (url: string, documentId?: string) => {
      if (!url || !url.trim()) {
        const msg = "URL cannot be empty";
        setError(msg);
        setStatus("error");
        throw new Error(msg);
      }
      setStatus("loading");
      setError(null);
      setProgress(1);
      setStepLabel("Fetching document");
      try {
        const result = await callAnalyzeUrlStream({ url, document_id: documentId }, handleProgress);
        setData(result);
        setStatus("complete");
        setProgress(100);
        saveRecentAnalysis(result);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "URL analysis failed";
        setError(msg);
        setStatus("error");
        throw e instanceof Error ? e : new Error(msg);
      }
    },
    [handleProgress],
  );

  const reset = useCallback(() => {
    setData(null);
    setStatus("idle");
    setError(null);
    setProgress(0);
    setStepLabel("");
    setCurrentFile(null);
    setCurrentFileIndex(0);
    setTotalFiles(0);
  }, []);

  const restoreAnalysis = useCallback((stored: AnalyzeResponse) => {
    if (!stored) return;
    setData(stored);
    setStatus("complete");
    setError(null);
    setProgress(100);
    setStepLabel("Complete");
  }, []);

  const renameDocument = useCallback((newTitle: string) => {
    if (!newTitle || !newTitle.trim()) return;
    const trimmed = newTitle.trim();
    setData((prev) => {
      if (!prev) return prev;
      const oldId = prev.document_id;
      if (oldId === trimmed) return prev;
      const updated = { ...prev, document_id: trimmed };
      renameRecentAnalysis(oldId, trimmed);
      return updated;
    });
  }, []);

  return {
    data,
    status,
    error,
    progress,
    stepLabel,
    currentFile,
    currentFileIndex,
    totalFiles,
    analyzeText,
    analyzeFile,
    analyzeFiles,
    analyzeUrl,
    reset,
    restoreAnalysis,
    renameDocument,
  };
}
