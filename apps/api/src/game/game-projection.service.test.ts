import { afterEach, describe, expect, it } from "vitest";
import { SeededRandomProvider } from "@game-store/game-core";
import { MoonVillageEngine, MoonVillageSeededRandomProvider, type MoonVillageDomainState, type MoonVillageModeratorProjection, type MoonVillagePlayerProjection, type MoonVillagePublicProjection, type MoonVillageRole } from "@game-store/game-moon-village";
import { UnoEngine, type UnoCard } from "@game-store/game-uno";
import { MetricsService } from "../observability/metrics.service";
import { GameProjectionService } from "./game-projection.service";

const metricInstances: MetricsService[] = [];
const service = () => { const metrics = new MetricsService(); metricInstances.push(metrics); return new GameProjectionService(metrics); };
afterEach(() => metricInstances.splice(0).forEach((metrics) => metrics.onModuleDestroy()));

describe("server recipient projections", () => {
  it("keeps Color Clash hands and legal actions recipient-specific", () => {
    const engine = new UnoEngine(new SeededRandomProvider(11));
    const state = engine.createInitialState({ players: [{ id: "alpha", name: "Alpha" }, { id: "beta", name: "Beta" }] });
    const projections = service();
    const alpha = projections.colorClash(state, { mode: "PLAYER", playerId: "alpha" }) as unknown as { ownHand: UnoCard[]; legalActions: unknown[] };
    const beta = projections.colorClash(state, { mode: "PLAYER", playerId: "beta" }) as unknown as { ownHand: UnoCard[]; legalActions: unknown[] };
    const spectator = projections.colorClash(state, { mode: "SPECTATOR" });
    expect(alpha.ownHand).toEqual(state.players[0]!.hand); expect(beta.ownHand).toEqual(state.players[1]!.hand);
    expect(JSON.stringify(alpha)).not.toContain(state.players[1]!.hand[0]!.id);
    expect(JSON.stringify(beta)).not.toContain(state.players[0]!.hand[0]!.id);
    expect(spectator).not.toHaveProperty("ownHand"); expect(spectator.legalActions).toEqual([]);
    expect(() => projections.colorClash(state, { mode: "PLAYER", playerId: "spoofed" })).toThrow("denied");
    expect(() => projections.colorClash(state, { mode: "MODERATOR", granted: false })).toThrow("grant");
    expect(projections.colorClash(state, { mode: "MODERATOR", granted: true })).toHaveProperty("moderation");
  });

  it("removes private draw identifiers from public events", () => {
    const projections = service();
    expect(projections.publicColorClashEvent({ type: "CARD_DRAWN", playerId: "p1", cardId: "secret" })).toEqual({ type: "CARD_DRAWN", playerId: "p1", count: 1 });
    expect(projections.publicColorClashEvent({ type: "PENALTY_DRAWN", playerId: "p2", amount: 4, cardIds: ["a", "b", "c", "d"] })).toEqual({ type: "PENALTY_DRAWN", playerId: "p2", count: 4 });
    expect(projections.publicColorClashEvent({ type: "TURN_CHANGED", playerId: "p2" })).toEqual({ type: "TURN_CHANGED", playerId: "p2" });
  });

  it("enforces Moon Village public, player, team, eliminated, and moderator boundaries", () => {
    const engine = new MoonVillageEngine(new MoonVillageSeededRandomProvider(42));
    const ids = ["hearth", "prowler-a", "reader", "warden", "brewer", "prowler-b"];
    const state = engine.createInitialState({ players: ids.map((id) => ({ id, name: id, kind: "HUMAN" as const })), localPlayerId: "hearth" });
    const roles: MoonVillageRole[] = ["HEARTH_TENDER", "DUSK_PROWLER", "STAR_READER", "GATE_WARDEN", "DEW_BREWER", "DUSK_PROWLER"];
    state.players.forEach((player, index) => { player.role = roles[index]!; });
    state.knowledgeByPlayer.reader = [{ targetPlayerId: "prowler-a", team: "DUSK", learnedRound: 1 }];
    state.privateLogByPlayer.warden = ["Protected hearth from the secret attack"];
    state.night.attackTargetId = "hearth"; state.night.prowlerVotes["prowler-a"] = "hearth"; state.votes.hearth = "prowler-a";
    state.players[0]!.alive = false; state.phase = "DAY_VOTING";

    const projections = service();
    const spectator = projections.moonVillage(state, { mode: "SPECTATOR" }) as MoonVillagePublicProjection;
    const hearth = projections.moonVillage(state, { mode: "PLAYER", playerId: "hearth" }) as MoonVillagePlayerProjection;
    const reader = projections.moonVillage(state, { mode: "PLAYER", playerId: "reader" }) as MoonVillagePlayerProjection;
    const warden = projections.moonVillage(state, { mode: "PLAYER", playerId: "warden" }) as MoonVillagePlayerProjection;
    const dusk = projections.moonVillage(state, { mode: "PLAYER", playerId: "prowler-a" }) as MoonVillagePlayerProjection;
    const spectatorJson = JSON.stringify(spectator); const hearthJson = JSON.stringify(hearth);
    expect(spectatorJson).not.toMatch(/DUSK_PROWLER|STAR_READER|attackTargetId|prowlerVotes|knowledgeByPlayer|Protected hearth/);
    expect(hearth.private.role).toBe("HEARTH_TENDER"); expect(hearth.private.alive).toBe(false); expect(hearth.private.legalActions).toEqual([]);
    expect(hearthJson).not.toMatch(/DUSK_PROWLER|attackTargetId|Protected hearth/);
    expect(reader.private.knowledge).toEqual([{ targetPlayerId: "prowler-a", team: "DUSK", learnedRound: 1 }]);
    expect(JSON.stringify(hearth)).not.toContain("targetPlayerId");
    expect(warden.private.privateLog).toContain("Protected hearth from the secret attack"); expect(JSON.stringify(reader)).not.toContain("Protected hearth");
    expect(dusk.private.teamState?.teammateIds).toEqual(expect.arrayContaining(["prowler-a", "prowler-b"]));
    expect(JSON.stringify(spectator)).not.toContain('"votes"');
    expect(() => projections.moonVillage(state, { mode: "MODERATOR", granted: false })).toThrow("grant");
    const moderator = projections.moonVillage(state, { mode: "MODERATOR", granted: true }) as MoonVillageModeratorProjection;
    expect(moderator.roles["prowler-a"]).toBe("DUSK_PROWLER"); expect(moderator.pendingActions.attackTargetId).toBe("hearth");
  });

  it("reveals only engine-approved resolved vote and end-game information", () => {
    const engine = new MoonVillageEngine(new MoonVillageSeededRandomProvider(7));
    const state = engine.createInitialState({ players: ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id, kind: "HUMAN" as const })), localPlayerId: "a" }) as MoonVillageDomainState;
    state.lastVoteResult = { round: 1, eliminatedPlayerId: "b", tied: false, votes: { a: "b", c: "b" }, tally: { b: 2 } }; state.phase = "RESOLVE_VOTE";
    const publicProjection = service().moonVillage(state, { mode: "SPECTATOR" }) as MoonVillagePublicProjection;
    expect(publicProjection.lastVoteResult?.votes).toEqual({ a: "b", c: "b" });
    state.phase = "FINISHED"; state.winnerTeam = "DAWN";
    expect((service().moonVillage(state, { mode: "SPECTATOR" }) as MoonVillagePublicProjection).revealedRoles).toHaveLength(5);
  });
});
