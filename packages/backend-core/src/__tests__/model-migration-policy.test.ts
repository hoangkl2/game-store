import { describe, expect, it } from "vitest";
import { migratePersistedSnapshot, validatePersistedSnapshotV2 } from "../migration";
import { BACKEND_MODULES, POSTGRES_INDEXES, validateGameSessionRecord, type GameSessionRecord } from "../model";
import { RATE_LIMIT_POLICIES, redactStructuredMetadata } from "../policy";

const session: GameSessionRecord = {
  id: "game-1", gameType: "COLOR_CLASH", status: "ACTIVE", schemaVersion: 1, gameVersion: "1.0.0", ruleConfigVersion: 1,
  stateVersion: 3, eventSequence: 2, ruleConfig: { cardsPerPlayer: 7 },
  playerSeats: [
    { playerId: "p1", identityId: "i1", seatIndex: 0, control: "HUMAN", controlEpoch: 0 },
    { playerId: "p2", identityId: "i2", seatIndex: 1, control: "BOT", controlEpoch: 1 }
  ],
  currentTurn: { playerId: "p1", startedAt: "2026-08-02T00:00:00.000Z" },
  createdAt: "2026-08-02T00:00:00.000Z", startedAt: "2026-08-02T00:00:01.000Z", updatedAt: "2026-08-02T00:00:02.000Z"
};

describe("backend records and index manifest", () => {
  it("validates durable session boundaries and returns an immutable copy", () => {
    const validated = validateGameSessionRecord(session);
    expect(validated).toEqual(session);
    validated.playerSeats[0]!.playerId = "changed";
    expect(session.playerSeats[0]!.playerId).toBe("p1");
    expect(() => validateGameSessionRecord({ ...session, playerSeats: [session.playerSeats[0]!, { ...session.playerSeats[1]!, playerId: "p1" }] })).toThrow("Invalid");
    expect(() => validateGameSessionRecord({ ...session, currentTurn: { playerId: "unknown", startedAt: "bad" } })).toThrow("Invalid");
    expect(() => validateGameSessionRecord({ ...session, status: "BROKEN" as never })).toThrow("Invalid");
    expect(() => validateGameSessionRecord({ ...session, playerSeats: [{ ...session.playerSeats[0]!, control: "REMOTE" as never }, session.playerSeats[1]!] })).toThrow("Invalid");
  });

  it("declares bounded modules and critical unique indexes", () => {
    expect(BACKEND_MODULES).toContain("GameProjectionModule");
    expect(BACKEND_MODULES).toContain("HealthModule");
    expect(POSTGRES_INDEXES).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "idempotency_records", unique: true }),
      expect.objectContaining({ table: "game_events", columns: ["game_session_id", "sequence"], unique: true }),
      expect.objectContaining({ table: "game_results", unique: true })
    ]));
  });
});

describe("persisted snapshot migration", () => {
  it("migrates a prior version-1 fixture and validates version 2", () => {
    const fixture = { schemaVersion: 1, gameType: "COLOR_CLASH", gameVersion: "1.0.0", stateVersion: 7, state: "{\"phase\":\"ACTIVE\"}", createdAt: "2026-01-01T00:00:00.000Z" };
    const migrated = migratePersistedSnapshot(fixture);
    expect(migrated).toMatchObject({ schemaVersion: 2, projectionVersion: 1, serializedState: fixture.state });
    expect(validatePersistedSnapshotV2(migrated)).toEqual(migrated);
    expect(migratePersistedSnapshot(migrated)).toEqual(migrated);
  });

  it("rejects unknown, malformed, and checksum-corrupt fixtures", () => {
    expect(() => migratePersistedSnapshot(null)).toThrow("corrupt");
    expect(() => migratePersistedSnapshot({ schemaVersion: 99 })).toThrow("corrupt");
    const migrated = migratePersistedSnapshot({ schemaVersion: 1, gameType: "X", gameVersion: "1", stateVersion: 1, state: "{}", createdAt: "2026-01-01T00:00:00.000Z" });
    expect(() => validatePersistedSnapshotV2({ ...migrated, checksum: "changed" })).toThrow("corrupt");
  });
});

describe("operational policies", () => {
  it("uses identity-aware limits and redacts unsafe structured metadata", () => {
    expect(RATE_LIMIT_POLICIES.LOGIN.keyParts).toContain("IDENTITY");
    expect(RATE_LIMIT_POLICIES.GAME_ACTION_BURST.windowSeconds).toBe(1);
    expect(redactStructuredMetadata({ requestId: "req\nforged", password: "secret", privateRole: "PROWLER", nested: { token: "x" }, count: 2, valid: true, empty: null })).toEqual({ requestId: "req forged", password: "[REDACTED]", privateRole: "[REDACTED]", count: 2, valid: true, empty: null });
    expect(redactStructuredMetadata({ message: "x".repeat(20) }, 16).message).toBe("x".repeat(16));
    expect(() => redactStructuredMetadata({}, 5)).toThrow("Invalid log");
  });
});
