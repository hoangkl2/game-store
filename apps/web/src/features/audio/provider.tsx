"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AudioCommandQueue, defaultAudioPreferences, effectiveCommandVolume, normalizeAudioPreferences, shouldPlayCommand, type AudioCommand, type AudioPlaybackState, type AudioPreferenceState } from "@game-store/audio-core";
import { usePathname } from "next/navigation";
import { BrowserAudioEngine } from "./engine";

type AudioContextValue = { preferences: AudioPreferenceState; playback: AudioPlaybackState; setPreferences: (patch: Partial<AudioPreferenceState>) => void; enableSound: () => Promise<boolean>; submit: (commands: readonly AudioCommand[]) => void; stopGroup: (group: string) => void; resetForReconnect: () => void };
const Context = createContext<AudioContextValue | undefined>(undefined); const storageKey = "game-store-audio-preferences";
const defaultPlayback: AudioPlaybackState = { unlocked: false, status: "IDLE", pendingCount: 0 };

export function AudioProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const engineRef = useRef<BrowserAudioEngine | null>(null); const queueRef = useRef<AudioCommandQueue | null>(null); const routeRef = useRef<string | undefined>(undefined);
  if (!engineRef.current) engineRef.current = new BrowserAudioEngine(); if (!queueRef.current) queueRef.current = new AudioCommandQueue();
  const engine = engineRef.current; const queue = queueRef.current; const [preferences, setPreferenceState] = useState(defaultAudioPreferences); const [playback, setPlayback] = useState(defaultPlayback);
  const flush = useCallback(() => {
    if (!playback.unlocked) return;
    let command = queue.takeNext(); while (command) { if (!preferences.reducedSensory || command.priority !== "DECORATIVE") if (shouldPlayCommand(command.category, preferences)) engine.play(command, effectiveCommandVolume(command.category, preferences, command.volume)); queue.complete(command.id); command = queue.takeNext(); }
    setPlayback((state) => ({ ...state, status: "IDLE", pendingCount: queue.snapshot().queue.length }));
  }, [engine, playback.unlocked, preferences, queue]);
  useEffect(() => { const stored = window.localStorage.getItem(storageKey); try { setPreferenceState(normalizeAudioPreferences(stored ? JSON.parse(stored) : undefined)); } catch { setPreferenceState({ ...defaultAudioPreferences }); } }, []);
  useEffect(() => { if (routeRef.current && routeRef.current !== pathname) { queue.clearRoute(); engine.stopAll(); setPlayback((state) => ({ ...state, status: "IDLE", pendingCount: 0 })); } routeRef.current = pathname; }, [engine, pathname, queue]);
  useEffect(() => { const visibility = () => { if (document.hidden && preferences.inactivePolicy === "PAUSE") { void engine.pause(); setPlayback((state) => ({ ...state, status: "PAUSED" })); } else if (!document.hidden && preferences.inactivePolicy === "PAUSE") { void engine.resume(); setPlayback((state) => ({ ...state, status: "IDLE" })); } else if (preferences.inactivePolicy === "MUTE") engine.setMuted(document.hidden); }; visibility(); document.addEventListener("visibilitychange", visibility); return () => document.removeEventListener("visibilitychange", visibility); }, [engine, preferences.inactivePolicy]);
  useEffect(() => () => engine.dispose(), [engine]);
  const setPreferences = useCallback((patch: Partial<AudioPreferenceState>) => setPreferenceState((current) => { const next = normalizeAudioPreferences({ ...current, ...patch }); window.localStorage.setItem(storageKey, JSON.stringify(next)); return next; }), []);
  const enableSound = useCallback(async () => { queue.discardDecorative(); const unlocked = await engine.unlock(); setPlayback((state) => unlocked ? { ...state, unlocked: true, status: "IDLE", lastError: undefined, pendingCount: queue.snapshot().queue.length } : { ...state, status: "UNAVAILABLE", lastError: "Sound is unavailable in this browser." }); return unlocked; }, [engine, queue]);
  const submit = useCallback((commands: readonly AudioCommand[]) => { let caption: string | undefined; commands.forEach((command) => { if (preferences.reducedSensory && command.priority === "DECORATIVE") return; if (queue.enqueue(command) && command.caption) caption = command.caption; }); setPlayback((state) => ({ ...state, lastCaption: preferences.captionsEnabled ? caption ?? state.lastCaption : undefined, pendingCount: queue.snapshot().queue.length })); flush(); }, [flush, preferences.captionsEnabled, preferences.reducedSensory, queue]);
  useEffect(() => { flush(); }, [flush, preferences]);
  const value = useMemo(() => ({ preferences, playback, setPreferences, enableSound, submit, stopGroup: (group: string) => { queue.stopGroup(group); engine.stopGroup(group); }, resetForReconnect: () => { queue.resetForReconnect(); engine.stopAll(); setPlayback((state) => ({ ...state, status: "IDLE", pendingCount: 0, lastCaption: "Resynchronized to the latest state." })); } }), [enableSound, engine, playback, preferences, queue, setPreferences, submit]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAudio() { const value = useContext(Context); if (!value) throw new Error("useAudio must be used inside AudioProvider"); return value; }
