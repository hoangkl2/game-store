import type { BotDifficulty, GameEngine, GameResult, GameTransition, Player, RandomProvider, ValidationResult } from "@game-store/game-core";

export const MOON_VILLAGE_GAME_VERSION = "0.1.0";
export const MOON_VILLAGE_STATE_VERSION = 1;
export const MOON_VILLAGE_PROJECTION_VERSION = 1;

export type MoonVillageTeam = "DAWN" | "DUSK";
export type MoonVillageRole = "HEARTH_TENDER" | "DUSK_PROWLER" | "STAR_READER" | "GATE_WARDEN" | "DEW_BREWER" | "BELL_RANGER";
export type MoonVillagePhase = "ROLE_REVEAL" | "NIGHT_PROWLER" | "NIGHT_READER" | "NIGHT_WARDEN" | "NIGHT_BREWER" | "DAY_ANNOUNCEMENT" | "DAY_DISCUSSION" | "DAY_VOTING" | "RESOLVE_VOTE" | "RANGER_RETALIATION" | "FINISHED";

export const MOON_VILLAGE_ROLE_NAMES: Record<MoonVillageRole, string> = {
  HEARTH_TENDER: "Hearth Tender", DUSK_PROWLER: "Dusk Prowler", STAR_READER: "Star Reader",
  GATE_WARDEN: "Gate Warden", DEW_BREWER: "Dew Brewer", BELL_RANGER: "Bell Ranger",
};

export const roleTeam = (role: MoonVillageRole): MoonVillageTeam => role === "DUSK_PROWLER" ? "DUSK" : "DAWN";

export type MoonVillagePlayerConfig = { id: string; name: string; kind?: "HUMAN" | "BOT"; difficulty?: Exclude<BotDifficulty, "EXPERT"> };
export type MoonVillageRuleConfig = { players: MoonVillagePlayerConfig[]; localPlayerId: string; maxRounds?: number };
export type MoonVillagePlayer = Player & { difficulty?: Exclude<BotDifficulty, "EXPERT">; role: MoonVillageRole; alive: boolean };
export type MoonVillageKnowledge = { targetPlayerId: string; team: MoonVillageTeam; learnedRound: number };
export type MoonVillageVoteResult = { round: number; votes: Record<string, string>; tally: Record<string, number>; eliminatedPlayerId?: string; tied: boolean };

export type MoonVillageAction =
  | { type: "ACKNOWLEDGE_ROLE"; playerId: string }
  | { type: "SELECT_PROWLER_TARGET"; playerId: string; targetPlayerId: string }
  | { type: "SELECT_READER_TARGET"; playerId: string; targetPlayerId: string }
  | { type: "SELECT_WARDEN_TARGET"; playerId: string; targetPlayerId: string }
  | { type: "BREWER_RESTORE"; playerId: string; targetPlayerId: string }
  | { type: "BREWER_MARK"; playerId: string; targetPlayerId: string }
  | { type: "PASS_NIGHT"; playerId: string }
  | { type: "ACKNOWLEDGE_DAWN"; playerId: string }
  | { type: "CONTINUE_DISCUSSION"; playerId: string }
  | { type: "CAST_VOTE"; playerId: string; targetPlayerId: string }
  | { type: "ACKNOWLEDGE_VOTE"; playerId: string }
  | { type: "SELECT_RANGER_TARGET"; playerId: string; targetPlayerId: string };

export type MoonVillageEvent =
  | { type: "ROLE_ASSIGNED"; playerId: string; role: MoonVillageRole }
  | { type: "PHASE_CHANGED"; phase: MoonVillagePhase; round: number }
  | { type: "PRIVATE_ACTION_COMMITTED"; playerId: string; actionType: MoonVillageAction["type"] }
  | { type: "INVESTIGATION_RECORDED"; playerId: string; targetPlayerId: string; team: MoonVillageTeam }
  | { type: "DAWN_REPORTED"; eliminatedPlayerIds: string[] }
  | { type: "DISCUSSION_OPENED"; messages: string[] }
  | { type: "VOTE_RESOLVED"; result: MoonVillageVoteResult }
  | { type: "PLAYER_ELIMINATED"; playerId: string; cause: "NIGHT" | "BREWER" | "VOTE" | "RANGER" }
  | { type: "GAME_FINISHED"; winnerTeam?: MoonVillageTeam; draw: boolean };

