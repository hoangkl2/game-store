import type { UnoAction, UnoCard, UnoColor } from "@game-store/game-uno";

export const REALTIME_PROTOCOL_VERSION = 1 as const;
export type RealtimeConnectionStatus = "IDLE" | "CONNECTING" | "AUTHENTICATING" | "CONNECTED" | "DEGRADED" | "RECONNECTING" | "RESYNCHRONIZING" | "DISCONNECTED" | "CLOSED" | "FAILED";
export type RealtimeConnectionState = { status: RealtimeConnectionStatus; retryCount: number; connectionId?: string; lastError?: string };
export type Recipient = { type: "PLAYER" | "SPECTATOR" | "MODERATOR"; playerId?: string };
export type SessionStatus = "WAITING" | "ACTIVE" | "FINISHED" | "CLOSED";

export interface GameActionCommand<TAction> { protocolVersion: 1; requestId: string; gameSessionId: string; playerId: string; expectedStateVersion: number; sentAt: string; action: TAction }
export interface GameActionResult<TEvent = unknown> { protocolVersion: 1; requestId: string; accepted: boolean; gameSessionId: string; stateVersion: number; events?: TEvent[]; rejectionCode?: string; message?: string; retryable?: boolean; snapshotRequired?: boolean }
export interface GameSnapshot<TProjection> { protocolVersion: 1; gameSessionId: string; stateVersion: number; serverTime: string; recipient: Recipient; projection: TProjection; currentTurn?: { playerId: string; startedAt: string; expiresAt?: string }; status: SessionStatus; lastEventSequence: number }
export interface RealtimeDomainEvent<TPayload> { eventId: string; sequenceNumber: number; gameSessionId: string; stateVersion: number; type: string; occurredAt: string; payload: TPayload }

export type MockIdentity = { connectionId: string; userId: string; playerId: string };
export type MockRoomMember = { playerId: string; displayName: string; seat: number; ready: boolean; connected: boolean; isHost: boolean; control: "HUMAN" | "BOT" };
export type MockRoomState = { roomId: string; roomCode: string; gameSlug: "color-clash"; status: "WAITING" | "STARTING" | "IN_GAME" | "FINISHED" | "CLOSED"; hostPlayerId: string; members: MockRoomMember[]; spectators: string[]; version: number; gameSessionId?: string };
export type ColorClashProjection = {
  gameType: "COLOR_CLASH"; phase: "ACTIVE" | "FINISHED"; currentColor: UnoColor; currentPlayerId: string; direction: 1 | -1; turnNumber: number;
  topDiscard: UnoCard; drawPileCount: number; players: Array<{ playerId: string; displayName: string; handCount: number; connected: boolean; control: "HUMAN" | "BOT" }>;
  ownHand?: UnoCard[]; legalActions: UnoAction[]; winnerId?: string;
};
export type ColorClashPublicEvent =
  | { type: "CARD_PLAYED"; playerId: string; card: UnoCard; chosenColor?: Exclude<UnoColor, "WILD"> }
  | { type: "CARD_DRAWN"; playerId: string; count: number }
  | { type: "PENALTY_DRAWN"; playerId: string; count: number }
  | { type: "TURN_CHANGED"; playerId: string }
  | { type: "GAME_WON"; playerId: string };
export type ColorClashRealtimeEvent = RealtimeDomainEvent<ColorClashPublicEvent>;
