import { useCallback, useEffect, useRef } from 'react';
import type { AssessmentSectionId } from '../domain/types.ts';

export interface TimingSnapshot {
  activeTimeMs: number;
  inactiveTimeMs: number;
  wallTimeMs: number;
}

/**
 * Tracks active interaction time vs tab-inactive/blurred idle time for a single question.
 * Distinguishes active engagement from background tabs without interpreting time as difficulty.
 */
export function useQuestionTiming(
  questionId: string | null,
  sectionId: AssessmentSectionId | null,
  onLeaveAbandon?: (payload: {
    questionId: string;
    sectionId: AssessmentSectionId;
    timing: TimingSnapshot;
  }) => void
) {
  const displayStartRef = useRef<number>(Date.now());
  const activeAccumRef = useRef<number>(0);
  const inactiveAccumRef = useRef<number>(0);
  const activeSegStartRef = useRef<number | null>(Date.now());
  const inactiveSegStartRef = useRef<number | null>(null);
  const completedCurrentRef = useRef<boolean>(false);

  const isVisibleAndFocused = () => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  };

  useEffect(() => {
    if (!questionId) return;
    const now = Date.now();
    displayStartRef.current = now;
    activeAccumRef.current = 0;
    inactiveAccumRef.current = 0;
    completedCurrentRef.current = false;

    if (isVisibleAndFocused()) {
      activeSegStartRef.current = now;
      inactiveSegStartRef.current = null;
    } else {
      activeSegStartRef.current = null;
      inactiveSegStartRef.current = now;
    }

    const pauseToInactive = () => {
      const ts = Date.now();
      if (activeSegStartRef.current !== null) {
        activeAccumRef.current += Math.max(0, ts - activeSegStartRef.current);
        activeSegStartRef.current = null;
      }
      if (inactiveSegStartRef.current === null) {
        inactiveSegStartRef.current = ts;
      }
    };

    const resumeToActive = () => {
      const ts = Date.now();
      if (inactiveSegStartRef.current !== null) {
        inactiveAccumRef.current += Math.max(
          0,
          ts - inactiveSegStartRef.current
        );
        inactiveSegStartRef.current = null;
      }
      if (activeSegStartRef.current === null) {
        activeSegStartRef.current = ts;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pauseToInactive();
      } else {
        resumeToActive();
      }
    };

    const handleBlur = () => {
      pauseToInactive();
    };

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        resumeToActive();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [questionId]);

  const getTimingSnapshot = useCallback((): TimingSnapshot => {
    const now = Date.now();
    const liveActive =
      activeAccumRef.current +
      (activeSegStartRef.current !== null
        ? Math.max(0, now - activeSegStartRef.current)
        : 0);
    const liveInactive =
      inactiveAccumRef.current +
      (inactiveSegStartRef.current !== null
        ? Math.max(0, now - inactiveSegStartRef.current)
        : 0);
    const wallTimeMs = Math.max(0, now - displayStartRef.current);

    return {
      activeTimeMs: Math.round(liveActive),
      inactiveTimeMs: Math.round(liveInactive),
      wallTimeMs: Math.round(wallTimeMs),
    };
  }, []);

  const markProgressed = useCallback(() => {
    completedCurrentRef.current = true;
  }, []);

  useEffect(() => {
    if (!questionId || !sectionId || !onLeaveAbandon) return;

    const handlePageHide = () => {
      if (completedCurrentRef.current) return;
      onLeaveAbandon({
        questionId,
        sectionId,
        timing: getTimingSnapshot(),
      });
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [questionId, sectionId, onLeaveAbandon, getTimingSnapshot]);

  return { getTimingSnapshot, markProgressed };
}