type NightState = {
  prowlerVotes: Record<string, string>;
  readerTargets: Record<string, string>;
  wardenTargets: Record<string, string>;
  brewerChoices: Record<string, { type: "RESTORE" | "MARK" | "PASS"; targetPlayerId?: string }>;
  attackTargetId?: string;
  pendingDawnDeaths: string[];
};

export type MoonVillageDomainState = {
  gameVersion: string;
  stateVersion: number;
  projectionVersion: number;
  localPlayerId: string;
  players: MoonVillagePlayer[];
  phase: MoonVillagePhase;
  round: number;
  maxRounds: number;
  sequence: number;
  night: NightState;
  previousWardenTargets: Record<string, string>;
  brewerRestoreUsedBy: string[];
  brewerMarkUsedBy: string[];
  knowledgeByPlayer: Record<string, MoonVillageKnowledge[]>;
  votes: Record<string, string>;
  lastVoteResult?: MoonVillageVoteResult;
  discussionMessages: string[];
  publicLog: string[];
  privateLogByPlayer: Record<string, string[]>;
  pendingRangerPlayerId?: string;
  rangerReturnPhase?: "DAY_ANNOUNCEMENT" | "RESOLVE_VOTE";
  winnerTeam?: MoonVillageTeam;
  draw: boolean;
};

export type MoonVillagePublicPlayer = { id: string; name: string; kind: "HUMAN" | "BOT"; alive: boolean; seat: number };
export type MoonVillagePublicProjection = {
  projectionVersion: number; phase: MoonVillagePhase; round: number; maxRounds: number; sequence: number;
  players: MoonVillagePublicPlayer[]; publicLog: string[]; discussionMessages: string[]; lastVoteResult?: MoonVillageVoteResult;
  winnerTeam?: MoonVillageTeam; draw: boolean; revealedRoles?: { playerId: string; role: MoonVillageRole; team: MoonVillageTeam }[];
};
export type MoonVillageTeamPrivateProjection = { team: MoonVillageTeam; teammateIds: string[] };
export type MoonVillagePlayerPrivateProjection = {
  playerId: string; role: MoonVillageRole; roleName: string; team: MoonVillageTeam; alive: boolean;
  legalActions: MoonVillageAction[]; knowledge: MoonVillageKnowledge[]; privateLog: string[];
  restoreAvailable: boolean; markAvailable: boolean; teamState?: MoonVillageTeamPrivateProjection;
};
export type MoonVillagePlayerProjection = { public: MoonVillagePublicProjection; private: MoonVillagePlayerPrivateProjection };
export type MoonVillageModeratorProjection = { public: MoonVillagePublicProjection; roles: Record<string, MoonVillageRole>; pendingActions: NightState; votes: Record<string, string> };

const roleComposition = (count: number): MoonVillageRole[] => {
  if (count < 5 || count > 8) throw new Error("Moon Village requires 5 to 8 residents");
  const roles: MoonVillageRole[] = ["DUSK_PROWLER", "STAR_READER", "GATE_WARDEN", "DEW_BREWER", "HEARTH_TENDER"];
  if (count >= 6) roles.push("BELL_RANGER");
  if (count >= 7) roles.push("HEARTH_TENDER");
  if (count === 8) roles.push("DUSK_PROWLER");
  return roles;
};

const blankNight = (): NightState => ({ prowlerVotes: {}, readerTargets: {}, wardenTargets: {}, brewerChoices: {}, pendingDawnDeaths: [] });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const actionKey = (action: MoonVillageAction) => JSON.stringify(action);

export class MoonVillageEngine implements GameEngine<MoonVillageDomainState, MoonVillageAction, MoonVillageEvent, MoonVillageRuleConfig> {
  constructor(private readonly random: RandomProvider) {}

