import type { AudioAsset, AudioAssetId } from "./types";

export const audioAssetRegistry: Readonly<Record<AudioAssetId, AudioAsset>> = {
  "ui-confirm": { id: "ui-confirm", category: "UI", frequency: 560, durationMs: 55, lazy: true }, "ui-blocked": { id: "ui-blocked", category: "UI", frequency: 180, durationMs: 80, lazy: true },
  "room-ready": { id: "room-ready", category: "ROOM", frequency: 440, durationMs: 80, lazy: true }, "room-start": { id: "room-start", category: "ROOM", frequency: 660, durationMs: 100, lazy: true },
  "system-resynced": { id: "system-resynced", category: "SYSTEM", frequency: 520, durationMs: 80, lazy: true }, "color-card-played": { id: "color-card-played", category: "GAMEPLAY", frequency: 380, durationMs: 65, lazy: true },
  "royal-die-settled": { id: "royal-die-settled", category: "GAMEPLAY", frequency: 480, durationMs: 70, lazy: true }, "property-token-arrived": { id: "property-token-arrived", category: "GAMEPLAY", frequency: 310, durationMs: 65, lazy: true },
  "property-dispatch": { id: "property-dispatch", category: "GAMEPLAY", frequency: 620, durationMs: 85, lazy: true }, "moon-public-transition": { id: "moon-public-transition", category: "GAMEPLAY", frequency: 340, durationMs: 100, lazy: true },
  "game-result": { id: "game-result", category: "SYSTEM", frequency: 720, durationMs: 160, lazy: true }, "music-table": { id: "music-table", category: "MUSIC", frequency: 220, durationMs: 1200, loop: true, lazy: true },
};
export const getAudioAsset = (id: AudioAssetId) => audioAssetRegistry[id];
