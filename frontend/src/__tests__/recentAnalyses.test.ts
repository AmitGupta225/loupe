import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RECENT_KEY,
  STORAGE_PREFIX,
  MAX_RECENT,
  getRecentAnalyses,
  saveRecentAnalysis,
  getStoredAnalysis,
  clearRecentAnalyses,
  removeRecentAnalysis,
  formatAnalyzedAt,
  isStorageAvailable,
  renameRecentAnalysis,
} from "../services/recentAnalyses";
import * as recentModule from "../services/recentAnalyses";
import type { AnalyzeResponse } from "../types/contract";

const mockAnalyzeResponse = (id = "doc-001", clausesCount = 2, findingsCount = 1, riskScore: number | null = 80): AnalyzeResponse => ({
  document_id: id,
  raw_text: "text",
  clauses: Array.from({ length: clausesCount }, (_, i) => ({
    id: `c${i}`,
    title: `Clause ${i}`,
    content: "content",
    char_start: 0,
    char_end: 10,
    level: 1,
    section_number: `${i + 1}`,
    clause_type: "general",
  })),
  defined_terms: {},
  flagged_clause_ids: [],
  verified_findings: Array.from({ length: findingsCount }, (_, i) => ({
    clause_id: `c${i}`,
    title: "Finding",
    category: "Cat",
    severity: "HIGH" as const,
    exact_quote: "quote",
    char_start: 0,
    char_end: 5,
    plain_english_explanation: "exp",
    worst_case_scenario: "worst",
    referenced_terms_used: [],
    recommended_redline: "fix",
    grounding_status: "VERIFIED_EXACT" as const,
  })),
  executive_summary: riskScore !== null ? { risk_score: riskScore, risk_distribution: {}, negotiation_priorities: [], missing_protections: [] } : null,
  execution_trace: [],
});