  createInitialState(config: MoonVillageRuleConfig): MoonVillageDomainState {
    if (!config.players.some((player) => player.id === config.localPlayerId)) throw new Error("Local Moon Village player is missing");
    if (new Set(config.players.map((player) => player.id)).size !== config.players.length || config.players.some((player) => !player.id.trim() || !player.name.trim())) throw new Error("Moon Village residents require unique IDs and names");
    if (config.maxRounds !== undefined && (!Number.isInteger(config.maxRounds) || config.maxRounds < 1 || config.maxRounds > 50)) throw new Error("Moon Village max rounds must be between 1 and 50");
    const roles = roleComposition(config.players.length);
    for (let index = roles.length - 1; index > 0; index -= 1) { const swap = this.random.int(0, index); [roles[index], roles[swap]] = [roles[swap]!, roles[index]!]; }
    const players: MoonVillagePlayer[] = config.players.map((player, index) => ({ id: player.id, name: player.name, kind: player.kind ?? (player.id === config.localPlayerId ? "HUMAN" : "BOT"), difficulty: player.difficulty, role: roles[index]!, alive: true }));
    const privateLogByPlayer = Object.fromEntries(players.map((player) => [player.id, [`Your role is ${MOON_VILLAGE_ROLE_NAMES[player.role]}.`]]));
    return { gameVersion: MOON_VILLAGE_GAME_VERSION, stateVersion: MOON_VILLAGE_STATE_VERSION, projectionVersion: MOON_VILLAGE_PROJECTION_VERSION, localPlayerId: config.localPlayerId, players, phase: "ROLE_REVEAL", round: 1, maxRounds: config.maxRounds ?? 12, sequence: 0, night: blankNight(), previousWardenTargets: {}, brewerRestoreUsedBy: [], brewerMarkUsedBy: [], knowledgeByPlayer: Object.fromEntries(players.map((player) => [player.id, []])), votes: {}, discussionMessages: [], publicLog: ["Moon Village gathered beneath the first lantern."], privateLogByPlayer, draw: false };
  }

  validateAction(state: MoonVillageDomainState, action: MoonVillageAction): ValidationResult {
    if (state.phase === "FINISHED") return { valid: false, code: "GAME_FINISHED", message: "Moon Village has finished" };
    if (!state.players.some((player) => player.id === action.playerId)) return { valid: false, code: "UNKNOWN_PLAYER", message: "Resident is not part of this village" };
    const valid = this.getValidActions(state, action.playerId).some((candidate) => actionKey(candidate) === actionKey(action));
    return valid ? { valid: true } : { valid: false, code: "ILLEGAL_ACTION", message: "That action is unavailable in the current phase" };
  }

