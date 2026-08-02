import type { GameBot, RandomProvider } from "@game-store/game-core";
import { PROPERTY_TILES } from "./board";
import { PropertyEmpireEngine, type PropertyEmpireAction, type PropertyEmpireBotDifficulty, type PropertyEmpireDomainState } from "./engine";

export class PropertyEmpireBot implements GameBot<PropertyEmpireDomainState, PropertyEmpireAction> {
  constructor(private readonly engine: PropertyEmpireEngine, private readonly random: RandomProvider) {}

  chooseAction(state: PropertyEmpireDomainState, playerId: string): PropertyEmpireAction {
    const actions = this.engine.getValidActions(state, playerId);
    if (actions.length === 0) throw new Error("No legal Property Empire action");
    if (actions.length === 1) return actions[0]!;
    const difficulty = state.players.find((player) => player.id === playerId)?.difficulty ?? "NORMAL";
    if (difficulty === "EASY") return this.random.pick(actions);
    return actions.map((action) => ({ action, score: this.score(state, playerId, action, difficulty) })).sort((left, right) => right.score - left.score)[0]!.action;
  }

  private score(state: PropertyEmpireDomainState, playerId: string, action: PropertyEmpireAction, difficulty: PropertyEmpireBotDifficulty) {
    if (action.type !== "BUY_PROPERTY") return 0;
    const property = PROPERTY_TILES.find((tile) => tile.id === action.propertyId)!;
    const player = state.players.find((candidate) => candidate.id === playerId)!;
    const projectedCash = player.cash - property.price;
    const reserve = difficulty === "HARD" ? Math.max(140, Math.round(player.cash * 0.25)) : 180;
    if (projectedCash < reserve) return -100;
    const yieldScore = (property.baseRent / property.price) * 100;
    if (difficulty === "NORMAL") return 20 + yieldScore;
    const ownedInGroup = PROPERTY_TILES.filter((tile) => tile.group === property.group && this.engine.getPropertyOwner(state, tile.id) === playerId).length;
    const phasePressure = state.turnNumber / state.rules.maxTurns;
    return 30 + yieldScore + ownedInGroup * 25 + phasePressure * 10;
  }
}
