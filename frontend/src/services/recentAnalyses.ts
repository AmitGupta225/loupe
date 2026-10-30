import type { AnalyzeResponse } from "../types/contract";

export const RECENT_KEY = "loupe:recent-analyses";
export const STORAGE_PREFIX = "loupe:analysis:";
export const MAX_RECENT = 10;

export interface RecentAnalysisEntry {
  id: string;
  title: string;
  documentId: string;
  analyzedAt: string;
  clauseCount: number;
  findingCount: number;
  riskScore: number | null;
}

export function isStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const test = "__loupe_test__";
    window.localStorage.setItem(test, "1");
    window.localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function getRecentAnalyses(): RecentAnalysisEntry[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentAnalysisEntry[];
  } catch {
    return [];
  }
}

export function saveRecentAnalysis(data: AnalyzeResponse): void {
  if (!isStorageAvailable() || !data?.document_id) return;
  const entry: RecentAnalysisEntry = {
    id: data.document_id,
    documentId: data.document_id,
    title: data.document_id,
    analyzedAt: new Date().toISOString(),
    clauseCount: data.clauses?.length ?? 0,
    findingCount: data.verified_findings?.length ?? 0,
    riskScore: data.executive_summary?.risk_score ?? null,
  };
  try {
    const existing = getRecentAnalyses().filter((e) => e.id !== entry.id);
    const updated = [entry, ...existing].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    window.localStorage.setItem(`${STORAGE_PREFIX}${data.document_id}`, JSON.stringify(data));
  } catch {
    // storage quota or unavailable
  }
}

export function renameRecentAnalysis(oldId: string, newTitle: string): void {
  if (!isStorageAvailable() || !oldId || !newTitle.trim()) return;
  const trimmed = newTitle.trim();
  const list = getRecentAnalyses();
  const idx = list.findIndex((e) => e.id === oldId);
  if (idx === -1) return;
  const updatedEntry = { ...list[idx], title: trimmed };
  const updatedList = [...list];
  updatedList[idx] = updatedEntry;
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(updatedList));
  const storedRaw = window.localStorage.getItem(`${STORAGE_PREFIX}${oldId}`);
  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw) as AnalyzeResponse;
      const updatedData = { ...parsed, document_id: trimmed };
      window.localStorage.setItem(`${STORAGE_PREFIX}${oldId}`, JSON.stringify(updatedData));
      if (oldId !== trimmed) {
        window.localStorage.setItem(`${STORAGE_PREFIX}${trimmed}`, JSON.stringify(updatedData));
        window.localStorage.removeItem(`${STORAGE_PREFIX}${oldId}`);
        const newList = updatedList.map((e) => (e.id === oldId ? { ...e, id: trimmed, documentId: trimmed } : e));
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(newList));
      }
    } catch {
      // ignore parse
    }
  }
}

export function getStoredAnalysis(documentId: string): AnalyzeResponse | null {
  if (!isStorageAvailable() || !documentId) return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${documentId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AnalyzeResponse;
  } catch {
    return null;
  }
}

export function clearRecentAnalyses(): void {
  if (!isStorageAvailable()) return;
  try {
    const list = getRecentAnalyses();
    window.localStorage.removeItem(RECENT_KEY);
    for (const e of list) {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${e.id}`);
    }
  } catch {
    // ignore
  }
}

export function removeRecentAnalysis(id: string): void {
  if (!isStorageAvailable() || !id) return;
  try {
    const filtered = getRecentAnalyses().filter((e) => e.id !== id);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(filtered));
    window.localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  } catch {
    // ignore
  }
}

export function formatAnalyzedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
