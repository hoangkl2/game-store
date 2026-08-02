import type { PropertyEmpireEvent } from "@game-store/game-property-empire";

export type PropertyEmpireUIState = {
  selectedTileId?: string;
  focusedTileIndex: number;
  isPropertyPanelOpen: boolean;
  isTransactionsOpen: boolean;
  isPauseOpen: boolean;
  interactionLockReason?: "BOT_TURN" | "ANIMATING" | "GAME_OVER";
};
export type PropertyEmpireAnimationState = { current?: { event: PropertyEmpireEvent; startedAt: number }; queue: PropertyEmpireEvent[]; speed: "OFF" | "FAST" | "NORMAL" | "SLOW" };
export type PropertyEmpireAudioState = { muted: boolean; captionsEnabled: boolean };
export type PropertyEmpireSessionState = { saveId: string; saveStatus: "IDLE" | "SAVING" | "SAVED" | "ERROR"; autoSaveAfterNextCommit: boolean };
export type PropertyEmpireConnectionState = { status: "OFFLINE" | "CONNECTED" | "RECONNECTING" | "FAILED" };
