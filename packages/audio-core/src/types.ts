export type AudioCategory = "UI" | "ROOM" | "GAMEPLAY" | "MUSIC" | "AMBIENT" | "SYSTEM";
export type AudioPriority = "CRITICAL" | "NORMAL" | "DECORATIVE";
export type AuthorizedAudience = "PUBLIC" | "VIEWER";
export type InactiveAudioPolicy = "PAUSE" | "MUTE" | "CONTINUE";
export type AudioAssetId =
  | "ui-confirm" | "ui-blocked" | "room-ready" | "room-start" | "system-resynced"
  | "color-card-played" | "royal-die-settled" | "property-token-arrived" | "property-dispatch"
  | "moon-public-transition" | "game-result" | "music-table";

export type AudioCommand = {
  id: string; category: AudioCategory; priority: AudioPriority; assetId: AudioAssetId;
  sourceEventId: string; sourceEventSequence?: number; volume?: number; loop?: boolean;
  interruptGroup?: string; authorizedAudience: AuthorizedAudience; caption?: string; createdAt: number;
};

export type AudioPreferenceState = {
  masterEnabled: boolean; musicEnabled: boolean; sfxEnabled: boolean; voiceEnabled: boolean;
  masterVolume: number; musicVolume: number; sfxVolume: number; voiceVolume: number;
  captionsEnabled: boolean; inactivePolicy: InactiveAudioPolicy; reducedSensory: boolean;
};

export type AudioPlaybackState = {
  unlocked: boolean; status: "IDLE" | "PLAYING" | "PAUSED" | "UNAVAILABLE";
  pendingCount: number; lastCaption?: string; lastError?: string;
};

export type AudioAsset = { id: AudioAssetId; category: AudioCategory; frequency: number; durationMs: number; loop?: boolean; lazy: true };
