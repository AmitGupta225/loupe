/** Client for the backend proxy to Google's free public translation API. */

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_BASE_URL || "http://localhost:8000";

export type LangCode = "en" | "hi" | "bn";

export async function translateTexts(texts: string[], targetLang: LangCode, sourceLang: LangCode = "en"): Promise<string[]> {
  if (targetLang === sourceLang) return texts;
  if (texts.length === 0) return [];
  // Filter out empty - but preserve positions
  const resp = await fetch(`${API_BASE}/api/v1/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target_lang: targetLang, source_lang: sourceLang }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Translate failed ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.translated as string[];
}

export async function getSupportedLanguages(): Promise<Record<string, string>> {
  const resp = await fetch(`${API_BASE}/api/v1/languages`);
  if (!resp.ok) return { en: "English", hi: "Hindi", bn: "Bengali" };
  const data = await resp.json();
  return data.languages;
}
