export const BACKEND_SCHEMA_VERSION = 1 as const;

export const BACKEND_MODULES = [
  "AuthModule", "UsersModule", "ProfilesModule", "RoomsModule", "InvitationsModule",
  "MatchmakingModule", "GameSessionsModule", "GameRuntimeModule", "GameProjectionModule",
  "RealtimeModule", "IdempotencyModule", "PresenceModule", "SpectatorModule", "BotsModule",
  "ResultsModule", "RankingModule", "AchievementsModule", "AuditModule", "ModerationModule",
  "RateLimitModule", "ObservabilityModule", "HealthModule"
] as const;

export type GameSessionStatus = "CREATED" | "STARTING" | "ACTIVE" | "PAUSED" | "FINISHED" | "CANCELLED" | "CLOSED";
export type SeatControl = "HUMAN" | "BOT";

export interface GameSeatRecord {
  playerId: string;
  identityId: string;
  seatIndex: number;
  control: SeatControl;
  controlEpoch: number;
  finalRank?: number;
}

export interface GameSessionRecord {
  id: string;
  gameType: string;
  roomId?: string;
  status: GameSessionStatus;
  schemaVersion: number;
  gameVersion: string;
  ruleConfigVersion: number;
  stateVersion: number;
  eventSequence: number;
  ruleConfig: unknown;
  playerSeats: GameSeatRecord[];
  currentTurn?: { playerId: string; startedAt: string; expiresAt?: string };
  latestSnapshotId?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
}

export interface GameSnapshotRecord {
  id: string;
  gameSessionId: string;
  schemaVersion: number;
  gameVersion: string;
  stateVersion: number;
  eventSequence: number;
  codec: "JSON" | "JSON_GZIP";
  encryptedPayload: string;
  checksum: string;
  createdAt: string;
}

export interface GameEventRecord {
  id: string;
  gameSessionId: string;
  schemaVersion: number;
  eventVersion: number;
  sequence: number;
  resultingStateVersion: number;
  type: string;
  requestId: string;
  encryptedPayload: string;
  occurredAt: string;
}

export interface DatabaseIndexDefinition {
  table: string;
  columns: readonly string[];
  unique?: boolean;
  where?: string;
  purpose: string;
}

export const POSTGRES_INDEXES: readonly DatabaseIndexDefinition[] = [
  { table: "users", columns: ["normalized_email"], unique: true, purpose: "account identity uniqueness" },
  { table: "profiles", columns: ["normalized_handle"], unique: true, purpose: "public handle uniqueness" },
  { table: "auth_sessions", columns: ["token_hash"], unique: true, purpose: "refresh credential lookup" },
  { table: "auth_sessions", columns: ["user_id", "status", "expires_at"], purpose: "session revocation and cleanup" },
  { table: "rooms", columns: ["normalized_code"], unique: true, where: "status IN ('WAITING','STARTING','IN_GAME')", purpose: "active room lookup" },
  { table: "rooms", columns: ["status", "expires_at"], purpose: "room expiry" },
  { table: "room_members", columns: ["room_id", "identity_id"], unique: true, purpose: "one membership per identity" },
  { table: "room_members", columns: ["room_id", "seat_index"], unique: true, purpose: "seat uniqueness" },
  { table: "room_invitations", columns: ["token_hash"], unique: true, purpose: "invitation redemption" },
  { table: "matchmaking_tickets", columns: ["identity_id", "game_type", "playlist"], unique: true, where: "status IN ('QUEUED','PROPOSED')", purpose: "prevent duplicate active tickets" },
  { table: "matchmaking_tickets", columns: ["status", "game_type", "region", "rating", "entered_at"], purpose: "candidate search" },
  { table: "game_sessions", columns: ["room_id"], unique: true, where: "room_id IS NOT NULL AND status NOT IN ('CANCELLED','CLOSED')", purpose: "single active room handoff" },
  { table: "game_sessions", columns: ["status", "updated_at"], purpose: "runtime recovery" },
  { table: "game_seats", columns: ["game_session_id", "player_id"], unique: true, purpose: "player membership" },
  { table: "game_seats", columns: ["game_session_id", "seat_index"], unique: true, purpose: "stable seat order" },
  { table: "game_snapshots", columns: ["game_session_id", "state_version"], unique: true, purpose: "recovery snapshot lookup" },
  { table: "game_events", columns: ["game_session_id", "sequence"], unique: true, purpose: "ordered event stream" },
  { table: "game_events", columns: ["id"], unique: true, purpose: "event deduplication" },
  { table: "idempotency_records", columns: ["game_session_id", "identity_id", "request_id"], unique: true, purpose: "durable action deduplication" },
  { table: "idempotency_records", columns: ["expires_at"], purpose: "retention cleanup" },
  { table: "reconnect_sessions", columns: ["token_hash"], unique: true, purpose: "one-use reconnect lookup" },
  { table: "game_results", columns: ["game_session_id"], unique: true, purpose: "exactly one result" },
  { table: "rankings", columns: ["game_type", "season_id", "rating"], purpose: "leaderboard ordering" },
  { table: "user_achievements", columns: ["user_id", "achievement_id", "definition_version", "source_session_id"], unique: true, purpose: "idempotent achievement grants" },
  { table: "audit_logs", columns: ["actor_id", "occurred_at"], purpose: "actor investigation" },
  { table: "moderation_cases", columns: ["status", "updated_at"], purpose: "case queue" }
];

const isIsoDate = (value: string | undefined): boolean => {
  if (value === undefined) return true;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
};

export function validateGameSessionRecord(record: GameSessionRecord): GameSessionRecord {
  const playerIds = new Set(record.playerSeats.map((seat) => seat.playerId));
  const seatIndexes = new Set(record.playerSeats.map((seat) => seat.seatIndex));
  const statuses: readonly GameSessionStatus[] = ["CREATED", "STARTING", "ACTIVE", "PAUSED", "FINISHED", "CANCELLED", "CLOSED"];
  const valid = record.id.length > 0 && record.gameType.length > 0 && statuses.includes(record.status) && record.schemaVersion > 0 && record.gameVersion.length > 0 &&
    Number.isInteger(record.ruleConfigVersion) && record.ruleConfigVersion > 0 && Number.isInteger(record.stateVersion) && record.stateVersion >= 0 &&
    Number.isInteger(record.eventSequence) && record.eventSequence >= 0 && record.playerSeats.length >= 2 &&
    playerIds.size === record.playerSeats.length && seatIndexes.size === record.playerSeats.length &&
    record.playerSeats.every((seat) => seat.identityId.length > 0 && seat.seatIndex >= 0 && (seat.control === "HUMAN" || seat.control === "BOT") && Number.isInteger(seat.controlEpoch) && seat.controlEpoch >= 0) &&
    isIsoDate(record.createdAt) && isIsoDate(record.startedAt) && isIsoDate(record.finishedAt) && isIsoDate(record.updatedAt) &&
    (!record.currentTurn || (playerIds.has(record.currentTurn.playerId) && isIsoDate(record.currentTurn.startedAt) && isIsoDate(record.currentTurn.expiresAt)));
  if (!valid) throw new Error("Invalid game session record");
  return structuredClone(record);
}
