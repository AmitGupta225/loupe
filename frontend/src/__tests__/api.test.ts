import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as api from "../services/api";
import type { AnalyzeResponse } from "../types/contract";

const mockHealth = { status: "ok", version: "1.0.0", model: "meta-models/Muse-Spark-Open-816B-A42B", app_name: "Loupe" };
const mockAnalyze: AnalyzeResponse = {
  document_id: "doc-001",
  raw_text: "hello contract",
  clauses: [{ id: "clause-1", title: "1. Test", content: "content", char_start: 0, char_end: 7, level: 1, section_number: "1", clause_type: "general" }],
  defined_terms: { "Confidential Information": "definition" },
  flagged_clause_ids: ["clause-1"],
  verified_findings: [
    {
      clause_id: "clause-1",
      title: "Risk",
      category: "Indemnification",
      severity: "HIGH",
      exact_quote: "content",
      char_start: 0,
      char_end: 7,
      plain_english_explanation: "exp",
      worst_case_scenario: "worst",
      referenced_terms_used: [],
      recommended_redline: "fix",
      grounding_status: "VERIFIED_EXACT",
    },
  ],
  executive_summary: { risk_score: 80, risk_distribution: { HIGH: 1 }, negotiation_priorities: ["cap"], missing_protections: ["mutual"] },
  execution_trace: [{ node: "structural_indexer", started_at: 1, completed_at: 2, duration_ms: 100, status: "completed", detail: "indexed" }],
};

