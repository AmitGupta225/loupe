import { useState } from "react";
import type { RiskFinding } from "../../types/contract";
import { useLanguage } from "../../context/LanguageContext";

export interface InspectionDrawerProps {
  finding: RiskFinding | null;
  isOpen: boolean;
  onClose: () => void;
  onJumpToClause: (clauseId: string) => void;
}

export function InspectionDrawer({ finding, isOpen, onClose, onJumpToClause }: InspectionDrawerProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  if (!isOpen || !finding) return null;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finding.recommended_redline);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <div data-testid="drawer-backdrop" className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={onClose} aria-hidden />
      <div
        data-testid="inspection-drawer"
        className="fixed inset-x-0 bottom-0 z-30 flex max-h-[88vh] flex-col overflow-hidden rounded-t-lg border-t border-zinc-200 bg-white shadow-xl lg:inset-auto lg:bottom-auto lg:right-0 lg:top-0 lg:h-full lg:max-h-none lg:w-[520px] lg:rounded-none lg:border-l lg:border-t-0">
        <div className="flex justify-center py-2 lg:hidden">
          <div className="h-1 w-9 rounded-full bg-zinc-300" />
        </div>
        <div className="sticky top-0 flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <button
            type="button"
            data-testid="drawer-close"
            onClick={onClose}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50">
            {t("Close")}
          </button>
          <button
            type="button"
            data-testid="jump-to-clause"
            onClick={() => onJumpToClause(finding.clause_id)}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
            {t("View in document")}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">{t(finding.title)}</h3>
            <p className="text-sm text-zinc-500">{t(finding.category)}</p>
            <span
              data-testid="drawer-severity"
              className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: finding.severity === "HIGH" ? "#DC2626" : finding.severity === "MEDIUM" ? "#F97316" : "#EAB308" }}>
              {t(finding.severity === "HIGH" ? "High" : finding.severity === "MEDIUM" ? "Medium" : "Low")}
            </span>
          </div>
          <div data-testid="drawer-quote" data-translation-skip="true" className="border-l-2 border-red-600 bg-red-50/40 py-2 pl-4">
            <p className="text-xs font-medium text-zinc-500">{t("Original Clause")}</p>
            <p className="mt-1 font-serif text-sm leading-6 text-zinc-900">&quot;{finding.exact_quote}&quot;</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-900">{t("Why this matters")}</h4>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700">{t(finding.plain_english_explanation)}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">{t(finding.worst_case_scenario)}</p>
          </div>

          <div data-testid="drawer-redline" className="rounded-md border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <span className="text-sm font-medium text-zinc-900">{t("Suggested Change")}</span>
              <button
                type="button"
                data-testid="copy-clause"
                onClick={handleCopy}
                className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">
                {t(copied ? "Copied" : "Copy clause")}
              </button>
            </div>
            <div className="p-4">
              <div data-testid="inline-diff" className="space-y-3">
                <div>
                  <span className="text-xs text-zinc-500">{t("Original")}</span>
                  <p className="mt-1 border-l-2 border-red-600 bg-red-50 px-4 py-3 font-serif text-sm leading-6 text-zinc-900 line-through decoration-red-600">
                    <span data-translation-skip="true">{finding.exact_quote}</span>
                  </p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">{t("Proposed")}</span>
                  <p className="mt-1 border-l-2 border-green-600 bg-green-50 px-4 py-3 font-serif text-sm leading-6 text-zinc-900">
                    {finding.recommended_redline}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
