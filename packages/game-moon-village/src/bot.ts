import type { RandomProvider } from "@game-store/game-core";
import type { MoonVillageAction, MoonVillagePlayerProjection, MoonVillagePublicProjection, MoonVillageTeam } from "./engine";

export type MoonVillageBotDifficulty = "EASY" | "NORMAL" | "HARD";
export type MoonVillageBotIntent = { intent: "ACCUSE" | "DEFEND" | "OBSERVE"; targetPlayerId?: string; reason: "VOTE_TRAIL" | "KNOWN_ALIGNMENT" | "QUIET_NIGHT" | "LOW_INFORMATION" };
export type MoonVillageBotMemory = {
  suspicion: Record<string, number>; trust: Record<string, number>; voteHistory: { round: number; voterId: string; targetId: string }[];
  accusationHistory: { round: number; targetId: string }[]; knownTeams: Record<string, MoonVillageTeam>; contradictions: Record<string, number>; allianceLikelihood: Record<string, number>;
  observedVoteRounds: number[];
};

export const createMoonVillageBotMemory = (projection: MoonVillagePublicProjection): MoonVillageBotMemory => ({ suspicion: Object.fromEntries(projection.players.map((player) => [player.id, 0])), trust: Object.fromEntries(projection.players.map((player) => [player.id, 0])), voteHistory: [], accusationHistory: [], knownTeams: {}, contradictions: {}, allianceLikelihood: {}, observedVoteRounds: [] });

export class MoonVillageBot {
  constructor(private readonly random: RandomProvider, readonly difficulty: MoonVillageBotDifficulty) {}

  observe(projection: MoonVillagePlayerProjection, memory: MoonVillageBotMemory): MoonVillageBotMemory {
    const next: MoonVillageBotMemory = JSON.parse(JSON.stringify(memory)) as MoonVillageBotMemory;
    for (const item of projection.private.knowledge) { next.knownTeams[item.targetPlayerId] = item.team; next.suspicion[item.targetPlayerId] = item.team === "DUSK" ? 100 : -50; }
    for (const teammateId of projection.private.teamState?.teammateIds ?? []) { next.knownTeams[teammateId] = "DUSK"; next.trust[teammateId] = 40; }
    const result = projection.public.lastVoteResult;
    if (result && !next.observedVoteRounds.includes(result.round)) {
      next.observedVoteRounds.push(result.round);
      for (const [voterId, targetId] of Object.entries(result.votes)) {
        next.voteHistory.push({ round: result.round, voterId, targetId });
        if (next.knownTeams[targetId] === "DAWN") next.suspicion[voterId] = (next.suspicion[voterId] ?? 0) + 8;
        if (next.knownTeams[targetId] === "DUSK") next.trust[voterId] = (next.trust[voterId] ?? 0) + 3;
        next.allianceLikelihood[targetId] = (next.allianceLikelihood[targetId] ?? 0) + 1;
      }
    }
    return next;
  }

  chooseAction(projection: MoonVillagePlayerProjection, memory: MoonVillageBotMemory): MoonVillageAction {
    const actions = projection.private.legalActions;
    if (!actions.length) throw new Error("Moon Village bot has no legal action");
    if (this.difficulty === "EASY") return this.random.pick(actions);
    const scored = actions.map((action) => ({ action, score: this.score(action, projection, memory) + (this.difficulty === "HARD" ? this.random.next() * 0.01 : this.random.next() * 0.25) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0]!.action;
  }

  createIntent(projection: MoonVillagePlayerProjection, memory: MoonVillageBotMemory): MoonVillageBotIntent {
    const candidates = projection.public.players.filter((player) => player.alive && player.id !== projection.private.playerId).sort((a, b) => (memory.suspicion[b.id] ?? 0) - (memory.suspicion[a.id] ?? 0));
    const target = candidates[0];
    if (!target) return { intent: "OBSERVE", reason: "LOW_INFORMATION" };
    return (memory.suspicion[target.id] ?? 0) > 10 ? { intent: "ACCUSE", targetPlayerId: target.id, reason: memory.knownTeams[target.id] ? "KNOWN_ALIGNMENT" : "VOTE_TRAIL" } : { intent: "OBSERVE", targetPlayerId: target.id, reason: "QUIET_NIGHT" };
  }

  private score(action: MoonVillageAction, projection: MoonVillagePlayerProjection, memory: MoonVillageBotMemory) {
    if (action.type === "BREWER_RESTORE") return 80;
    if (action.type === "PASS_NIGHT") return projection.private.markAvailable ? 8 : 30;
    if (!("targetPlayerId" in action)) return 10;
    const targetId = action.targetPlayerId;
    const suspicion = memory.suspicion[targetId] ?? 0;
    const trust = memory.trust[targetId] ?? 0;
    if (action.type === "SELECT_PROWLER_TARGET") return 30 + trust - suspicion;
    if (action.type === "SELECT_READER_TARGET") return memory.knownTeams[targetId] ? -100 : 25 + suspicion;
    if (action.type === "SELECT_WARDEN_TARGET") return 20 + trust - Math.max(0, suspicion);
    if (action.type === "BREWER_MARK" || action.type === "CAST_VOTE" || action.type === "SELECT_RANGER_TARGET") return 20 + suspicion - trust;
    return 0;
  }
}
