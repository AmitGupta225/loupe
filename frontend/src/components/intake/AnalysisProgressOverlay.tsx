export interface AnalysisProgressOverlayProps {
  isLoading: boolean;
  progress?: number;
  stepLabel?: string;
  currentFile?: string | null;
  currentFileIndex?: number;
  totalFiles?: number;
}

import { useLanguage } from "../../context/LanguageContext";

export function AnalysisProgressOverlay({
  isLoading,
  progress: progressProp,
  stepLabel: stepLabelProp,
  currentFile,
  currentFileIndex,
  totalFiles,
}: AnalysisProgressOverlayProps) {
  const { t } = useLanguage();
  if (!isLoading) return null;

  // If real progress provided via props (streaming), use it; otherwise fallback to indeterminate style
  const hasRealProgress = typeof progressProp === "number" && progressProp > 0;
  const progress = hasRealProgress ? progressProp : 18;
  const stepLabel = stepLabelProp || "Parsing document";

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(progress, 100) / 100);

  return (
    <div data-testid="analysis-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-[380px] rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col items-center">
          <div className="relative h-24 w-24" data-testid="circular-progress">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden>
              <circle cx="48" cy="48" r={radius} stroke="#E5E7EB" strokeWidth="6" fill="none" />
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke="#18181B"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={hasRealProgress ? "transition-all duration-500" : "animate-pulse"}
                data-testid="progress-circle"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span data-testid="progress-percent" className="text-lg font-semibold text-zinc-900">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-900">{t("Analysing contract")}</h3>
          <p data-testid="progress-step" className="mt-1 text-center text-xs text-zinc-500">
            {t(stepLabel)}…
            {currentFile && totalFiles && totalFiles > 1 ? (
              <span data-testid="progress-file" className="mt-1 block text-xs font-medium text-zinc-700">
                {currentFileIndex}/{totalFiles} · {currentFile}
              </span>
            ) : currentFile ? (
              <span data-testid="progress-file" className="mt-1 block text-xs text-zinc-600">
                {currentFile}
              </span>
            ) : null}
          </p>
          <p className="mt-3 text-center text-xs text-zinc-400">{t("Powered by Muse Spark")}</p>
        </div>
      </div>
    </div>
  );
}
