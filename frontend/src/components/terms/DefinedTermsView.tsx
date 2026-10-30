import type { ClauseNode } from "../../types/contract";
export interface DefinedTermsViewProps {
  definedTerms: Record<string, string>;
  clauses?: ClauseNode[];
}
import { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
export function DefinedTermsView({ definedTerms, clauses = [] }: DefinedTermsViewProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const terms = Object.entries(definedTerms);
  const filtered = terms.filter(([term]) => term.toLowerCase().includes(search.toLowerCase()));
  const clauseMap = new Map(clauses.map((c) => [c.id, c]));
  return (
    <div data-testid="defined-terms-view" className="px-4 py-6 sm:px-6 lg:px-8">
      <h2 className="text-lg font-semibold text-zinc-900">{t("Defined terms")}</h2>
      <p className="text-sm text-zinc-500">{t("Glossary extracted from the agreement")}</p>
      <input
        data-testid="terms-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("Search terms")}
        className="mt-4 w-full max-w-sm rounded-md border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none"
      />
      <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 bg-white">
        {filtered.length === 0 ? (
          <p data-testid="terms-empty" className="px-4 py-8 text-center text-sm text-zinc-500">
            {t("No defined terms match search")}
          </p>
        ) : (
          <div className="min-w-[480px]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">{t("Term")}</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">{t("Definition")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(([term, def]) => (
                  <tr key={term} data-testid={`term-${term}`} className="border-b border-zinc-100">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{term}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{def}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {clauses.length > 0 && (
        <p data-testid="terms-clause-count" className="mt-2 text-xs text-zinc-500">
          {t(`${clauses.length} clauses indexed`)}
        </p>
      )}
      {clauseMap.size > 0 && (
        <span data-testid="terms-map-size" className="hidden">
          {clauseMap.size}
        </span>
      )}
    </div>
  );
}
