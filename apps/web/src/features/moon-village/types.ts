export type MoonVillageUIState = { roleVisible: boolean; pauseOpen: boolean; selectedTargetId?: string; privatePanelOpen: boolean; logOpen: boolean; interactionLocked: boolean };
export type MoonVillageAnimationState = { eventSequence?: number; phase: "IDLE" | "MIST" | "COMMITTING"; reduced: boolean };
export type MoonVillageAudioState = { muted: boolean; captionsEnabled: boolean };
export type MoonVillageSessionUIState = { saveId: string; saveStatus: "IDLE" | "SAVING" | "SAVED" | "ERROR"; resumed: boolean };
export type MoonVillageRoomState = { mode: "OFFLINE"; roomId?: never };
export type MoonVillageConnectionState = { status: "OFFLINE"; sequence?: never };
