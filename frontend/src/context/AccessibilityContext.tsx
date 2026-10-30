import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AccessibilityState = {
  highContrast: boolean;
  darkContrast: boolean;
  invert: boolean;
  saturated: boolean;
  fontScale: number; // 1 = default
  lineHeightLarge: boolean;
  textSpacing: boolean;
  bigCursor: boolean;
  screenReader: boolean;
};

const defaultState: AccessibilityState = {
  highContrast: false,
  darkContrast: false,
  invert: false,
  saturated: false,
  fontScale: 1,
  lineHeightLarge: false,
  textSpacing: false,
  bigCursor: false,
  screenReader: false,
};

type Ctx = AccessibilityState & {
  increaseText: () => void;
  decreaseText: () => void;
  resetText: () => void;
  toggleLineHeight: () => void;
  toggleTextSpacing: () => void;
  toggleHighContrast: () => void;
  toggleDarkContrast: () => void;
  toggleInvert: () => void;
  toggleSaturation: () => void;
  toggleBigCursor: () => void;
  toggleScreenReader: () => void;
  resetAll: () => void;
};

const AccessibilityContext = createContext<Ctx | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AccessibilityState>(defaultState);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("a11y-high-contrast", s.highContrast);
    html.classList.toggle("a11y-dark-contrast", s.darkContrast);
    html.classList.toggle("a11y-invert", s.invert);
    html.classList.toggle("a11y-saturated", s.saturated);
    html.classList.toggle("a11y-line-height", s.lineHeightLarge);
    html.classList.toggle("a11y-text-spacing", s.textSpacing);
    html.classList.toggle("a11y-big-cursor", s.bigCursor);
    html.classList.toggle("a11y-screen-reader", s.screenReader);
    html.style.setProperty("--a11y-font-scale", String(s.fontScale));
    html.classList.toggle("a11y-text-large", s.fontScale !== 1);
    (document.body.style as any).zoom = s.fontScale === 1 ? "" : String(s.fontScale);
  }, [s]);

  const increaseText = () => setS((v) => ({ ...v, fontScale: Math.min(1.5, +(v.fontScale + 0.12).toFixed(2)) }));
  const decreaseText = () => setS((v) => ({ ...v, fontScale: Math.max(0.8, +(v.fontScale - 0.12).toFixed(2)) }));
  const resetText = () => setS((v) => ({ ...v, fontScale: 1 }));
  const toggleLineHeight = () => setS((v) => ({ ...v, lineHeightLarge: !v.lineHeightLarge }));
  const toggleTextSpacing = () => setS((v) => ({ ...v, textSpacing: !v.textSpacing }));
  const toggleHighContrast = () => setS((v) => ({ ...v, highContrast: !v.highContrast, darkContrast: false }));
  const toggleDarkContrast = () => setS((v) => ({ ...v, darkContrast: !v.darkContrast, highContrast: false }));
  const toggleInvert = () => setS((v) => ({ ...v, invert: !v.invert }));
  const toggleSaturation = () => setS((v) => ({ ...v, saturated: !v.saturated }));
  const toggleBigCursor = () => setS((v) => ({ ...v, bigCursor: !v.bigCursor }));
  const toggleScreenReader = () => setS((v) => ({ ...v, screenReader: !v.screenReader }));
  const resetAll = () => {
    setS(defaultState);
    (document.body.style as any).zoom = "";
  };

  return (
    <AccessibilityContext.Provider
      value={{
        ...s,
        increaseText,
        decreaseText,
        resetText,
        toggleLineHeight,
        toggleTextSpacing,
        toggleHighContrast,
        toggleDarkContrast,
        toggleInvert,
        toggleSaturation,
        toggleBigCursor,
        toggleScreenReader,
        resetAll,
      }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const c = useContext(AccessibilityContext);
  if (!c) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return c;
}
