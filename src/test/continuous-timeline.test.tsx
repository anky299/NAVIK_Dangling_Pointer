import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useContinuousTimeline, timelineState } from "../hero/hooks/useContinuousTimeline";

describe("useContinuousTimeline hook", () => {
  beforeEach(() => {
    localStorage.clear();
    timelineState.progress = 0;
    timelineState.isFinished = false;
    timelineState.isPlaying = true;
    timelineState.reducedMotion = false;
    timelineState.listeners.clear();
  });

  it("should initialize safely without ReferenceError when reduced motion is disabled", () => {
    const { result } = renderHook(() => useContinuousTimeline({ autoPlay: true }));

    expect(result.current.reducedMotion).toBe(false);
    expect(result.current.isFinished).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(typeof result.current.restart).toBe("function");
    expect(typeof result.current.skipToEnd).toBe("function");
    expect(typeof result.current.resetIntroSeen).toBe("function");
  });

  it("should respect prefers-reduced-motion: reduce and skip timeline immediately", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useContinuousTimeline({ autoPlay: true }));

    expect(result.current.reducedMotion).toBe(true);
    expect(result.current.isFinished).toBe(true);
    expect(timelineState.progress).toBe(1.0);
    expect(timelineState.reducedMotion).toBe(true);

    window.matchMedia = originalMatchMedia;
  });

  it("should support skipToEnd and restart actions properly", () => {
    const { result } = renderHook(() => useContinuousTimeline({ autoPlay: true }));

    act(() => {
      result.current.skipToEnd();
    });

    expect(result.current.isFinished).toBe(true);
    expect(timelineState.progress).toBe(1.0);
    expect(localStorage.getItem("navicIntroSeen")).toBe("true");

    act(() => {
      result.current.restart();
    });

    expect(result.current.isFinished).toBe(false);
    expect(timelineState.progress).toBe(0);
  });
});
