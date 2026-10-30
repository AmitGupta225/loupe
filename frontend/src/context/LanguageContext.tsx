import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { translateTexts, type LangCode } from "../services/translator";

export type LangCodeStrict = LangCode;
export const SUPPORTED_LANGS: { code: LangCode; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
];

type Ctx = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  translateBatch: (texts: string[]) => Promise<string[]>;
  t: (english: string) => string;
  ensureTranslated: (englishKeys: string[]) => Promise<void>;
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "loupe:lang";
const globalCache = new Map<string, string>();
const identityLanguageContext: Ctx = {
  lang: "en",
  setLang: () => undefined,
  translateBatch: async (texts) => texts,
  t: (english) => english,
  ensureTranslated: async () => undefined,
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY) as LangCode | null;
      if (s && ["en", "hi", "bn"].includes(s)) return s;
    } catch {}
    return "en";
  });

  const [version, setVersion] = useState(0);
  const pendingRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const langRef = useRef(lang);
  const translationObserverRef = useRef<MutationObserver | null>(null);
  const translatedNodesRef = useRef(new Map<Text, string>());
  const translatedAttributesRef = useRef(new Map<HTMLElement, Map<string, string>>());
  langRef.current = lang;

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const flushQueue = useCallback(async () => {
    timerRef.current = null;
    const batchLang = langRef.current;
    if (batchLang === "en") return;
    const toTranslate = queueRef.current;
    queueRef.current = [];
    if (toTranslate.length === 0) return;
    const uniq = Array.from(new Set(toTranslate));
    const needed = uniq.filter((txt) => txt.trim() && !globalCache.has(`${batchLang}|${txt}`));
    if (needed.length === 0) {
      uniq.forEach((txt) => pendingRef.current.delete(`${batchLang}|${txt}`));
      return;
    }
    const CHUNK = 50;
    // Split into chunks and translate in parallel (backend batches 50 into 1 curl => ~200ms vs 3s sequential)
    const chunks: string[][] = [];
    for (let i = 0; i < needed.length; i += CHUNK) chunks.push(needed.slice(i, i + CHUNK));
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const translatedChunk = await translateTexts(chunk, batchLang, "en");
          return { chunk, translatedChunk, ok: true as const };
        } catch {
          return { chunk, translatedChunk: chunk, ok: false as const };
        }
      }),
    );
    results.forEach(({ chunk, translatedChunk }) => {
      chunk.forEach((orig, j) => {
        const tr = translatedChunk[j] ?? orig;
        globalCache.set(`${batchLang}|${orig}`, tr);
        pendingRef.current.delete(`${batchLang}|${orig}`);
      });
    });
    setVersion((v) => v + 1);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current !== null) return;
    // 10ms debounce – groups a render burst but feels instant (was 40ms)
    timerRef.current = window.setTimeout(flushQueue, 10);
  }, [flushQueue]);

  const translateBatch = useCallback(
    async (texts: string[]): Promise<string[]> => {
      if (lang === "en" || texts.length === 0) return texts;
      const toFetch: string[] = [];
      const indicesToFetch: number[] = [];
      const result: string[] = new Array(texts.length);
      texts.forEach((txt, idx) => {
        const key = `${lang}|${txt}`;
        if (globalCache.has(key)) result[idx] = globalCache.get(key)!;
        else if (!txt.trim()) result[idx] = txt;
        else {
          toFetch.push(txt);
          indicesToFetch.push(idx);
        }
      });
      if (toFetch.length > 0) {
        const uniq = Array.from(new Set(toFetch));
        const CHUNK = 50;
        const uniqTranslated = new Map<string, string>();
        const tChunks: string[][] = [];
        for (let i = 0; i < uniq.length; i += CHUNK) tChunks.push(uniq.slice(i, i + CHUNK));
        const tResults = await Promise.all(
          tChunks.map(async (chunk) => {
            try {
              const translatedChunk = await translateTexts(chunk, lang, "en");
              return { chunk, translatedChunk };
            } catch {
              return { chunk, translatedChunk: chunk };
            }
          }),
        );
        tResults.forEach(({ chunk, translatedChunk }) => {
          chunk.forEach((orig, j) => {
            const tr = translatedChunk[j] ?? orig;
            uniqTranslated.set(orig, tr);
            globalCache.set(`${lang}|${orig}`, tr);
          });
        });
        indicesToFetch.forEach((origIdx) => {
          result[origIdx] = uniqTranslated.get(texts[origIdx]) ?? texts[origIdx];
        });
        setVersion((v) => v + 1);
      }
      return result.map((r, i) => r ?? texts[i]);
    },
    [lang],
  );

  const ensureTranslated = useCallback(
    async (keys: string[]) => {
      if (lang === "en") return;
      const missing = keys.filter((k) => k.trim() && !globalCache.has(`${lang}|${k}`));
      if (missing.length === 0) return;
      const toFetch = missing.filter((k) => {
        const ck = `${lang}|${k}`;
        if (pendingRef.current.has(ck)) return false;
        pendingRef.current.add(ck);
        return true;
      });
      if (toFetch.length > 0) {
        queueRef.current.push(...toFetch);
        scheduleFlush();
        // also await direct for callers that need result
        await translateBatch(toFetch);
      }
    },
    [lang, translateBatch, scheduleFlush],
  );

  const t = useCallback(
    (english: string): string => {
      void version;
      if (lang === "en" || !english) return english;
      const key = `${lang}|${english}`;
      const cached = globalCache.get(key);
      if (cached !== undefined) return cached;
      if (!english.trim()) return english;
      // queue for live translation – no hardcoded keys needed
      if (!pendingRef.current.has(key)) {
        pendingRef.current.add(key);
        queueRef.current.push(english);
        scheduleFlush();
      }
      return english;
    },
    [lang, version, scheduleFlush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    translationObserverRef.current?.disconnect();
    translationObserverRef.current = null;

    const restoreEnglish = () => {
      translatedNodesRef.current.forEach((original, node) => {
        if (node.parentNode) node.nodeValue = original;
      });
      translatedAttributesRef.current.forEach((attributes, element) => {
        attributes.forEach((value, name) => element.setAttribute(name, value));
      });
      translatedNodesRef.current.clear();
      translatedAttributesRef.current.clear();
    };

    restoreEnglish();
    if (lang === "en") {
      return;
    }

    const originalText = new WeakMap<Text, string>();
    const originalAttributes = new WeakMap<HTMLElement, Map<string, string>>();
    let cancelled = false;
    let running = false;

    const translateRenderedContent = async () => {
      if (cancelled || running || !document.body) return;
      running = true;
      try {
        const nodes: Text[] = [];
        const texts: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const textNode = node as Text;
          const parent = textNode.parentElement;
          if (!parent || parent.closest("[data-translation-skip],script,style,textarea,input")) continue;
          const source = originalText.get(textNode) ?? textNode.nodeValue ?? "";
          if (!source.trim()) continue;
          originalText.set(textNode, source);
          nodes.push(textNode);
          texts.push(source);
        }

        const elements = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter(
          (element) => !element.closest("[data-translation-skip],script,style,textarea,input"),
        );
        const attributes: Array<{ element: HTMLElement; name: string; source: string }> = [];
        elements.forEach((element) => {
          const saved = originalAttributes.get(element) ?? new Map<string, string>();
          originalAttributes.set(element, saved);
          ["aria-label", "title", "placeholder"].forEach((name) => {
            const value = element.getAttribute(name);
            if (value?.trim() && !saved.has(name)) saved.set(name, value);
            const source = saved.get(name);
            if (source?.trim()) attributes.push({ element, name, source });
          });
        });

        const items = [...texts, ...attributes.map((item) => item.source)];
        const translated: string[] = [];
        for (let index = 0; index < items.length; index += 50) {
          translated.push(...(await translateTexts(items.slice(index, index + 50), lang, "en")));
        }
        if (cancelled) return;
        nodes.forEach((textNode, index) => {
          const value = translated[index];
          if (value && textNode.parentNode && textNode.nodeValue !== value) {
            textNode.nodeValue = value;
            translatedNodesRef.current.set(textNode, originalText.get(textNode)!);
          }
        });
        attributes.forEach((item, index) => {
          const value = translated[texts.length + index];
          if (value && item.element.getAttribute(item.name) !== value) {
            item.element.setAttribute(item.name, value);
            translatedAttributesRef.current.set(item.element, originalAttributes.get(item.element)!);
          }
        });
      } finally {
        running = false;
      }
    };

    const scheduleRenderedTranslation = () => {
      if (!cancelled) window.setTimeout(() => void translateRenderedContent(), 0);
    };
    translationObserverRef.current = new MutationObserver(scheduleRenderedTranslation);
    translationObserverRef.current.observe(document.body, { childList: true, subtree: true, characterData: true });
    scheduleRenderedTranslation();

    return () => {
      cancelled = true;
      translationObserverRef.current?.disconnect();
      translationObserverRef.current = null;
      restoreEnglish();
    };
  }, [lang]);

  const value = useMemo<Ctx>(() => ({ lang, setLang, translateBatch, t, ensureTranslated }), [lang, setLang, translateBatch, t, ensureTranslated, version]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const c = useContext(LanguageContext);
  return c ?? identityLanguageContext;
}
