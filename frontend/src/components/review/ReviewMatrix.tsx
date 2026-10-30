import { useState } from "react";
import type { AnalyzeResponse, RiskFinding } from "../../types/contract";
import { RiskGauge } from "./RiskGauge";
import { useLanguage } from "../../context/LanguageContext";

export interface ReviewMatrixProps {
  data: AnalyzeResponse;
  onSelectFinding: (finding: RiskFinding) => void;
  selectedFindingId?: string | null;
  onJumpToClause?: (clauseId: string) => void;
}

export function ReviewMatrix({ data, onSelectFinding, selectedFindingId, onJumpToClause }: ReviewMatrixProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [search, setSearch] = useState("");
  // showMissing/showPosture are now inside isolated cards to prevent cross-interference
  const findings = data.verified_findings;
  const filtered = findings.filter((f) => {
    const sev = f.severity;
    if (filter === "high" && sev !== "HIGH") return false;
    if (filter === "medium" && sev !== "MEDIUM") return false;
    if (filter === "low" && sev !== "LOW") return false;
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) && !f.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const clauseMap = new Map(data.clauses.map((c) => [c.id, c]));
  return (
    <div data-testid="review-matrix" className="flex flex-col">
      <div className="border-b border-zinc-200 bg-white px-4 py-4 lg:px-8 lg:py-5">
        <h1 className="break-words text-base font-semibold text-zinc-900 lg:text-lg">{data.document_id}</h1>
      </div>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <RiskGauge
          score={data.executive_summary?.risk_score ?? 0}
          distribution={data.executive_summary?.risk_distribution}
          verdict={data.executive_summary?.verdict}
          conclusion={data.executive_summary?.conclusion}
          advice={data.executive_summary?.advice}
        />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div data-testid="filter-bar" className="inline-flex w-full flex-wrap gap-1 rounded border border-zinc-200 bg-zinc-100 p-1 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              data-testid="filter-all"
              onClick={() => setFilter("all")}
              className={
                filter === "all"
                  ? "rounded bg-white px-3 py-1 text-xs font-medium text-zinc-900 shadow-sm"
                  : "rounded px-3 py-1 text-xs font-medium text-zinc-600"
              }>
              {t("All findings")}
            </button>
            <button
              type="button"
              data-testid="filter-high"
              onClick={() => setFilter("high")}
              className={
                filter === "high"
                  ? "rounded bg-white px-3 py-1 text-xs font-medium text-zinc-900 shadow-sm"
                  : "rounded px-3 py-1 text-xs font-medium text-zinc-600"
              }>
              {t("High")}
            </button>
            <button
              type="button"
              data-testid="filter-medium"
              onClick={() => setFilter("medium")}
              className={
                filter === "medium"
                  ? "rounded bg-white px-3 py-1 text-xs font-medium text-zinc-900 shadow-sm"
                  : "rounded px-3 py-1 text-xs font-medium text-zinc-600"
              }>
              {t("Medium")}
            </button>
            <button
              type="button"
              data-testid="filter-low"
              onClick={() => setFilter("low")}
              className={
                filter === "low"
                  ? "rounded bg-white px-3 py-1 text-xs font-medium text-zinc-900 shadow-sm"
                  : "rounded px-3 py-1 text-xs font-medium text-zinc-600"
              }>
              {t("Low")}
            </button>
          </div>
          <input
            data-testid="review-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search findings")}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none sm:max-w-xs sm:py-1.5"
          />
        </div>
        <div data-testid="review-table" className="mt-4 space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-md border border-zinc-200 bg-white p-6 text-center">
              <p className="text-sm text-zinc-500">{t("No findings match filter")}</p>
            </div>
          ) : (
            filtered.map((finding) => {
              const clause = clauseMap.get(finding.clause_id);
              const isSelected = selectedFindingId === finding.clause_id;
              return (
                <div
                  key={finding.clause_id}
                  data-testid={`review-row-${finding.clause_id}`}
                  onClick={() => onSelectFinding(finding)}
                  className={`cursor-pointer rounded-md border bg-white px-4 py-5 transition hover:shadow-sm sm:px-6 lg:px-8 lg:py-8 ${isSelected ? "border-zinc-900 shadow-sm" : "border-zinc-200 hover:border-zinc-300"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold leading-snug text-zinc-900">{t(finding.title)}</h3>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {t(finding.category)} {t("and Section")} {clause?.section_number || finding.clause_id}
                      </p>
                    </div>
                    <span
                      data-testid={`risk-level-${finding.clause_id}`}
                      className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white"
                      style={{
                        background: finding.severity === "HIGH" ? "#DC2626" : finding.severity === "MEDIUM" ? "#F97316" : "#EAB308",
                      }}>
                      {t(finding.severity === "HIGH" ? "High" : finding.severity === "MEDIUM" ? "Medium" : "Low")}
                    </span>
                  </div>
                  <blockquote
                    data-testid={`quote-${finding.clause_id}`}
                    data-translation-skip="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToClause?.(finding.clause_id);
                    }}
                    className="mt-3 cursor-pointer border-l-2 px-3 py-2 font-serif text-sm italic leading-6 text-zinc-900 hover:bg-zinc-50"
                    style={{
                      borderColor: finding.severity === "HIGH" ? "#DC2626" : finding.severity === "MEDIUM" ? "#F97316" : "#EAB308",
                      background: finding.severity === "HIGH" ? "#FEF2F2" : finding.severity === "MEDIUM" ? "#FFF7ED" : "#FEF9C3",
                    }}
                    title="View in document">
                    “{finding.exact_quote}”
                  </blockquote>
                  <p className="mt-3 text-sm leading-6 text-zinc-700">{t(finding.plain_english_explanation)}</p>{" "}
                  {finding.worst_case_scenario && <p className="mt-2 text-sm leading-6 text-zinc-600">{t(finding.worst_case_scenario)}</p>}{" "}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <MissingProtectionsCard protections={data.executive_summary?.missing_protections} />
          <ExecutivePostureCard summary={data.executive_summary} />
        </div>
      </div>
    </div>
  );
}

function MissingProtectionsCard({ protections }: { protections?: string[] }) {
  const { t } = useLanguage();
  return (
    <div data-testid="missing-protections" className="rounded-md border border-zinc-200 bg-white">
      <div className="px-4 py-3">
        <span className="text-sm font-medium text-zinc-900">{t("Missing standard protections")}</span>
      </div>
      <div data-testid="missing-content" className="border-t border-zinc-200 px-4 py-3">
        {protections?.length ? (
          <ul className="list-disc pl-4">
            {protections.map((m, i) => (
              <li key={i} className="text-sm text-zinc-700">
                {t(m)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">{t("No missing protections detected")}</p>
        )}
      </div>
    </div>
  );
}

function ExecutivePostureCard({ summary }: { summary: AnalyzeResponse["executive_summary"] }) {
  const { t } = useLanguage();
  return (
    <div data-testid="executive-posture" className="rounded-md border border-zinc-200 bg-white">
      <div className="px-4 py-3">
        <span className="text-sm font-medium text-zinc-900">{t("Executive posture")}</span>
      </div>
      <div data-testid="posture-content" className="border-t border-zinc-200 px-4 py-3">
        {summary ? (
          <>
            <p data-testid="posture-score" className="text-sm text-zinc-700">
              {t("Risk score:")} {summary.risk_score}/100
            </p>
            <ul className="mt-2 list-disc pl-4">
              {summary.negotiation_priorities.map((p, i) => (
                <li key={i} className="text-sm text-zinc-700">
                  {t(p)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-zinc-500">{t("No posture available")}</p>
        )}
      </div>
    </div>
  );
}
