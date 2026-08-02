import type { AudioPreferenceState, InactiveAudioPolicy } from "./types";

export const defaultAudioPreferences: AudioPreferenceState = {
  masterEnabled: true, musicEnabled: true, sfxEnabled: true, voiceEnabled: true,
  masterVolume: 0.8, musicVolume: 0.45, sfxVolume: 0.7, voiceVolume: 0.7,
  captionsEnabled: true, inactivePolicy: "PAUSE", reducedSensory: false,
};

const policies: readonly InactiveAudioPolicy[] = ["PAUSE", "MUTE", "CONTINUE"];
export const clampVolume = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
export function normalizeAudioPreferences(value: unknown): AudioPreferenceState {
  if (!value || typeof value !== "object") return { ...defaultAudioPreferences };
  const candidate = value as Partial<AudioPreferenceState>;
  return {
    masterEnabled: typeof candidate.masterEnabled === "boolean" ? candidate.masterEnabled : defaultAudioPreferences.masterEnabled,
    musicEnabled: typeof candidate.musicEnabled === "boolean" ? candidate.musicEnabled : defaultAudioPreferences.musicEnabled,
    sfxEnabled: typeof candidate.sfxEnabled === "boolean" ? candidate.sfxEnabled : defaultAudioPreferences.sfxEnabled,
    voiceEnabled: typeof candidate.voiceEnabled === "boolean" ? candidate.voiceEnabled : defaultAudioPreferences.voiceEnabled,
    masterVolume: clampVolume(candidate.masterVolume, defaultAudioPreferences.masterVolume), musicVolume: clampVolume(candidate.musicVolume, defaultAudioPreferences.musicVolume),
    sfxVolume: clampVolume(candidate.sfxVolume, defaultAudioPreferences.sfxVolume), voiceVolume: clampVolume(candidate.voiceVolume, defaultAudioPreferences.voiceVolume),
    captionsEnabled: typeof candidate.captionsEnabled === "boolean" ? candidate.captionsEnabled : defaultAudioPreferences.captionsEnabled,
    inactivePolicy: policies.includes(candidate.inactivePolicy as InactiveAudioPolicy) ? candidate.inactivePolicy as InactiveAudioPolicy : defaultAudioPreferences.inactivePolicy,
    reducedSensory: typeof candidate.reducedSensory === "boolean" ? candidate.reducedSensory : defaultAudioPreferences.reducedSensory,
  };
}
export function effectiveCommandVolume(commandCategory: "MUSIC" | "AMBIENT" | "UI" | "ROOM" | "GAMEPLAY" | "SYSTEM", preferences: AudioPreferenceState, commandVolume = 1) {
  const categoryVolume = commandCategory === "MUSIC" || commandCategory === "AMBIENT" ? preferences.musicVolume : commandCategory === "SYSTEM" ? preferences.masterVolume : preferences.sfxVolume;
  return clampVolume(commandVolume, 1) * preferences.masterVolume * categoryVolume;
}
export function shouldPlayCommand(category: "MUSIC" | "AMBIENT" | "UI" | "ROOM" | "GAMEPLAY" | "SYSTEM", preferences: AudioPreferenceState) {
  if (!preferences.masterEnabled) return false;
  if (category === "MUSIC" || category === "AMBIENT") return preferences.musicEnabled;
  return preferences.sfxEnabled;
}