describe("api service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it("fetchHealth success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockHealth } as Response);
    const res = await api.fetchHealth();
    expect(res).toEqual(mockHealth);
    expect(fetch).toHaveBeenCalledWith("/api/v1/health");
  });
  it("fetchHealth error json detail", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => JSON.stringify({ detail: "boom" }) } as Response);
    await expect(api.fetchHealth()).rejects.toThrow("boom");
  });
  it("fetchHealth error json message fallback", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => JSON.stringify({ message: "msg" }) } as Response);
    await expect(api.fetchHealth()).rejects.toThrow("msg");
  });
  it("fetchHealth error raw text fallback", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "raw error" } as Response);
    await expect(api.fetchHealth()).rejects.toThrow("raw error");
  });
  it("fetchHealth error invalid json falls to text", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "{not json" } as Response);
    await expect(api.fetchHealth()).rejects.toThrow("{not json");
  });

  it("fetchHealth error json without detail/message falls to text", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => JSON.stringify({ other: "x" }) } as Response);
    await expect(api.fetchHealth()).rejects.toThrow(JSON.stringify({ other: "x" }));
  });
  it("fetchHealth error handles detail null fallback", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => JSON.stringify({ detail: null, message: null }) } as Response);
    await expect(api.fetchHealth()).rejects.toThrow(JSON.stringify({ detail: null, message: null }));
  });

  it("analyzeContract success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockAnalyze } as Response);
    const res = await api.analyzeContract({ raw_text: "hello", document_id: "doc-001" });
    expect(res.document_id).toBe("doc-001");
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/v1/analyze");
    const opts = call[1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(opts.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(opts.body as string).raw_text).toBe("hello");
  });
  it("analyzeContract error raw text", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "oops" } as Response);
    await expect(api.analyzeContract({ raw_text: "x" })).rejects.toThrow("oops");
  });
  it("analyzeContract error json parse", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "not json {" } as Response);
    await expect(api.analyzeContract({ raw_text: "x" })).rejects.toThrow("not json {");
  });
  it("analyzeUpload success", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockAnalyze } as Response);
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    const res = await api.analyzeUpload(file);
    expect(res.document_id).toBe("doc-001");
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/v1/analyze/upload");
    const opts = call[1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);
  });
  it("analyzeUpload error detail", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => JSON.stringify({ detail: "bad file" }) } as Response);
    const file = new File([""], "bad.pdf", { type: "application/pdf" });
    await expect(api.analyzeUpload(file)).rejects.toThrow("bad file");
  });
  it("analyzeUpload error fallback raw", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "upload fail" } as Response);
    const file = new File(["x"], "a.txt", { type: "text/plain" });
    await expect(api.analyzeUpload(file)).rejects.toThrow("upload fail");
  });

  describe("analyzeUrl", () => {
    it("success", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockAnalyze } as Response);
      const res = await api.analyzeUrl({ url: "https://example.com" });
      expect(res).toEqual(mockAnalyze);
      expect(fetch).toHaveBeenCalledWith("/api/v1/analyze/url", expect.objectContaining({ method: "POST" }));
    });
    it("error", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "plain error" } as Response);
      await expect(api.analyzeUrl({ url: "https://example.com" })).rejects.toThrow("plain error");
    });

    it("uploads multiple files", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockAnalyze } as Response);
      await api.analyzeUploadMultiple([new File(["a"], "a.txt"), new File(["b"], "b.txt")]);
      const request = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
      expect(request.body).toBeInstanceOf(FormData);
    });

    it("reads progress and complete SSE events", async () => {
      const encoder = new TextEncoder();
      const payload = JSON.stringify({ node: "parse", status: "completed", progress: 50, label: "Parsing" });
      const complete = JSON.stringify(mockAnalyze);
      const chunks = [
        `: comment\n\nevent: progress\ndata: ${payload}\n\n`,
        `event: complete\ndata: ${complete}\n\n`,
      ];
      let index = 0;
      const reader = { read: vi.fn(async () => index < chunks.length ? { value: encoder.encode(chunks[index++]), done: false } : { value: undefined, done: true }) };
      global.fetch = vi.fn().mockResolvedValue({ ok: true, body: { getReader: () => reader } } as Response);
      const progress = vi.fn();
      const result = await api.analyzeContractStream({ raw_text: "text" }, progress);
      expect(progress).toHaveBeenCalledWith(JSON.parse(payload));
      expect(result).toEqual(mockAnalyze);
    });

    it("handles missing and error SSE responses", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, body: null } as Response);
      await expect(api.analyzeContractStream({ raw_text: "text" }, vi.fn())).rejects.toThrow("No response body");
      global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => JSON.stringify({ message: "stream failed" }) } as Response);
      await expect(api.analyzeUploadStream([], vi.fn())).rejects.toThrow("stream failed");
    });

    it("handles SSE error events and incomplete streams", async () => {
      const encoder = new TextEncoder();
      const makeResponse = (text: string) => {
        let done = false;
        return {
          ok: true,
          body: { getReader: () => ({ read: vi.fn(async () => done ? { value: undefined, done: true } : (done = true, { value: encoder.encode(text), done: false })) }) },
        } as unknown as Response;
      };
      global.fetch = vi.fn().mockResolvedValue(makeResponse("event: error\ndata: {\"message\":\"bad\"}\n\n"));
      await expect(api.analyzeUrlStream({ url: "https://example.com" }, vi.fn())).rejects.toThrow("bad");
      global.fetch = vi.fn().mockResolvedValue(makeResponse("event: progress\ndata: {not-json}\n\n"));
      await expect(api.analyzeContractStream({ raw_text: "text" }, vi.fn())).rejects.toThrow("Stream ended without complete event");
    });

    it("parses split SSE chunks and ignores malformed progress data", async () => {
      const encoder = new TextEncoder();
      const complete = JSON.stringify(mockAnalyze);
      const chunks = [
        "event: progress\ndata: {not",
        `-json}\n\n:event: progress\ndata: {}\n\nevent: complete\ndata: ${complete}\n\n`,
      ];
      let index = 0;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => ({ read: vi.fn(async () => index < chunks.length ? { value: encoder.encode(chunks[index++]), done: false } : { value: undefined, done: true }) }) },
      } as Response);
      const result = await api.analyzeUploadStream([new File(["x"], "x.txt")], vi.fn());
      expect(result).toEqual(mockAnalyze);
    });

    it("supports URL stream success", async () => {
      const encoder = new TextEncoder();
      const complete = `event: complete\ndata: ${JSON.stringify(mockAnalyze)}\n\n`;
      let used = false;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => ({ read: vi.fn(async () => used ? { value: undefined, done: true } : (used = true, { value: encoder.encode(complete), done: false })) }) },
      } as Response);
      await expect(api.analyzeUrlStream({ url: "https://example.com" }, vi.fn())).resolves.toEqual(mockAnalyze);
    });

    it("sends chat requests", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answer: "Answer", citations: [] }) } as Response);
      await expect(api.sendChat({ question: "What?" })).resolves.toEqual({ answer: "Answer", citations: [] });
      expect(fetch).toHaveBeenCalledWith("/api/v1/chat", expect.objectContaining({ method: "POST" }));
    });
  });
});
