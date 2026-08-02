"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimationQueue, effectiveDuration, type AnimationCommand, type AnimationSpeed, type AnimationState } from "@game-store/animation-core";

type MotionOverride = "SYSTEM" | "REDUCED" | "FULL";
type AnimationContextValue = { state: AnimationState; queue: AnimationQueue; speed: AnimationSpeed; setSpeed: (speed: AnimationSpeed) => void; reducedMotion: boolean; override: MotionOverride; setOverride: (override: MotionOverride) => void; sessionOverride?: MotionOverride; setSessionOverride: (override?: MotionOverride) => void; isInputBlocked: boolean };
const AnimationContext = createContext<AnimationContextValue | undefined>(undefined);
const speedKey = "game-store-animation-speed";
const overrideKey = "game-store-motion-override";
const isSpeed = (value: string | null): value is AnimationSpeed => value === "OFF" || value === "FAST" || value === "NORMAL" || value === "SLOW";
const isOverride = (value: string | null): value is MotionOverride => value === "SYSTEM" || value === "REDUCED" || value === "FULL";

export function AnimationProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<AnimationQueue | null>(null);
  if (!queueRef.current) queueRef.current = new AnimationQueue();
  const queue = queueRef.current;
  const [state, setState] = useState(() => queue.snapshot());
  const [speed, setSpeedState] = useState<AnimationSpeed>("NORMAL");
  const [override, setOverrideState] = useState<MotionOverride>("SYSTEM");
  const [sessionOverride, setSessionOverrideState] = useState<MotionOverride>();
  const [systemReduced, setSystemReduced] = useState(false);
  const effectiveOverride = sessionOverride ?? override;
  const reducedMotion = effectiveOverride === "REDUCED" || (effectiveOverride === "SYSTEM" && systemReduced);

  useEffect(() => queue.subscribe(setState), [queue]);
  useEffect(() => {
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false, addEventListener: () => undefined, removeEventListener: () => undefined };
    const storedSpeed = window.localStorage.getItem(speedKey); const storedOverride = window.localStorage.getItem(overrideKey);
    setSystemReduced(media.matches); if (isSpeed(storedSpeed)) setSpeedState(storedSpeed); if (isOverride(storedOverride)) setOverrideState(storedOverride);
    const listener = () => setSystemReduced(media.matches); media.addEventListener("change", listener); return () => media.removeEventListener("change", listener);
  }, []);
  useEffect(() => { queue.setSpeed(speed); }, [queue, speed]);
  useEffect(() => { queue.setReducedMotion(reducedMotion); }, [queue, reducedMotion]);
  useEffect(() => {
    const visibility = () => queue.setDocumentHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility); return () => document.removeEventListener("visibilitychange", visibility);
  }, [queue]);
  useEffect(() => {
    const active = [state.current, ...state.parallel].filter((command): command is AnimationCommand => Boolean(command));
    if (state.status !== "PLAYING" || !active.length) return undefined;
    const timers = active.map((command) => window.setTimeout(() => queue.complete(command.id), effectiveDuration(command.durationMs, speed, reducedMotion, command.priority)));
    return () => timers.forEach(window.clearTimeout);
  }, [queue, reducedMotion, speed, state.current, state.parallel, state.status]);

  const setSpeed = useCallback((next: AnimationSpeed) => { window.localStorage.setItem(speedKey, next); setSpeedState(next); }, []);
  const setOverride = useCallback((next: MotionOverride) => { window.localStorage.setItem(overrideKey, next); setOverrideState(next); }, []);
  const setSessionOverride = useCallback((next?: MotionOverride) => setSessionOverrideState(next), []);
  const value = useMemo(() => ({ state, queue, speed, setSpeed, reducedMotion, override, setOverride, sessionOverride, setSessionOverride, isInputBlocked: queue.isInputBlocked() }), [state, queue, speed, setSpeed, reducedMotion, override, setOverride, sessionOverride, setSessionOverride]);
  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>;
}

export const AnimationQueueProvider = AnimationProvider;
export function useAnimationQueue() { const value = useContext(AnimationContext); if (!value) throw new Error("useAnimationQueue must be used inside AnimationProvider"); return value; }
export function useReducedMotionPreference() { const { reducedMotion, override, setOverride } = useAnimationQueue(); return { reducedMotion, override, setOverride }; }
export function useAnimationSpeed() { const { speed, setSpeed } = useAnimationQueue(); return { speed, setSpeed }; }
