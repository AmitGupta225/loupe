import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";
import type { AnalyzeResponse } from "../../types/contract";
import { exportAnalysisJson, exportAnalysisPdf } from "../../services/export";
import { useLanguage } from "../../context/LanguageContext";

export function ExportDropdown({ data }: { data: AnalyzeResponse }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="export-btn"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
        <Download size={14} aria-hidden /> {t("Export Analysis")} <ChevronDown size={12} aria-hidden />
      </button>
      {open && (
        <div data-testid="export-menu" className="absolute right-0 z-50 mt-1 w-36 rounded border border-zinc-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            data-testid="export-pdf"
            onClick={() => {
              setOpen(false);
              exportAnalysisPdf(data);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100">
            PDF
          </button>
          <button
            type="button"
            data-testid="export-json"
            onClick={() => {
              setOpen(false);
              exportAnalysisJson(data);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100">
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
