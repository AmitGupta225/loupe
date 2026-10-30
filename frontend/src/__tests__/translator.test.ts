import { describe, expect, it, vi } from "vitest";
import { getSupportedLanguages, translateTexts } from "../services/translator";

describe("translator service", () => {
  it("returns no-op translations", async () => {
    await expect(translateTexts(["Hello"], "en", "en")).resolves.toEqual(["Hello"]);
    await expect(translateTexts([], "hi")).resolves.toEqual([]);
  });

  it("translates through the backend", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ translated: ["नमस्ते"] }) } as Response);
    await expect(translateTexts(["Hello"], "hi")).resolves.toEqual(["नमस्ते"]);
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/api/v1/translate", expect.objectContaining({ method: "POST" }));
  });

  it("reports translation failures and language fallback", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "down" } as Response);
    await expect(translateTexts(["Hello"], "bn")).rejects.toThrow("Translate failed 503: down");
    await expect(getSupportedLanguages()).resolves.toEqual({ en: "English", hi: "Hindi", bn: "Bengali" });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ languages: { en: "English" } }) } as Response);
    await expect(getSupportedLanguages()).resolves.toEqual({ en: "English" });
  });
});