  reduce(state: MoonVillageDomainState, action: MoonVillageAction): GameTransition<MoonVillageDomainState, MoonVillageEvent> {
    const validation = this.validateAction(state, action);
    if (!validation.valid) throw new Error(`${validation.code}: ${validation.message}`);
    const next = clone(state);
    next.sequence += 1;
    const events: MoonVillageEvent[] = [];
    const privateCommit = () => events.push({ type: "PRIVATE_ACTION_COMMITTED", playerId: action.playerId, actionType: action.type });

    switch (action.type) {
      case "ACKNOWLEDGE_ROLE": this.enterNightPhase(next, "NIGHT_PROWLER", events); break;
      case "SELECT_PROWLER_TARGET": next.night.prowlerVotes[action.playerId] = action.targetPlayerId; privateCommit(); this.advanceNightIfComplete(next, "DUSK_PROWLER", "NIGHT_READER", events); break;
      case "SELECT_READER_TARGET": {
        next.night.readerTargets[action.playerId] = action.targetPlayerId;
        const team = roleTeam(this.player(next, action.targetPlayerId).role);
        next.knowledgeByPlayer[action.playerId]!.push({ targetPlayerId: action.targetPlayerId, team, learnedRound: next.round });
        next.privateLogByPlayer[action.playerId]!.push(`${this.player(next, action.targetPlayerId).name} is aligned with ${team === "DUSK" ? "Dusk" : "Dawn"}.`);
        privateCommit(); events.push({ type: "INVESTIGATION_RECORDED", playerId: action.playerId, targetPlayerId: action.targetPlayerId, team });
        this.advanceNightIfComplete(next, "STAR_READER", "NIGHT_WARDEN", events); break;
      }
      case "SELECT_WARDEN_TARGET": next.night.wardenTargets[action.playerId] = action.targetPlayerId; next.previousWardenTargets[action.playerId] = action.targetPlayerId; privateCommit(); this.advanceNightIfComplete(next, "GATE_WARDEN", "NIGHT_BREWER", events); break;
      case "BREWER_RESTORE": next.night.brewerChoices[action.playerId] = { type: "RESTORE", targetPlayerId: action.targetPlayerId }; next.brewerRestoreUsedBy.push(action.playerId); privateCommit(); this.advanceNightIfComplete(next, "DEW_BREWER", undefined, events); break;
      case "BREWER_MARK": next.night.brewerChoices[action.playerId] = { type: "MARK", targetPlayerId: action.targetPlayerId }; next.brewerMarkUsedBy.push(action.playerId); privateCommit(); this.advanceNightIfComplete(next, "DEW_BREWER", undefined, events); break;
      case "PASS_NIGHT": {
        const role = this.player(next, action.playerId).role;
        if (role === "DUSK_PROWLER") next.night.prowlerVotes[action.playerId] = "PASS";
        if (role === "STAR_READER") next.night.readerTargets[action.playerId] = "PASS";
        if (role === "GATE_WARDEN") next.night.wardenTargets[action.playerId] = "PASS";
        if (role === "DEW_BREWER") next.night.brewerChoices[action.playerId] = { type: "PASS" };
        privateCommit();
        const map: Partial<Record<MoonVillageRole, MoonVillagePhase>> = { DUSK_PROWLER: "NIGHT_READER", STAR_READER: "NIGHT_WARDEN", GATE_WARDEN: "NIGHT_BREWER" };
        this.advanceNightIfComplete(next, role, map[role], events); break;
      }
      case "ACKNOWLEDGE_DAWN": this.enterPhase(next, "DAY_DISCUSSION", events); break;
      case "CONTINUE_DISCUSSION": this.enterPhase(next, "DAY_VOTING", events); break;
      case "CAST_VOTE": {
        next.votes[action.playerId] = action.targetPlayerId;
        privateCommit();
        if (this.alive(next).every((player) => next.votes[player.id])) this.resolveVote(next, events);
        break;
      }
      case "ACKNOWLEDGE_VOTE": this.completeRound(next, events); break;
      case "SELECT_RANGER_TARGET": {
        this.eliminate(next, action.targetPlayerId, "RANGER", events);
        next.publicLog.push(`A final bell sounded; ${this.player(next, action.targetPlayerId).name} left the village.`);
        next.pendingRangerPlayerId = undefined;
        const returnPhase = next.rangerReturnPhase ?? "DAY_ANNOUNCEMENT";
        next.rangerReturnPhase = undefined;
        if (!this.finishForTeamParity(next, events)) this.enterPhase(next, returnPhase, events);
        break;
      }
    }
    return { state: next, events };
  }

