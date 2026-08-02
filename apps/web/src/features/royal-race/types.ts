import type { RoyalRaceEvent } from "@game-store/game-royal-race";
export type RoyalRaceUIState = { selectedPieceId?: string; focusedPieceIndex: number; isPauseOpen: boolean; isLogOpen: boolean; boardZoom: number; interactionLockReason?: "BOT_TURN" | "ANIMATING" | "GAME_OVER" };
export type RoyalRaceAnimationState = { current?: { event: RoyalRaceEvent; startedAt: number }; queue: RoyalRaceEvent[]; speed: "OFF" | "FAST" | "NORMAL" | "SLOW" };
export type RoyalRaceAudioState = { muted: boolean; captionsEnabled: boolean };
export type RoyalRaceSessionState = { saveId: string; saveStatus: "IDLE" | "SAVING" | "SAVED" | "ERROR" };
export type RoyalRaceConnectionState = { status: "OFFLINE" | "CONNECTED" | "RECONNECTING" | "FAILED" };
