import { describe, expect, it } from "vitest";
import { SeededRandomProvider } from "@game-store/game-core";
import { UnoEngine, type UnoGameState } from "@game-store/game-uno";
import { authorize } from "../authorization";
import { IdempotencyCoordinator } from "../idempotency";
import { migratePersistedSnapshot } from "../migration";
import { ProjectionService, type GameProjectionAdapter } from "../projection";
import { InMemoryIdempotencyRepository } from "../testing/in-memory-idempotency";

type SafeProjection = { currentPlayerId: string; players: { playerId: string; handCount: number }[]; ownHand?: unknown[]; legalActions: unknown[] };

describe("Color Clash backend-foundation integration", () => {
  it("binds an engine action, executes it once, projects by recipient, and migrates a prior snapshot", async () => {
    const engine = new UnoEngine(new SeededRandomProvider(20260802));
    let state = engine.createInitialState({ players: [{ id: "p1", name: "Lan" }, { id: "p2", name: "Minh" }], cardsPerPlayer: 2 });
    let stateVersion = 1;
    const context = { identityId: "identity-1", accountStatus: "ACTIVE" as const, roles: ["PLAYER" as const], session: { seatIdentityId: "identity-1", playerId: "p1", control: "HUMAN" as const } };
    const action = engine.getValidActions(state, "p1")[0]!;
    expect(authorize(context, { operation: "SUBMIT_GAME_ACTION", suppliedPlayerId: action.playerId })).toEqual({ allowed: true });

    const coordinator = new IdempotencyCoordinator(new InMemoryIdempotencyRepository<{ events: string[] }>());
    let reductions = 0;
    const command = { gameSessionId: "game-1", identityId: "identity-1", requestId: "request-1", action, ownerToken: "runtime-1", now: "2026-08-02T00:00:00.000Z", expiresAt: "2026-08-03T00:00:00.000Z" };
    const reduce = async () => {
      const validation = engine.validateAction(state, action);
      if (!validation.valid) return { accepted: false, resultingStateVersion: stateVersion, result: { events: [] } };
      reductions += 1;
      const transition = engine.reduce(state, action);
      state = transition.state;
      stateVersion += 1;
      return { accepted: true, resultingStateVersion: stateVersion, result: { events: transition.events.map((event) => event.type) } };
    };
    expect(await coordinator.execute(command, reduce)).toMatchObject({ kind: "EXECUTED", accepted: true, resultingStateVersion: 2 });
    expect(await coordinator.execute({ ...command, ownerToken: "runtime-2" }, reduce)).toMatchObject({ kind: "REPLAYED", resultingStateVersion: 2 });
    expect(reductions).toBe(1);

    const adapter: GameProjectionAdapter<UnoGameState> = {
      player: (source, playerId): SafeProjection => ({ currentPlayerId: source.players[source.currentPlayerIndex]!.id, players: source.players.map((player) => ({ playerId: player.id, handCount: player.hand.length })), ownHand: source.players.find((player) => player.id === playerId)!.hand, legalActions: engine.getValidActions(source, playerId) }),
      opponent: (source, _recipient, subject) => ({ playerId: subject, handCount: source.players.find((player) => player.id === subject)!.hand.length }),
      teammate: () => { throw new Error("Color Clash has no teammate projection"); },
      spectator: (source): SafeProjection => ({ currentPlayerId: source.players[source.currentPlayerIndex]!.id, players: source.players.map((player) => ({ playerId: player.id, handCount: player.hand.length })), legalActions: [] }),
      moderator: () => { throw new Error("No moderator projection in this bounded test"); }
    };
    const projectionService = new ProjectionService();
    const playerProjection = projectionService.project(state, { identityId: "identity-1", mode: "PLAYER", playerId: "p1" }, { identityId: "identity-1", playerId: "p1", modes: ["PLAYER"] }, adapter) as SafeProjection;
    const spectatorProjection = projectionService.project(state, { identityId: "spectator-1", mode: "SPECTATOR" }, { identityId: "spectator-1", modes: ["SPECTATOR"] }, adapter) as SafeProjection;
    expect(playerProjection.ownHand).toHaveLength(state.players.find((player) => player.id === "p1")!.hand.length);
    expect(spectatorProjection).not.toHaveProperty("ownHand");
    expect(spectatorProjection.legalActions).toEqual([]);

    const serializedState = engine.serialize(state);
    const migrated = migratePersistedSnapshot({ schemaVersion: 1, gameType: "COLOR_CLASH", gameVersion: state.gameVersion, stateVersion, state: serializedState, createdAt: "2026-08-02T00:00:00.000Z" });
    const restored = new UnoEngine(new SeededRandomProvider(1)).deserialize(migrated.serializedState);
    expect(restored).toEqual(state);
  });
});
