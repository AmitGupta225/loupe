import { useCallback, useRef, useState } from "react";

export interface UseClauseSyncReturn {
  selectedClauseId: string | null;
  selectedFindingId: string | null;
  selectClause: (clauseId: string) => void;
  selectFinding: (findingClauseId: string) => void;
  clearSelection: () => void;
  scrollToClause: (clauseId: string) => void;
  registerClauseRef: (clauseId: string, el: HTMLElement | null) => void;
}

export function useClauseSync(): UseClauseSyncReturn {
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const refs = useRef<Map<string, HTMLElement>>(new Map());

  const selectClause = useCallback((clauseId: string) => {
    if (!clauseId) return;
    setSelectedClauseId(clauseId);
    setSelectedFindingId(clauseId);
  }, []);

  const selectFinding = useCallback((findingClauseId: string) => {
    if (!findingClauseId) return;
    setSelectedFindingId(findingClauseId);
    setSelectedClauseId(findingClauseId);
    const el = refs.current.get(findingClauseId);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("pulse-highlight");
      window.setTimeout(() => el.classList.remove("pulse-highlight"), 1200);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedClauseId(null);
    setSelectedFindingId(null);
  }, []);

  const scrollToClause = useCallback((clauseId: string) => {
    if (!clauseId) return;
    const el = refs.current.get(clauseId);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("pulse-highlight");
      window.setTimeout(() => el.classList.remove("pulse-highlight"), 1200);
    }
    setSelectedClauseId(clauseId);
    setSelectedFindingId(clauseId);
  }, []);

  const registerClauseRef = useCallback((clauseId: string, el: HTMLElement | null) => {
    if (!clauseId) return;
    if (el) refs.current.set(clauseId, el);
    else refs.current.delete(clauseId);
  }, []);

  return { selectedClauseId, selectedFindingId, selectClause, selectFinding, clearSelection, scrollToClause, registerClauseRef };
}