  getValidActions(state: MoonVillageDomainState, playerId: string): MoonVillageAction[] {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player || state.phase === "FINISHED") return [];
    if (state.phase === "ROLE_REVEAL") return playerId === state.localPlayerId ? [{ type: "ACKNOWLEDGE_ROLE", playerId }] : [];
    if (state.phase === "DAY_ANNOUNCEMENT") return playerId === state.localPlayerId ? [{ type: "ACKNOWLEDGE_DAWN", playerId }] : [];
    if (state.phase === "DAY_DISCUSSION") return playerId === state.localPlayerId ? [{ type: "CONTINUE_DISCUSSION", playerId }] : [];
    if (state.phase === "RESOLVE_VOTE") return playerId === state.localPlayerId ? [{ type: "ACKNOWLEDGE_VOTE", playerId }] : [];
    if (state.phase === "RANGER_RETALIATION" && state.pendingRangerPlayerId === playerId) return this.alive(state).map((candidate) => ({ type: "SELECT_RANGER_TARGET" as const, playerId, targetPlayerId: candidate.id }));
    if (!player.alive) return [];
    const targets = this.alive(state).filter((candidate) => candidate.id !== playerId);
    if (state.phase === "NIGHT_PROWLER" && player.role === "DUSK_PROWLER" && !state.night.prowlerVotes[playerId]) return targets.filter((candidate) => roleTeam(candidate.role) !== "DUSK").map((candidate) => ({ type: "SELECT_PROWLER_TARGET" as const, playerId, targetPlayerId: candidate.id }));
    if (state.phase === "NIGHT_READER" && player.role === "STAR_READER" && !state.night.readerTargets[playerId]) return targets.map((candidate) => ({ type: "SELECT_READER_TARGET" as const, playerId, targetPlayerId: candidate.id }));
    if (state.phase === "NIGHT_WARDEN" && player.role === "GATE_WARDEN" && !state.night.wardenTargets[playerId]) return this.alive(state).filter((candidate) => candidate.id !== state.previousWardenTargets[playerId]).map((candidate) => ({ type: "SELECT_WARDEN_TARGET" as const, playerId, targetPlayerId: candidate.id }));
    if (state.phase === "NIGHT_BREWER" && player.role === "DEW_BREWER" && !state.night.brewerChoices[playerId]) {
      const actions: MoonVillageAction[] = [{ type: "PASS_NIGHT", playerId }];
      if (!state.brewerRestoreUsedBy.includes(playerId) && state.night.attackTargetId) actions.push({ type: "BREWER_RESTORE", playerId, targetPlayerId: state.night.attackTargetId });
      if (!state.brewerMarkUsedBy.includes(playerId)) actions.push(...targets.map((candidate) => ({ type: "BREWER_MARK" as const, playerId, targetPlayerId: candidate.id })));
      return actions;
    }
    if (state.phase === "DAY_VOTING" && !state.votes[playerId]) return targets.map((candidate) => ({ type: "CAST_VOTE" as const, playerId, targetPlayerId: candidate.id }));
    return [];
  }

  checkGameOver(state: MoonVillageDomainState): GameResult | null {
    if (state.phase !== "FINISHED") return null;
    if (state.draw) return { outcome: "DRAW" };
    const winners = state.players.filter((player) => roleTeam(player.role) === state.winnerTeam).map((player) => player.id);
    return { outcome: "WIN", winnerId: winners[0], rankings: winners };
  }

  serialize(state: MoonVillageDomainState): string { return JSON.stringify(state); }
  deserialize(data: string): MoonVillageDomainState {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== "object") throw new Error("Invalid Moon Village state");
    const state = value as Partial<MoonVillageDomainState>;
    const phases: MoonVillagePhase[] = ["ROLE_REVEAL", "NIGHT_PROWLER", "NIGHT_READER", "NIGHT_WARDEN", "NIGHT_BREWER", "DAY_ANNOUNCEMENT", "DAY_DISCUSSION", "DAY_VOTING", "RESOLVE_VOTE", "RANGER_RETALIATION", "FINISHED"];
    const roles = Object.keys(MOON_VILLAGE_ROLE_NAMES) as MoonVillageRole[];
    const playerIds = new Set(state.players?.map((player) => player?.id));
    const expectedRoles = state.players && state.players.length >= 5 && state.players.length <= 8 ? roleComposition(state.players.length).sort() : [];
    const actualRoles = state.players?.map((player) => player?.role).sort();
    const basicInvalid = state.gameVersion !== MOON_VILLAGE_GAME_VERSION || state.stateVersion !== MOON_VILLAGE_STATE_VERSION || state.projectionVersion !== MOON_VILLAGE_PROJECTION_VERSION || !state.phase || !phases.includes(state.phase) || !Array.isArray(state.players) || state.players.length < 5 || state.players.length > 8 || playerIds.size !== state.players.length || state.players.some((player) => !player || typeof player.id !== "string" || !player.id || typeof player.name !== "string" || !player.name || (player.kind !== "HUMAN" && player.kind !== "BOT") || !roles.includes(player.role) || typeof player.alive !== "boolean") || JSON.stringify(actualRoles) !== JSON.stringify(expectedRoles) || typeof state.localPlayerId !== "string" || !playerIds.has(state.localPlayerId) || !Number.isInteger(state.round) || state.round! < 1 || !Number.isInteger(state.maxRounds) || state.maxRounds! < 1 || !Number.isInteger(state.sequence) || state.sequence! < 0 || !state.night || !state.knowledgeByPlayer || !state.privateLogByPlayer || !state.votes || !Array.isArray(state.publicLog) || !Array.isArray(state.discussionMessages) || !Array.isArray(state.brewerRestoreUsedBy) || !Array.isArray(state.brewerMarkUsedBy) || !state.previousWardenTargets || typeof state.draw !== "boolean";
    const mapInvalid = !basicInvalid && state.players!.some((player) => !Array.isArray(state.knowledgeByPlayer![player.id]) || !Array.isArray(state.privateLogByPlayer![player.id]) || state.knowledgeByPlayer![player.id]!.some((entry) => !playerIds.has(entry.targetPlayerId) || (entry.team !== "DAWN" && entry.team !== "DUSK") || !Number.isInteger(entry.learnedRound))) || Object.entries(state.votes!).some(([voter, target]) => !playerIds.has(voter) || !playerIds.has(target)) || [...state.brewerRestoreUsedBy!, ...state.brewerMarkUsedBy!].some((id) => !playerIds.has(id));
    if (basicInvalid || mapInvalid) throw new Error("Unsupported or corrupt Moon Village state");
    return clone(state as MoonVillageDomainState);
  }

  projectPublic(state: MoonVillageDomainState): MoonVillagePublicProjection {
    return { projectionVersion: state.projectionVersion, phase: state.phase, round: state.round, maxRounds: state.maxRounds, sequence: state.sequence, players: state.players.map((player, seat) => ({ id: player.id, name: player.name, kind: player.kind, alive: player.alive, seat })), publicLog: [...state.publicLog], discussionMessages: [...state.discussionMessages], lastVoteResult: state.lastVoteResult ? clone(state.lastVoteResult) : undefined, winnerTeam: state.winnerTeam, draw: state.draw, revealedRoles: state.phase === "FINISHED" ? state.players.map((player) => ({ playerId: player.id, role: player.role, team: roleTeam(player.role) })) : undefined };
  }

  projectForPlayer(state: MoonVillageDomainState, playerId: string): MoonVillagePlayerProjection {
    const player = this.player(state, playerId);
    const team = roleTeam(player.role);
    return { public: this.projectPublic(state), private: { playerId, role: player.role, roleName: MOON_VILLAGE_ROLE_NAMES[player.role], team, alive: player.alive, legalActions: this.getValidActions(state, playerId), knowledge: clone(state.knowledgeByPlayer[playerId] ?? []), privateLog: [...(state.privateLogByPlayer[playerId] ?? [])], restoreAvailable: !state.brewerRestoreUsedBy.includes(playerId), markAvailable: !state.brewerMarkUsedBy.includes(playerId), teamState: team === "DUSK" ? { team, teammateIds: state.players.filter((candidate) => roleTeam(candidate.role) === "DUSK").map((candidate) => candidate.id) } : undefined } };
  }

  projectForModerator(state: MoonVillageDomainState, trustedServerGrant: symbol): MoonVillageModeratorProjection {
    if (trustedServerGrant !== MOON_VILLAGE_SERVER_GRANT) throw new Error("Moderator projection requires trusted server authority");
    return { public: this.projectPublic(state), roles: Object.fromEntries(state.players.map((player) => [player.id, player.role])), pendingActions: clone(state.night), votes: { ...state.votes } };
  }

  private player(state: MoonVillageDomainState, id: string) { const player = state.players.find((candidate) => candidate.id === id); if (!player) throw new Error("Unknown Moon Village resident"); return player; }
  private alive(state: MoonVillageDomainState) { return state.players.filter((player) => player.alive); }
  private roleActors(state: MoonVillageDomainState, role: MoonVillageRole) { return this.alive(state).filter((player) => player.role === role); }
  private enterPhase(state: MoonVillageDomainState, phase: MoonVillagePhase, events: MoonVillageEvent[]) { state.phase = phase; if (phase === "DAY_DISCUSSION") { state.discussionMessages = this.makeDiscussion(state); events.push({ type: "DISCUSSION_OPENED", messages: [...state.discussionMessages] }); } events.push({ type: "PHASE_CHANGED", phase, round: state.round }); }

  private enterNightPhase(state: MoonVillageDomainState, phase: MoonVillagePhase, events: MoonVillageEvent[]) {
    this.enterPhase(state, phase, events);
    const roles: Partial<Record<MoonVillagePhase, MoonVillageRole>> = { NIGHT_PROWLER: "DUSK_PROWLER", NIGHT_READER: "STAR_READER", NIGHT_WARDEN: "GATE_WARDEN", NIGHT_BREWER: "DEW_BREWER" };
    const role = roles[phase];
    if (!role || this.roleActors(state, role).length) return;
    const next: Partial<Record<MoonVillagePhase, MoonVillagePhase>> = { NIGHT_PROWLER: "NIGHT_READER", NIGHT_READER: "NIGHT_WARDEN", NIGHT_WARDEN: "NIGHT_BREWER" };
    if (phase === "NIGHT_BREWER") this.resolveNight(state, events); else this.enterNightPhase(state, next[phase]!, events);
  }

  private advanceNightIfComplete(state: MoonVillageDomainState, role: MoonVillageRole, nextPhase: MoonVillagePhase | undefined, events: MoonVillageEvent[]) {
    const submitted = role === "DUSK_PROWLER" ? state.night.prowlerVotes : role === "STAR_READER" ? state.night.readerTargets : role === "GATE_WARDEN" ? state.night.wardenTargets : state.night.brewerChoices;
    if (!this.roleActors(state, role).every((player) => submitted[player.id])) return;
    if (role === "DUSK_PROWLER") state.night.attackTargetId = this.pluralityTarget(Object.values(state.night.prowlerVotes).filter((id) => id !== "PASS"));
    if (nextPhase) this.enterNightPhase(state, nextPhase, events); else this.resolveNight(state, events);
  }

  private pluralityTarget(targets: string[]) { const counts = targets.reduce<Record<string, number>>((all, target) => ({ ...all, [target]: (all[target] ?? 0) + 1 }), {}); return Object.entries(counts).sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b))[0]?.[0]; }

  private resolveNight(state: MoonVillageDomainState, events: MoonVillageEvent[]) {
    const deaths = new Set<string>();
    const protectedIds = new Set(Object.values(state.night.wardenTargets).filter((id) => id !== "PASS"));
    const restoredIds = new Set(Object.values(state.night.brewerChoices).filter((choice) => choice.type === "RESTORE").map((choice) => choice.targetPlayerId!));
    if (state.night.attackTargetId && !protectedIds.has(state.night.attackTargetId) && !restoredIds.has(state.night.attackTargetId)) deaths.add(state.night.attackTargetId);
    for (const choice of Object.values(state.night.brewerChoices)) if (choice.type === "MARK" && choice.targetPlayerId) deaths.add(choice.targetPlayerId);
    for (const id of deaths) this.eliminate(state, id, id === state.night.attackTargetId ? "NIGHT" : "BREWER", events);
    state.night.pendingDawnDeaths = [...deaths];
    state.publicLog.push(deaths.size ? `Dawn ${state.round}: ${[...deaths].map((id) => this.player(state, id).name).join(" and ")} left the village.` : `Dawn ${state.round}: every lantern remained lit.`);
    events.push({ type: "DAWN_REPORTED", eliminatedPlayerIds: [...deaths] });
    const ranger = [...deaths].map((id) => this.player(state, id)).find((player) => player.role === "BELL_RANGER");
    if (ranger) { state.pendingRangerPlayerId = ranger.id; state.rangerReturnPhase = "DAY_ANNOUNCEMENT"; this.enterPhase(state, "RANGER_RETALIATION", events); return; }
    if (!this.finishForTeamParity(state, events)) this.enterPhase(state, "DAY_ANNOUNCEMENT", events);
  }

  private resolveVote(state: MoonVillageDomainState, events: MoonVillageEvent[]) {
    const tally = Object.values(state.votes).reduce<Record<string, number>>((all, target) => ({ ...all, [target]: (all[target] ?? 0) + 1 }), {});
    const ordered = Object.entries(tally).sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b));
    const tied = ordered.length > 1 && ordered[0]![1] === ordered[1]![1];
    const eliminatedPlayerId = tied ? undefined : ordered[0]?.[0];
    const result: MoonVillageVoteResult = { round: state.round, votes: { ...state.votes }, tally, eliminatedPlayerId, tied };
    state.lastVoteResult = result;
    state.publicLog.push(tied ? `Vote ${state.round}: the village reached no decision.` : `Vote ${state.round}: ${this.player(state, eliminatedPlayerId!).name} left the village.`);
    events.push({ type: "VOTE_RESOLVED", result: clone(result) });
    if (eliminatedPlayerId) this.eliminate(state, eliminatedPlayerId, "VOTE", events);
    if (eliminatedPlayerId && this.player(state, eliminatedPlayerId).role === "BELL_RANGER") { state.pendingRangerPlayerId = eliminatedPlayerId; state.rangerReturnPhase = "RESOLVE_VOTE"; this.enterPhase(state, "RANGER_RETALIATION", events); return; }
    this.enterPhase(state, "RESOLVE_VOTE", events);
  }

  private completeRound(state: MoonVillageDomainState, events: MoonVillageEvent[]) {
    if (this.finishForTeamParity(state, events)) return;
    if (state.round >= state.maxRounds) {
      const dawn = this.alive(state).filter((player) => roleTeam(player.role) === "DAWN").length;
      const dusk = this.alive(state).length - dawn;
      state.draw = dawn === dusk; state.winnerTeam = dawn === dusk ? undefined : dawn > dusk ? "DAWN" : "DUSK";
      this.enterPhase(state, "FINISHED", events); events.push({ type: "GAME_FINISHED", winnerTeam: state.winnerTeam, draw: state.draw }); return;
    }
    state.round += 1; state.night = blankNight(); state.votes = {}; state.discussionMessages = []; this.enterNightPhase(state, "NIGHT_PROWLER", events);
  }

  private eliminate(state: MoonVillageDomainState, id: string, cause: "NIGHT" | "BREWER" | "VOTE" | "RANGER", events: MoonVillageEvent[]) { const player = this.player(state, id); if (!player.alive) return; player.alive = false; events.push({ type: "PLAYER_ELIMINATED", playerId: id, cause }); }
  private finishForTeamParity(state: MoonVillageDomainState, events: MoonVillageEvent[]) { const living = this.alive(state); const dusk = living.filter((player) => roleTeam(player.role) === "DUSK").length; const dawn = living.length - dusk; const winner = dusk === 0 ? "DAWN" : dusk >= dawn ? "DUSK" : undefined; if (!winner) return false; state.winnerTeam = winner; state.phase = "FINISHED"; events.push({ type: "PHASE_CHANGED", phase: "FINISHED", round: state.round }, { type: "GAME_FINISHED", winnerTeam: winner, draw: false }); return true; }
  private makeDiscussion(state: MoonVillageDomainState) { const livingBots = this.alive(state).filter((player) => player.kind === "BOT"); return livingBots.slice(0, 3).map((player, index) => index === 0 ? `${player.name}: The vote trail matters more than the mist.` : index === 1 ? `${player.name}: I am watching who follows an accusation too quickly.` : `${player.name}: A quiet night does not clear anyone.`); }
}

const MOON_VILLAGE_SERVER_GRANT = Symbol("moon-village-trusted-server");

/** Server adapter boundary. This does not grant access to state; callers must already hold trusted authoritative state. */
export function projectMoonVillageForTrustedModerator(engine: MoonVillageEngine, state: MoonVillageDomainState): MoonVillageModeratorProjection {
  return engine.projectForModerator(state, MOON_VILLAGE_SERVER_GRANT);
}

export const replayMoonVillage = (engine: MoonVillageEngine, initialState: MoonVillageDomainState, actions: readonly MoonVillageAction[]) => actions.reduce((state, action) => engine.reduce(state, action).state, clone(initialState));