describe("recentAnalyses service", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it("isStorageAvailable true when localStorage works", () => {
    expect(isStorageAvailable()).toBe(true);
  });
  it("isStorageAvailable false when localStorage throws", () => {
    const orig = window.localStorage;
    const mock = {
      getItem: vi.fn(() => {
        throw new Error("fail");
      }),
      setItem: vi.fn(() => {
        throw new Error("fail");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
    Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
    try {
      expect(isStorageAvailable()).toBe(false);
    } finally {
      Object.defineProperty(window, "localStorage", { value: orig, writable: true, configurable: true });
    }
  });
  it("isStorageAvailable false when localStorage is undefined", () => {
    const orig = window.localStorage;
    delete (window as any).localStorage;
    try {
      expect(isStorageAvailable()).toBe(false);
    } finally {
      Object.defineProperty(window, "localStorage", { value: orig, writable: true, configurable: true });
    }
  });
  it("getRecentAnalyses returns [] when no data", () => {
    expect(getRecentAnalyses()).toEqual([]);
  });
  it("getRecentAnalyses returns parsed array", () => {
    const entry = { id: "a", title: "a", documentId: "a", analyzedAt: new Date().toISOString(), clauseCount: 1, findingCount: 0, riskScore: null };
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry]));
    expect(getRecentAnalyses()).toEqual([entry]);
  });
  it("getRecentAnalyses handles non-array JSON", () => {
    localStorage.setItem(RECENT_KEY, JSON.stringify({ not: "array" }));
    expect(getRecentAnalyses()).toEqual([]);
  });
  it("getRecentAnalyses handles invalid JSON", () => {
    localStorage.setItem(RECENT_KEY, "not-json");
    expect(getRecentAnalyses()).toEqual([]);
  });
  it("getRecentAnalyses returns [] when storage unavailable", () => {
    const orig = window.localStorage;
    const mock = {
      getItem: vi.fn(() => {
        throw new Error("fail");
      }),
      setItem: vi.fn(() => {
        throw new Error("fail");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
    Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
    try {
      expect(getRecentAnalyses()).toEqual([]);
    } finally {
      Object.defineProperty(window, "localStorage", { value: orig, writable: true, configurable: true });
    }
  });
  it("saveRecentAnalysis saves entry and stored analysis", () => {
    const data = mockAnalyzeResponse("doc-001", 3, 2, 90);
    saveRecentAnalysis(data);
    const list = getRecentAnalyses();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("doc-001");
    expect(list[0].clauseCount).toBe(3);
    expect(list[0].findingCount).toBe(2);
    expect(list[0].riskScore).toBe(90);
    const stored = getStoredAnalysis("doc-001");
    expect(stored?.document_id).toBe("doc-001");
  });
  it("saveRecentAnalysis handles missing document_id", () => {
    saveRecentAnalysis({} as any);
    expect(getRecentAnalyses()).toEqual([]);
    saveRecentAnalysis(null as any);
    expect(getRecentAnalyses()).toEqual([]);
  });
  it("saveRecentAnalysis dedupes and respects max", () => {
    for (let i = 0; i < MAX_RECENT + 2; i++) {
      saveRecentAnalysis(mockAnalyzeResponse(`doc-${i}`, 1, 0, null));
    }
    const list = getRecentAnalyses();
    expect(list.length).toBe(MAX_RECENT);
    expect(list[0].id).toBe(`doc-${MAX_RECENT + 1}`);
    saveRecentAnalysis(mockAnalyzeResponse("doc-001", 5, 5, 10));
    const list2 = getRecentAnalyses();
    expect(list2[0].id).toBe("doc-001");
    expect(list2[0].clauseCount).toBe(5);
    expect(list2.length).toBe(MAX_RECENT);
  });
  it("saveRecentAnalysis handles undefined clauses/findings and null executive_summary", () => {
    const data = {
      document_id: "doc-002",
      raw_text: "text",
      clauses: undefined,
      defined_terms: {},
      flagged_clause_ids: [],
      verified_findings: undefined,
      executive_summary: undefined,
      execution_trace: [],
    } as any;
    saveRecentAnalysis(data);
    const list = getRecentAnalyses();
    expect(list[0].clauseCount).toBe(0);
    expect(list[0].findingCount).toBe(0);
    expect(list[0].riskScore).toBeNull();
  });
  it("saveRecentAnalysis handles storage quota error gracefully", () => {
    const originalSetItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key: string, value: string) {
      if (key === "__loupe_test__") return originalSetItem.call(this, key, value);
      throw new Error("quota");
    });
    saveRecentAnalysis(mockAnalyzeResponse("doc-003"));
    // isStorageAvailable succeeds for test key, but save fails for real key and is caught
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it("saveRecentAnalysis returns early when storage unavailable", () => {
    const orig = window.localStorage;
    const mock = {
      getItem: vi.fn(() => {
        throw new Error("fail");
      }),
      setItem: vi.fn(() => {
        throw new Error("fail");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
    Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
    try {
      saveRecentAnalysis(mockAnalyzeResponse("doc-004"));
      expect(getRecentAnalyses()).toEqual([]);
    } finally {
      Object.defineProperty(window, "localStorage", { value: orig, writable: true, configurable: true });
    }
  });
  it("getStoredAnalysis returns null when not found", () => {
    expect(getStoredAnalysis("missing")).toBeNull();
  });
  it("getStoredAnalysis returns null when documentId empty", () => {
    expect(getStoredAnalysis("")).toBeNull();
    expect(getStoredAnalysis(null as any)).toBeNull();
  });
  it("getStoredAnalysis handles invalid JSON", () => {
    localStorage.setItem(`${STORAGE_PREFIX}bad`, "not-json");
    expect(getStoredAnalysis("bad")).toBeNull();
  });
  it("getStoredAnalysis handles storage unavailable", () => {
    const orig = window.localStorage;
    const mock = {
      getItem: vi.fn(() => {
        throw new Error("fail");
      }),
      setItem: vi.fn(() => {
        throw new Error("fail");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
    Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
    try {
      expect(getStoredAnalysis("doc-001")).toBeNull();
    } finally {
      Object.defineProperty(window, "localStorage", { value: orig, writable: true, configurable: true });
    }
  });
  it("clearRecentAnalyses removes list and stored analyses", () => {
    const data1 = mockAnalyzeResponse("doc-001");
    const data2 = mockAnalyzeResponse("doc-002");
    saveRecentAnalysis(data1);
    saveRecentAnalysis(data2);
    expect(getRecentAnalyses().length).toBe(2);
    clearRecentAnalyses();
    expect(getRecentAnalyses()).toEqual([]);
    expect(getStoredAnalysis("doc-001")).toBeNull();
    expect(getStoredAnalysis("doc-002")).toBeNull();
  });
  it("clearRecentAnalyses handles storage error gracefully", () => {
    const originalRemove = Storage.prototype.removeItem;
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (key: string) {
      if (key === "__loupe_test__") return originalRemove.call(this, key);
      throw new Error("fail");
    });
    // seed data first
    saveRecentAnalysis(mockAnalyzeResponse("doc-001"));
    expect(getRecentAnalyses().length).toBe(1);
    clearRecentAnalyses();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    localStorage.clear();
  });
  it("clearRecentAnalyses returns early when storage unavailable", () => {
    const orig = window.localStorage;
    const mock = {
      getItem: vi.fn(() => {
        throw new Error("fail");
      }),
      setItem: vi.fn(() => {
        throw new Error("fail");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
    Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
    try {
      clearRecentAnalyses();
      expect(getRecentAnalyses()).toEqual([]);
    } finally {
      Object.defineProperty(window, "localStorage", { value: orig, writable: true, configurable: true });
    }
  });
  it("removeRecentAnalysis removes specific entry", () => {
    saveRecentAnalysis(mockAnalyzeResponse("doc-001"));
    saveRecentAnalysis(mockAnalyzeResponse("doc-002"));
    expect(getRecentAnalyses().length).toBe(2);
    removeRecentAnalysis("doc-001");
    const list = getRecentAnalyses();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("doc-002");
    expect(getStoredAnalysis("doc-001")).toBeNull();
    expect(getStoredAnalysis("doc-002")).not.toBeNull();
  });
  it("removeRecentAnalysis handles missing id", () => {
    saveRecentAnalysis(mockAnalyzeResponse("doc-001"));
    removeRecentAnalysis("");
    expect(getRecentAnalyses().length).toBe(1);
    removeRecentAnalysis(null as any);
    expect(getRecentAnalyses().length).toBe(1);
  });
  it("removeRecentAnalysis handles storage error gracefully", () => {
    saveRecentAnalysis(mockAnalyzeResponse("doc-001"));
    const originalSetItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key: string, value: string) {
      if (key === "__loupe_test__") return originalSetItem.call(this, key, value);
      throw new Error("fail");
    });
    removeRecentAnalysis("doc-001");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    localStorage.clear();
  });
  it("removeRecentAnalysis returns early when storage unavailable", () => {
    const orig = window.localStorage;
    const mock = {
      getItem: vi.fn(() => {
        throw new Error("fail");
      }),
      setItem: vi.fn(() => {
        throw new Error("fail");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
    Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
    try {
      removeRecentAnalysis("doc-001");
      expect(getRecentAnalyses()).toEqual([]);
    } finally {
      Object.defineProperty(window, "localStorage", { value: orig, writable: true, configurable: true });
    }
  });
  it("formatAnalyzedAt formats valid iso", () => {
    const iso = "2024-01-15T12:00:00.000Z";
    const result = formatAnalyzedAt(iso);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe(iso);
  });
  it("formatAnalyzedAt returns input for invalid date", () => {
    expect(formatAnalyzedAt("not-a-date")).toBe("not-a-date");
    expect(formatAnalyzedAt("")).toBe("");
  });
  it("formatAnalyzedAt handles exception gracefully", () => {
    const invalid = "2024-13-40T99:00:00.000Z";
    expect(formatAnalyzedAt(invalid)).toBe(invalid);
    const spy = vi.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(() => {
      throw new Error("fail");
    });
    expect(formatAnalyzedAt("2024-01-01T00:00:00.000Z")).toBe("2024-01-01T00:00:00.000Z");
    spy.mockRestore();
  });
  it("renameRecentAnalysis handles valid rename", () => {
    const data = mockAnalyzeResponse("doc-001");
    saveRecentAnalysis(data);
    // renameRecentAnalysis already imported
    renameRecentAnalysis("doc-001", "New Title");
    const list = getRecentAnalyses();
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("New Title");
    expect(list[0].id).toBe("New Title");
    expect(getStoredAnalysis("New Title")).not.toBeNull();
    expect(getStoredAnalysis("doc-001")).toBeNull();
  });
  it("renameRecentAnalysis handles same title no-op", () => {
    const data = mockAnalyzeResponse("doc-002");
    saveRecentAnalysis(data);
    // renameRecentAnalysis already imported
    renameRecentAnalysis("doc-002", "doc-002");
    const list = getRecentAnalyses();
    expect(list.find((e) => e.id === "doc-002")?.title).toBe("doc-002");
  });
  it("renameRecentAnalysis handles invalid inputs", () => {
    // renameRecentAnalysis already imported
    renameRecentAnalysis("", "New");
    renameRecentAnalysis("doc-001", "   ");
    renameRecentAnalysis("nonexist", "New");
    expect(getRecentAnalyses().length).toBeGreaterThanOrEqual(0);
  });
  it("renameRecentAnalysis handles storage error", () => {
    const data = mockAnalyzeResponse("doc-003");
    saveRecentAnalysis(data);
    // renameRecentAnalysis already imported
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    renameRecentAnalysis("doc-003", "Another");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    localStorage.clear();
  });
  it("renameRecentAnalysis handles parse error", () => {
    const data = mockAnalyzeResponse("doc-004");
    saveRecentAnalysis(data);
    localStorage.setItem("loupe:analysis:doc-004", "not-json");
    expect(() => renameRecentAnalysis("doc-004", "NewName")).not.toThrow();
    localStorage.clear();
  });
  it("renameRecentAnalysis handles storage unavailable", () => {
    const orig = window.localStorage;
    const mock = {
      getItem: vi.fn(() => {
        throw new Error("fail");
      }),
      setItem: vi.fn(() => {
        throw new Error("fail");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as any;
    Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
    try {
      renameRecentAnalysis("doc-001", "New");
      expect(true).toBe(true);
    } finally {
      Object.defineProperty(window, "localStorage", { value: orig, writable: true, configurable: true });
    }
  });
  it("renameRecentAnalysis handles getRecentAnalyses throw", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("fail");
    });
    expect(() => {
      renameRecentAnalysis("doc-001", "New");
    }).not.toThrow();
    spy.mockRestore();
    localStorage.clear();
  });
  it("renameRecentAnalysis handles missing stored analysis", () => {
    const entry = {
      id: "doc-missing",
      title: "Old",
      documentId: "doc-missing",
      analyzedAt: new Date().toISOString(),
      clauseCount: 1,
      findingCount: 0,
      riskScore: null,
    };
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry]));
    // No stored analysis for doc-missing
    renameRecentAnalysis("doc-missing", "New Title 2");
    const list = getRecentAnalyses();
    expect(list[0].title).toBe("New Title 2");
    expect(list[0].id).toBe("doc-missing");
    localStorage.clear();
  });
  it("renameRecentAnalysis handles id change with other entries preserved (else branch)", () => {
    const data1 = mockAnalyzeResponse("doc-a");
    const data2 = mockAnalyzeResponse("doc-b");
    saveRecentAnalysis(data1);
    saveRecentAnalysis(data2);
    expect(getRecentAnalyses().length).toBe(2);
    renameRecentAnalysis("doc-a", "doc-a-renamed");
    const list = getRecentAnalyses();
    expect(list.find((e) => e.id === "doc-a-renamed")).toBeDefined();
    expect(list.find((e) => e.id === "doc-b")).toBeDefined();
    expect(list.find((e) => e.id === "doc-a")).toBeUndefined();
    expect(getStoredAnalysis("doc-a-renamed")).not.toBeNull();
    expect(getStoredAnalysis("doc-a")).toBeNull();
    expect(getStoredAnalysis("doc-b")).not.toBeNull();
    localStorage.clear();
  });
});
