import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClauseSync } from "../hooks/useClauseSync";

describe("useClauseSync", () => {
  it("initial null selections", () => {
    const { result } = renderHook(() => useClauseSync());
    expect(result.current.selectedClauseId).toBeNull();
    expect(result.current.selectedFindingId).toBeNull();
  });
  it("selectClause sets both", () => {
    const { result } = renderHook(() => useClauseSync());
    act(() => result.current.selectClause("clause-1"));
    expect(result.current.selectedClauseId).toBe("clause-1");
    expect(result.current.selectedFindingId).toBe("clause-1");
  });
  it("selectClause ignores empty", () => {
    const { result } = renderHook(() => useClauseSync());
    act(() => result.current.selectClause(""));
    expect(result.current.selectedClauseId).toBeNull();
  });
  it("selectFinding sets both and scrolls", () => {
    const { result } = renderHook(() => useClauseSync());
    const el = document.createElement("div");
    el.scrollIntoView = vi.fn();
    act(() => result.current.registerClauseRef("clause-1", el));
    act(() => result.current.selectFinding("clause-1"));
    expect(result.current.selectedClauseId).toBe("clause-1");
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.classList.contains("pulse-highlight")).toBe(true);
  });
  it("selectFinding ignores empty", () => {
    const { result } = renderHook(() => useClauseSync());
    act(() => result.current.selectFinding(""));
    expect(result.current.selectedClauseId).toBeNull();
  });
  it("selectFinding without registered ref still sets", () => {
    const { result } = renderHook(() => useClauseSync());
    act(() => result.current.selectFinding("clause-2"));
    expect(result.current.selectedClauseId).toBe("clause-2");
  });
  it("clearSelection resets", () => {
    const { result } = renderHook(() => useClauseSync());
    act(() => result.current.selectClause("clause-1"));
    act(() => result.current.clearSelection());
    expect(result.current.selectedClauseId).toBeNull();
    expect(result.current.selectedFindingId).toBeNull();
  });
  it("scrollToClause scrolls and sets", () => {
    const { result } = renderHook(() => useClauseSync());
    const el = document.createElement("div");
    el.scrollIntoView = vi.fn();
    act(() => result.current.registerClauseRef("clause-3", el));
    act(() => result.current.scrollToClause("clause-3"));
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(result.current.selectedClauseId).toBe("clause-3");
  });
  it("scrollToClause ignores empty", () => {
    const { result } = renderHook(() => useClauseSync());
    act(() => result.current.scrollToClause(""));
    expect(result.current.selectedClauseId).toBeNull();
  });
  it("scrollToClause without ref still sets", () => {
    const { result } = renderHook(() => useClauseSync());
    act(() => result.current.scrollToClause("clause-99"));
    expect(result.current.selectedClauseId).toBe("clause-99");
  });
  it("registerClauseRef adds and removes", () => {
    const { result } = renderHook(() => useClauseSync());
    const el = document.createElement("div");
    act(() => result.current.registerClauseRef("c1", el));
    act(() => result.current.registerClauseRef("c1", null));
    act(() => result.current.selectFinding("c1"));
    expect(result.current.selectedClauseId).toBe("c1");
  });
  it("registerClauseRef ignores empty id", () => {
    const { result } = renderHook(() => useClauseSync());
    const el = document.createElement("div");
    act(() => result.current.registerClauseRef("", el));
    expect(result.current.selectedClauseId).toBeNull();
  });
  it("pulse class removed after timeout", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useClauseSync());
    const el = document.createElement("div");
    el.scrollIntoView = vi.fn();
    act(() => result.current.registerClauseRef("c1", el));
    act(() => result.current.selectFinding("c1"));
    expect(el.classList.contains("pulse-highlight")).toBe(true);
    act(() => vi.advanceTimersByTime(1300));
    expect(el.classList.contains("pulse-highlight")).toBe(false);
    vi.useRealTimers();
  });
  it("scrollToClause pulse removal", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useClauseSync());
    const el = document.createElement("div");
    el.scrollIntoView = vi.fn();
    act(() => result.current.registerClauseRef("c2", el));
    act(() => result.current.scrollToClause("c2"));
    act(() => vi.advanceTimersByTime(1300));
    expect(el.classList.contains("pulse-highlight")).toBe(false);
    vi.useRealTimers();
  });
});
