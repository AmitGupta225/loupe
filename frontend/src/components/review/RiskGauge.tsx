import { useLanguage } from "../../context/LanguageContext";

function getFallbackVerdict(score: number) {
  if (score >= 66)
    return {
      label: "High risk",
      tone: "High",
      color: "#DC2626",
      conclusion: "Do not sign",
      advice: "High risk. Get liability capped and make key clauses mutual before you sign.",
    };
  if (score >= 33)
    return {
      label: "Medium risk",
      tone: "Medium",
      color: "#F97316",
      conclusion: "Negotiate first",
      advice: "Medium risk. Fix the flagged clauses on liability and termination before signing.",
    };
  return {
    label: "Low risk",
    tone: "Low",
    color: "#EAB308",
    conclusion: "Proceed with review",
    advice: "Low risk. Standard review is enough. Keep a record of changes.",
  };
}
export function RiskGauge({
  score,
  distribution,
  verdict: verdictProp,
  conclusion: conclusionProp,
  advice: adviceProp,
}: {
  score: number | null | undefined;
  distribution?: Record<string, number>;
  verdict?: string;
  conclusion?: string;
  advice?: string;
}) {
  const { t } = useLanguage();
  const s = typeof score === "number" ? Math.max(0, Math.min(100, score)) : 0;
  const fallback = getFallbackVerdict(s);
  // Prefer LLM-generated fields when provided (structured JSON), fallback to derived only for backwards compat
  const verdict = {
    label: verdictProp && verdictProp.trim() ? verdictProp : fallback.label,
    color: fallback.color,
    conclusion: conclusionProp && conclusionProp.trim() ? conclusionProp : fallback.conclusion,
    advice: adviceProp && adviceProp.trim() ? adviceProp : fallback.advice,
  };
  // needle points up at center; -90 = left (low), 0 = top (med), +90 = right (high)
  let angle = (s / 100) * 180 - 90;
  // for score 0 keep needle slightly upward (not flat horizontal / outside ring)
  if (s === 0) angle = -75;
  if (angle > 90) angle = 90;
  if (angle < -90) angle = -90;

  const CX = 120;
  const CY = 112;
  const R = 70;
  const LABEL_R = R + 18;
  const polar = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };
  const arcPath = (startDeg: number, endDeg: number, r: number) => {
    const start = polar(startDeg, r);
    const end = polar(endDeg, r);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  };
  const SEGMENTS: { start: number; end: number; color: string }[] = [
    { start: 180, end: 240, color: "#EAB308" },
    { start: 240, end: 300, color: "#F97316" },
    { start: 300, end: 360, color: "#DC2626" },
  ];

  return (
    <div data-testid="risk-gauge" className="rounded-md border border-zinc-200 bg-white p-4 pt-6 sm:p-6 lg:p-8 lg:pt-10">
      <div className="flex flex-col items-center text-center">
        <div className="flex w-full justify-center overflow-visible">
          <svg width="320" height="168" viewBox="0 0 240 142" aria-hidden data-testid="gauge-svg" className="h-auto w-full max-w-[320px] overflow-visible">
            <defs>
              <path id="gauge-label-low" d={arcPath(182, 238, LABEL_R)} />
              <path id="gauge-label-med" d={arcPath(242, 298, LABEL_R)} />
              <path id="gauge-label-high" d={arcPath(302, 358, LABEL_R)} />
            </defs>
            {SEGMENTS.map((seg) => (
              <path key={seg.start} d={arcPath(seg.start + 0.8, seg.end - 0.8, R)} stroke={seg.color} strokeWidth="18" fill="none" strokeLinecap="butt" />
            ))}
            <text fontSize="11" fill="#71717A" fontWeight="600">
              <textPath href="#gauge-label-low" startOffset="50%" textAnchor="middle" dy="-6">
                {t("Low")}
              </textPath>
            </text>
            <text fontSize="11" fill="#71717A" fontWeight="600">
              <textPath href="#gauge-label-med" startOffset="50%" textAnchor="middle" dy="-6">
                {t("Medium")}
              </textPath>
            </text>
            <text fontSize="11" fill="#71717A" fontWeight="600">
              <textPath href="#gauge-label-high" startOffset="50%" textAnchor="middle" dy="-6">
                {t("High")}
              </textPath>
            </text>
            <g transform={`rotate(${angle} ${CX} ${CY})`}>
              <line x1={CX} y1={CY} x2={CX} y2={CY - R + 6} stroke="#18181B" strokeWidth="3" strokeLinecap="round" data-testid="gauge-needle" />
              <circle cx={CX} cy={CY} r="7" fill="#18181B" stroke="white" strokeWidth="2" />
            </g>
          </svg>
        </div>
        <div className="mt-4 flex w-full max-w-[720px] flex-col items-center">
          <p className="text-base font-semibold tracking-tight text-zinc-900">{t("Overall Analysis")}</p>
          <p data-testid="risk-score" className="mt-3 text-4xl font-bold tracking-tight" style={{ color: verdict.color }}>
            {s}
            <span className="text-xl font-medium">/100</span>
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <span
              data-testid="verdict-label"
              className="inline-flex rounded-full px-4 py-1.5 text-sm font-semibold text-white"
              style={{ background: verdict.color }}>
              {t(verdict.label)}
            </span>
            <p data-testid="gauge-conclusion" className="text-center text-base font-semibold leading-7 text-zinc-900 sm:text-lg">
              {t(verdict.conclusion)}
            </p>
            <p className="mx-auto max-w-[60ch] text-center text-base leading-7 text-zinc-700">{t(verdict.advice)}</p>
          </div>
          {distribution && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <span className="rounded bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
                {t("High:")} {distribution.HIGH ?? 0}
              </span>
              <span className="rounded bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700">
                {t("Medium:")} {distribution.MEDIUM ?? 0}
              </span>
              <span className="rounded bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700">
                {t("Low:")} {distribution.LOW ?? 0}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
