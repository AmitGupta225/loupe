import { useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { useLanguage, SUPPORTED_LANGS } from "../../context/LanguageContext";

export function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="language-toggle"
        aria-label="Select language"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
        <Languages size={19} />
      </button>
      {open && (
        <div
          data-testid="language-panel"
          className="absolute right-0 top-12 z-50 min-w-[190px] rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <p className="px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Language</p>
          <div className="mt-1 flex flex-col gap-2">
            {SUPPORTED_LANGS.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  type="button"
                  data-testid={`lang-option-${l.code}`}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}>
                  <span className="flex flex-col items-start gap-1.5 leading-none">
                    <span className="text-sm">{l.label}</span>
                    <span className={`text-[11px] ${active ? "text-white/70 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}>{l.nativeLabel}</span>
                  </span>
                  {active && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
