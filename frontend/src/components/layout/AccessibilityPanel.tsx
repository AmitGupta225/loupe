import { useEffect, useRef, useState } from "react";
import {
  Accessibility,
  SunDim,
  Moon,
  Contrast,
  Palette,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  AlignJustify,
  Text,
  MousePointer2,
  Volume2,
  X,
} from "lucide-react";
import { useAccessibility } from "../../context/AccessibilityContext";

function A11yButton({
  active,
  onClick,
  icon,
  label,
  testId,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border px-3 py-4 text-center text-xs font-medium leading-tight transition ${
        active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white"
      }`}>
      <span className={active ? "text-white" : "text-zinc-600"}>{icon}</span>
      <span className="text-xs leading-none">{label}</span>
    </button>
  );
}

export function AccessibilityControls({ onClose }: { onClose?: () => void }) {
  const a = useAccessibility();
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
          <h3 className="text-sm font-semibold text-zinc-900">Color adjustment</h3>
          <button type="button" onClick={a.resetAll} data-testid="a11y-reset-all" className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
            Reset
          </button>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <A11yButton active={a.highContrast} onClick={a.toggleHighContrast} icon={<SunDim size={20} />} label="High contrast" testId="a11y-high-contrast" />
          <A11yButton active={a.darkContrast} onClick={a.toggleDarkContrast} icon={<Moon size={20} />} label="Dark contrast" testId="a11y-dark-contrast" />
          <A11yButton active={a.invert} onClick={a.toggleInvert} icon={<Contrast size={20} />} label="Invert" testId="a11y-invert" />
          <A11yButton active={a.saturated} onClick={a.toggleSaturation} icon={<Palette size={20} />} label="Saturation" testId="a11y-saturation" />
        </div>
      </div>

      <div>
        <div className="border-b border-zinc-200 pb-2">
          <h3 className="text-sm font-semibold text-zinc-900">Text size</h3>
        </div>
        <div className="mt-3.5 grid grid-cols-3 gap-2.5">
          <A11yButton onClick={a.increaseText} icon={<ArrowUp size={20} />} label="Increase text" testId="a11y-increase-text" />
          <A11yButton onClick={a.decreaseText} icon={<ArrowDown size={20} />} label="Decrease text" testId="a11y-decrease-text" />
          <A11yButton onClick={a.resetText} icon={<RotateCcw size={20} />} label="Reset text" testId="a11y-reset-text" />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <A11yButton active={a.lineHeightLarge} onClick={a.toggleLineHeight} icon={<AlignJustify size={20} />} label="Line height" testId="a11y-line-height" />
          <A11yButton active={a.textSpacing} onClick={a.toggleTextSpacing} icon={<Text size={20} />} label="Text spacing" testId="a11y-text-spacing" />
        </div>
      </div>

      <div>
        <div className="border-b border-zinc-200 pb-2">
          <h3 className="text-sm font-semibold text-zinc-900">Navigation adjustment</h3>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <A11yButton active={a.bigCursor} onClick={a.toggleBigCursor} icon={<MousePointer2 size={20} />} label="Big cursor" testId="a11y-big-cursor" />
          <A11yButton active={a.screenReader} onClick={a.toggleScreenReader} icon={<Volume2 size={20} />} label="Screen reader" testId="a11y-screen-reader" />
        </div>
        {a.screenReader && <p className="mt-2 text-xs text-zinc-500">Screen reader announcements enabled.</p>}
        {onClose && (
          <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-700">
            Close
          </button>
        )}
      </div>
    </div>
  );
}

export function AccessibilityToggle() {
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
        data-testid="a11y-toggle"
        aria-label="Accessibility tools"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50">
        <Accessibility size={19} />
      </button>
      {open && (
        <>
          {/* Desktop: anchored panel */}
          <div
            data-testid="a11y-panel"
            className="absolute right-0 top-12 z-50 hidden w-[380px] rounded-xl border border-zinc-200 bg-white p-5 shadow-xl lg:block">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Accessibility tools</h2>
              <button
                type="button"
                aria-label="Close accessibility panel"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100">
                <X size={14} />
              </button>
            </div>
            <AccessibilityControls onClose={() => setOpen(false)} />
          </div>
          {/* Mobile: bottom sheet */}
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 lg:hidden">
            <div
              data-testid="a11y-panel-mobile"
              className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Accessibility tools</h2>
                <button
                  type="button"
                  aria-label="Close accessibility panel"
                  onClick={() => setOpen(false)}
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100">
                  <X size={18} />
                </button>
              </div>
              <AccessibilityControls onClose={() => setOpen(false)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
