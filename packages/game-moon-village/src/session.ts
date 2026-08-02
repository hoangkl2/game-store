import type { ActionHistory } from "@game-store/game-core";
import { MoonVillageBot, createMoonVillageBotMemory, type MoonVillageBotDifficulty, type MoonVillageBotMemory } from "./bot";
import { MoonVillageEngine, type MoonVillageAction, type MoonVillageDomainState, type MoonVillagePlayerProjection, type MoonVillageRuleConfig } from "./engine";
import type { MoonVillageRandomSnapshot, MoonVillageSeededRandomProvider } from "./random";

export type MoonVillageSessionSnapshot = {
  serializedState: string; actionHistory: ActionHistory<MoonVillageAction>; botMemories: Record<string, MoonVillageBotMemory>;
  randomState: { game: MoonVillageRandomSnapshot; bot: MoonVillageRandomSnapshot };
};

export class MoonVillageOfflineSession {
  private actionHistory: ActionHistory<MoonVillageAction> = [];
  private botMemories: Record<string, MoonVillageBotMemory> = {};

  constructor(private readonly engine: MoonVillageEngine, private readonly gameRandom: MoonVillageSeededRandomProvider, private readonly botRandom: MoonVillageSeededRandomProvider, private state: MoonVillageDomainState) {
    for (const player of state.players.filter((candidate) => candidate.kind === "BOT")) this.botMemories[player.id] = createMoonVillageBotMemory(engine.projectPublic(state));
  }

  static create(engine: MoonVillageEngine, gameRandom: MoonVillageSeededRandomProvider, botRandom: MoonVillageSeededRandomProvider, config: MoonVillageRuleConfig) { return new MoonVillageOfflineSession(engine, gameRandom, botRandom, engine.createInitialState(config)); }

  projection(): MoonVillagePlayerProjection { return this.engine.projectForPlayer(this.state, this.state.localPlayerId); }
  publicSequence() { return this.state.sequence; }

  submitLocal(action: MoonVillageAction): MoonVillagePlayerProjection {
    if (action.playerId !== this.state.localPlayerId) throw new Error("Offline UI may submit actions only for its authorized local resident");
    this.commit(action);
    return this.projection();
  }

  hasPendingBotAction() { return this.state.players.some((player) => player.kind === "BOT" && this.engine.getValidActions(this.state, player.id).length > 0); }

  advanceOneBot(defaultDifficulty: MoonVillageBotDifficulty): MoonVillagePlayerProjection {
    const player = this.state.players.find((candidate) => candidate.kind === "BOT" && this.engine.getValidActions(this.state, candidate.id).length > 0);
    if (!player) return this.projection();
    const currentProjection = this.engine.projectForPlayer(this.state, player.id);
    const bot = new MoonVillageBot(this.botRandom, player.difficulty ?? defaultDifficulty);
    const observed = bot.observe(currentProjection, this.botMemories[player.id] ?? createMoonVillageBotMemory(currentProjection.public));
    this.botMemories[player.id] = observed;
    this.commit(bot.chooseAction(currentProjection, observed));
    return this.projection();
  }

  exportSnapshot(): MoonVillageSessionSnapshot { return { serializedState: this.engine.serialize(this.state), actionHistory: JSON.parse(JSON.stringify(this.actionHistory)) as ActionHistory<MoonVillageAction>, botMemories: JSON.parse(JSON.stringify(this.botMemories)) as Record<string, MoonVillageBotMemory>, randomState: { game: this.gameRandom.snapshot(), bot: this.botRandom.snapshot() } }; }

  restore(snapshot: MoonVillageSessionSnapshot): MoonVillagePlayerProjection {
    const restored = this.engine.deserialize(snapshot.serializedState);
    if (!Array.isArray(snapshot.actionHistory) || !snapshot.botMemories || !snapshot.randomState) throw new Error("Corrupt Moon Village session snapshot");
    const playerIds = new Set(restored.players.map((player) => player.id));
    if (snapshot.actionHistory.some((entry, index) => !entry || entry.sequence !== index || !entry.action || !playerIds.has(entry.action.playerId) || ("targetPlayerId" in entry.action && !playerIds.has(entry.action.targetPlayerId)))) throw new Error("Corrupt Moon Village action history");
    for (const player of restored.players.filter((candidate) => candidate.kind === "BOT")) {
      const memory = snapshot.botMemories[player.id];
      if (!memory || !memory.suspicion || !memory.trust || !memory.knownTeams || !Array.isArray(memory.voteHistory) || !Array.isArray(memory.accusationHistory) || !Array.isArray(memory.observedVoteRounds)) throw new Error("Corrupt Moon Village bot memory");
      const projection = this.engine.projectForPlayer(restored, player.id);
      const allowedKnowledge = new Map<string, string>(projection.private.knowledge.map((entry) => [entry.targetPlayerId, entry.team]));
      for (const teammateId of projection.private.teamState?.teammateIds ?? []) allowedKnowledge.set(teammateId, "DUSK");
      if (Object.entries(memory.knownTeams).some(([id, team]) => allowedKnowledge.get(id) !== team) || [...Object.keys(memory.suspicion), ...Object.keys(memory.trust)].some((id) => !playerIds.has(id))) throw new Error("Unauthorized Moon Village bot knowledge in save");
    }
    this.gameRandom.restore(snapshot.randomState.game); this.botRandom.restore(snapshot.randomState.bot);
    this.state = restored; this.actionHistory = JSON.parse(JSON.stringify(snapshot.actionHistory)) as ActionHistory<MoonVillageAction>; this.botMemories = JSON.parse(JSON.stringify(snapshot.botMemories)) as Record<string, MoonVillageBotMemory>;
    return this.projection();
  }

  private commit(action: MoonVillageAction) { const result = this.engine.reduce(this.state, action); this.state = result.state; this.actionHistory.push({ sequence: this.actionHistory.length, action, timestamp: new Date().toISOString() }); }
}
