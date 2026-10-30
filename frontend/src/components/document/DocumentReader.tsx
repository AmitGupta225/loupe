import type { ClauseNode, RiskFinding } from "../../types/contract";
import { useLanguage } from "../../context/LanguageContext";

export interface DocumentReaderProps {
  rawText: string;
  clauses: ClauseNode[];
  findings?: RiskFinding[];
  selectedClauseId?: string | null;
  onSelectClause?: (clauseId: string) => void;
  registerClauseRef?: (id: string, el: HTMLElement | null) => void;
  onJumpToAudit?: (clauseId: string) => void;
}

function highlightClasses(severity: string, isSelected: boolean) {
  const base =
    "cursor-pointer rounded-[3px] px-[1px] py-[1px] transition-colors [box-decoration-break:clone] [-webkit-box-decoration-break:clone] decoration-clone leading-[1.8]";
  const sel = isSelected ? " ring-2 ring-zinc-900 ring-offset-1" : "";
  if (severity === "HIGH") return `${base} bg-red-100 border-b border-red-300 hover:bg-red-200${sel}`;
  if (severity === "MEDIUM") return `${base} bg-orange-100 border-b border-orange-300 hover:bg-orange-200${sel}`;
  return `${base} bg-yellow-100 border-b border-yellow-300 hover:bg-yellow-200${sel}`;
}

interface Segment {
  text: string;
  finding?: RiskFinding;
  start: number;
  end: number;
}

export function buildSegments(rawText: string, findings: RiskFinding[]): Segment[] {
  if (!rawText) return [];
  if (!findings || findings.length === 0) {
    return [{ text: rawText, start: 0, end: rawText.length }];
  }
  const resolved: Array<{ f: RiskFinding; start: number; end: number }> = [];
  for (const f of findings) {
    let s = f.char_start;
    let e = f.char_end;
    const hasValid = typeof s === "number" && typeof e === "number" && s >= 0 && e > s && s < rawText.length;
    if (!hasValid) {
      const quote = f.exact_quote || "";
      if (quote && rawText.includes(quote)) {
        const idx = rawText.indexOf(quote);
        s = idx;
        e = idx + quote.length;
      } else {
        continue;
      }
    }
    s = Math.max(0, s);
    e = Math.min(rawText.length, e);
    resolved.push({ f, start: s, end: e });
  }
  resolved.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Array<{ f: RiskFinding; start: number; end: number }> = [];
  let lastEnd = -1;
  for (const r of resolved) {
    if (r.start < lastEnd) r.start = lastEnd;
    if (r.start >= r.end) continue;
    merged.push(r);
    lastEnd = r.end;
  }
  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (m.start > cursor) segments.push({ text: rawText.slice(cursor, m.start), start: cursor, end: m.start });
    segments.push({ text: rawText.slice(m.start, m.end), finding: m.f, start: m.start, end: m.end });
    cursor = m.end;
  }
  segments.push({ text: rawText.slice(cursor), start: cursor, end: rawText.length });
  return segments.filter((s) => s.text.length > 0);
}

export function DocumentReader({ rawText, clauses, findings = [], selectedClauseId, onSelectClause, registerClauseRef, onJumpToAudit }: DocumentReaderProps) {
  const { t } = useLanguage();
  if (!clauses || clauses.length === 0) {
    return (
      <div data-testid="document-reader-empty" className="flex h-full items-center justify-center bg-zinc-50 p-8">
        <div className="max-w-[480px] rounded-md border border-zinc-200 bg-white p-6">
          <h3 className="text-lg font-medium text-zinc-900">{t("No document loaded")}</h3>
          <p className="mt-2 text-sm leading-5 text-zinc-600">{t("Paste agreement text or load a file to view the contract.")}</p>
          {rawText && <p className="mt-3 text-xs text-zinc-500">{rawText.slice(0, 200)}</p>}
        </div>
      </div>
    );
  }
  const segments = buildSegments(rawText, findings);
  return (
    <div data-testid="document-reader" className="flex h-full flex-col bg-zinc-50 px-3 py-4 sm:px-4 lg:px-6 lg:py-8">
      <div
        className="mx-auto flex max-h-[calc(100vh-7rem)] w-full max-w-[840px] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm lg:max-h-[calc(100vh-8rem)]"
        style={{ fontFamily: "'Newsreader', serif" }}>
        <div className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 lg:px-10 lg:py-6">
          <h2 className="text-lg font-semibold text-zinc-900">{t("Original document")}</h2>
          <p className="text-sm text-zinc-500">{t(`${clauses.length} clauses and ${rawText.length} characters`)}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="whitespace-pre-wrap break-words text-[15px] sm:text-[16px]" style={{ lineHeight: 1.8 }} data-testid="document-raw-text" data-translation-skip="true">
            {segments.map((seg, idx) =>
              seg.finding ? (
                <span
                  key={idx}
                  ref={(el) => registerClauseRef?.(seg.finding!.clause_id, el as HTMLElement | null)}
                  data-testid={`highlighted-${seg.finding.clause_id}`}
                  data-severity={seg.finding.severity}
                  onClick={() => {
                    const cid = seg.finding!.clause_id;
                    const el = document.querySelector(`[data-testid="highlighted-${cid}"]`) as HTMLElement | null;
                    if (el && typeof el.scrollIntoView === "function") {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("pulse-highlight");
                      window.setTimeout(() => el.classList.remove("pulse-highlight"), 1200);
                    }
                    onSelectClause?.(cid);
                    onJumpToAudit?.(cid);
                  }}
                  className={highlightClasses(seg.finding.severity, selectedClauseId === seg.finding.clause_id)}
                  title={t("View in Audit Report")}>
                  {seg.text}
                </span>
              ) : (
                <span key={idx}>{seg.text}</span>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
