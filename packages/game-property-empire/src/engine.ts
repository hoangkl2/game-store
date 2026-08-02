import type { GameEngine, GameReplay, GameResult, GameTransition, SavedGame, ValidationResult, RandomProvider } from "@game-store/game-core";
import {
  PROPERTY_EMPIRE_BOARD,
  PROPERTY_EMPIRE_BOARD_VERSION,
  PROPERTY_TILES,
  TRANSIT_HOLD_INDEX,
  getPropertyEmpireTile,
  type PropertyTile,
} from "./board";
import type { PropertyEmpireRandomSnapshot } from "./random";

export const PROPERTY_EMPIRE_GAME_TYPE = "PROPERTY_EMPIRE" as const;
export const PROPERTY_EMPIRE_GAME_VERSION = "1.0.0" as const;
export const PROPERTY_EMPIRE_STATE_VERSION = 1 as const;

export type PropertyEmpireBotDifficulty = "EASY" | "NORMAL" | "HARD";
export type PropertyEmpirePlayer = {
  id: string;
  name: string;
  kind: "HUMAN" | "BOT";
  difficulty?: PropertyEmpireBotDifficulty;
  marker: "V" | "K" | "A" | "N";
  cash: number;
  position: number;
  inTransitHold: boolean;
  bankrupt: boolean;
};
export type PropertyOwnership = { tileId: string; ownerId?: string };
export type PropertyEmpireRuleConfig = { startingCash: number; passSalary: number; maxTurns: number };
export type PropertyEmpireConfig = {
  players: ReadonlyArray<{ id: string; name: string; kind?: "HUMAN" | "BOT"; difficulty?: PropertyEmpireBotDifficulty }>;
  startingCash?: number;
  passSalary?: number;
  maxTurns?: number;
};
export type PendingPurchaseDecision = { type: "PURCHASE"; playerId: string; propertyId: string; price: number; currentCash: number; projectedCash: number };
export type PropertyEmpireTransaction = {
  id: string;
  turnNumber: number;
  type: "SALARY" | "PURCHASE" | "RENT" | "TAX" | "EVENT" | "BANKRUPTCY";
  playerId: string;
  counterpartyId?: string;
  tileId?: string;
  amount: number;
  balanceAfter: number;
  summary: string;
};
export type PropertyEmpireDomainState = {
  gameType: typeof PROPERTY_EMPIRE_GAME_TYPE;
  gameVersion: typeof PROPERTY_EMPIRE_GAME_VERSION;
  stateVersion: typeof PROPERTY_EMPIRE_STATE_VERSION;
  boardVersion: typeof PROPERTY_EMPIRE_BOARD_VERSION;
  rules: PropertyEmpireRuleConfig;
  players: PropertyEmpirePlayer[];
  ownership: PropertyOwnership[];
  currentPlayerIndex: number;
  phase: "ROLL" | "PURCHASE_DECISION" | "END_TURN" | "FINISHED";
  dice?: readonly [number, number];
  pendingDecision?: PendingPurchaseDecision;
  lastEventCardId?: string;
  transactions: PropertyEmpireTransaction[];
  eliminatedPlayerIds: string[];
  rankings: string[];
  turnNumber: number;
};

export type PropertyEmpireAction =
  | { type: "ROLL_DICE"; playerId: string }
  | { type: "BUY_PROPERTY"; playerId: string; propertyId: string }
  | { type: "DECLINE_PROPERTY"; playerId: string; propertyId: string }
  | { type: "END_TURN"; playerId: string };

export type PropertyEmpireEvent =
  | { type: "DICE_ROLLED"; playerId: string; values: readonly [number, number] }
  | { type: "TOKEN_MOVED"; playerId: string; fromTileId: string; toTileId: string; pathTileIds: string[] }
  | { type: "PASSED_FOUNDERS_GATE"; playerId: string; amount: number }
  | { type: "PROPERTY_OFFERED"; playerId: string; propertyId: string; price: number; projectedCash: number }
  | { type: "PROPERTY_PURCHASED"; playerId: string; propertyId: string; price: number }
  | { type: "PROPERTY_DECLINED"; playerId: string; propertyId: string }
  | { type: "PROPERTY_UNAFFORDABLE"; playerId: string; propertyId: string; price: number }
  | { type: "RENT_PAID"; fromPlayerId: string; toPlayerId: string; propertyId: string; amountDue: number; amountPaid: number }
  | { type: "TAX_PAID"; playerId: string; tileId: string; amountDue: number; amountPaid: number }
  | { type: "EVENT_CARD_DRAWN"; playerId: string; cardId: string; title: string; summary: string }
  | { type: "CASH_CHANGED"; playerId: string; amount: number; balance: number; reason: string }
  | { type: "PLAYER_SENT_TO_TRANSIT_HOLD"; playerId: string; source: "EVENT" }
  | { type: "PLAYER_RELEASED_FROM_TRANSIT_HOLD"; playerId: string; reason: "DOUBLES" | "SERVED" }
  | { type: "PLAYER_BANKRUPT"; playerId: string; amountDue: number; amountPaid: number; releasedPropertyIds: string[] }
  | { type: "TURN_CHANGED"; previousPlayerId: string; currentPlayerId: string }
  | { type: "GAME_FINISHED"; rankings: string[]; reason: "LAST_SOLVENT" | "TURN_LIMIT" };

type EventCard = {
  id: string;
  deck: "MARKET_SIGNAL" | "CIVIC_DISPATCH";
  title: string;
  summary: string;
  effect: { type: "CASH"; amount: number } | { type: "TRANSIT_HOLD" };
};

export const PROPERTY_EMPIRE_EVENT_CARDS: readonly EventCard[] = [
  { id: "market-city-grant", deck: "MARKET_SIGNAL", title: "City Makers Grant", summary: "Receive 80 credits for local investment.", effect: { type: "CASH", amount: 80 } },
  { id: "market-repair-cycle", deck: "MARKET_SIGNAL", title: "Repair Cycle", summary: "Pay 50 credits for scheduled repairs.", effect: { type: "CASH", amount: -50 } },
  { id: "market-night-festival", deck: "MARKET_SIGNAL", title: "Night Festival", summary: "Receive 40 credits from increased foot traffic.", effect: { type: "CASH", amount: 40 } },
  { id: "civic-transit-audit", deck: "CIVIC_DISPATCH", title: "Transit Audit", summary: "Report to Transit Hold.", effect: { type: "TRANSIT_HOLD" } },
  { id: "civic-green-rebate", deck: "CIVIC_DISPATCH", title: "Green Roof Rebate", summary: "Receive 60 credits.", effect: { type: "CASH", amount: 60 } },
  { id: "civic-access-upgrade", deck: "CIVIC_DISPATCH", title: "Access Upgrade", summary: "Pay 40 credits for a public access upgrade.", effect: { type: "CASH", amount: -40 } },
];

export type PropertyEmpirePlayerFinance = { cash: number; propertyValue: number; netWorth: number; propertyCount: number };
export type PropertyEmpireSavedGame = SavedGame<PropertyEmpireDomainState, PropertyEmpireAction> & {
  boardVersion: typeof PROPERTY_EMPIRE_BOARD_VERSION;
  configuration: { players: Array<Pick<PropertyEmpirePlayer, "id" | "name" | "kind" | "difficulty">>; rules: PropertyEmpireRuleConfig };
  randomState?: { game: PropertyEmpireRandomSnapshot; bot: PropertyEmpireRandomSnapshot };
  preferences?: { botSpeed: "FAST" | "NORMAL" | "RELAXED" };
};

const MARKERS: PropertyEmpirePlayer["marker"][] = ["V", "K", "A", "N"];
const currentPlayer = (state: PropertyEmpireDomainState) => state.players[state.currentPlayerIndex]!;

export class PropertyEmpireEngine implements GameEngine<PropertyEmpireDomainState, PropertyEmpireAction, PropertyEmpireEvent, PropertyEmpireConfig> {
  constructor(private readonly random: RandomProvider) {}

  createInitialState(config: PropertyEmpireConfig): PropertyEmpireDomainState {
    if (config.players.length < 2 || config.players.length > 4) throw new Error("Property Empire requires 2 to 4 players");
    if (config.players.some((player) => !player.id.trim() || !player.name.trim()) || new Set(config.players.map((player) => player.id)).size !== config.players.length) throw new Error("Property Empire players require unique non-empty ids and names");
    const rules = { startingCash: config.startingCash ?? 600, passSalary: config.passSalary ?? 120, maxTurns: config.maxTurns ?? 80 };
    if (!Number.isInteger(rules.startingCash) || rules.startingCash < 100 || !Number.isInteger(rules.passSalary) || rules.passSalary < 0 || !Number.isInteger(rules.maxTurns) || rules.maxTurns < 1) throw new Error("Invalid Property Empire rule configuration");
    const players = config.players.map((player, index): PropertyEmpirePlayer => ({
      id: player.id,
      name: player.name,
      kind: player.kind ?? "HUMAN",
      difficulty: player.kind === "BOT" ? player.difficulty ?? "NORMAL" : undefined,
      marker: MARKERS[index]!,
      cash: rules.startingCash,
      position: 0,
      inTransitHold: false,
      bankrupt: false,
    }));
    return {
      gameType: PROPERTY_EMPIRE_GAME_TYPE,
      gameVersion: PROPERTY_EMPIRE_GAME_VERSION,
      stateVersion: PROPERTY_EMPIRE_STATE_VERSION,
      boardVersion: PROPERTY_EMPIRE_BOARD_VERSION,
      rules,
      players,
      ownership: PROPERTY_TILES.map((tile) => ({ tileId: tile.id })),
      currentPlayerIndex: 0,
      phase: "ROLL",
      transactions: [],
      eliminatedPlayerIds: [],
      rankings: [],
      turnNumber: 1,
    };
  }

  validateAction(state: PropertyEmpireDomainState, action: PropertyEmpireAction): ValidationResult {
    if (state.phase === "FINISHED") return { valid: false, code: "GAME_OVER", message: "The economic round is finished" };
    if (currentPlayer(state).id !== action.playerId) return { valid: false, code: "NOT_YOUR_TURN", message: "It is not this player's turn" };
    if (currentPlayer(state).bankrupt) return { valid: false, code: "PLAYER_BANKRUPT", message: "This player is no longer active" };
    if (action.type === "ROLL_DICE") return state.phase === "ROLL" ? { valid: true } : { valid: false, code: "ROLL_UNAVAILABLE", message: "Resolve the current action first" };
    if (action.type === "END_TURN") return state.phase === "END_TURN" ? { valid: true } : { valid: false, code: "TURN_NOT_RESOLVED", message: "Resolve the current tile first" };
    if (state.phase !== "PURCHASE_DECISION" || !state.pendingDecision) return { valid: false, code: "NO_PURCHASE_DECISION", message: "No property purchase is pending" };
    if (action.propertyId !== state.pendingDecision.propertyId || action.playerId !== state.pendingDecision.playerId) return { valid: false, code: "STALE_PROPERTY_DECISION", message: "This property decision is stale" };
    const owner = state.ownership.find((entry) => entry.tileId === action.propertyId)?.ownerId;
    if (owner) return { valid: false, code: "PROPERTY_OWNED", message: "This property is already owned" };
    if (action.type === "BUY_PROPERTY") {
      if (currentPlayer(state).cash < state.pendingDecision.price) return { valid: false, code: "INSUFFICIENT_CASH", message: "Not enough cash for this property" };
    }
    return { valid: true };
  }

  reduce(state: PropertyEmpireDomainState, action: PropertyEmpireAction): GameTransition<PropertyEmpireDomainState, PropertyEmpireEvent> {
    const validation = this.validateAction(state, action);
    if (!validation.valid) throw new Error(`${validation.code}: ${validation.message}`);
    if (action.type === "ROLL_DICE") return this.roll(state, action.playerId);
    if (action.type === "BUY_PROPERTY") return this.buy(state, action);
    if (action.type === "DECLINE_PROPERTY") {
      return { state: { ...state, phase: "END_TURN", pendingDecision: undefined }, events: [{ type: "PROPERTY_DECLINED", playerId: action.playerId, propertyId: action.propertyId }] };
    }
    return this.endTurn(state, action.playerId);
  }

  getValidActions(state: PropertyEmpireDomainState, playerId: string): PropertyEmpireAction[] {
    if (state.phase === "FINISHED" || currentPlayer(state).id !== playerId || currentPlayer(state).bankrupt) return [];
    if (state.phase === "ROLL") return [{ type: "ROLL_DICE", playerId }];
    if (state.phase === "END_TURN") return [{ type: "END_TURN", playerId }];
    if (!state.pendingDecision) return [];
    const decline: PropertyEmpireAction = { type: "DECLINE_PROPERTY", playerId, propertyId: state.pendingDecision.propertyId };
    return currentPlayer(state).cash >= state.pendingDecision.price ? [{ type: "BUY_PROPERTY", playerId, propertyId: state.pendingDecision.propertyId }, decline] : [decline];
  }

  getPlayerFinance(state: PropertyEmpireDomainState, playerId: string): PropertyEmpirePlayerFinance {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error("Unknown Property Empire player");
    const ownedIds = state.ownership.filter((entry) => entry.ownerId === playerId).map((entry) => entry.tileId);
    const propertyValue = PROPERTY_TILES.filter((tile) => ownedIds.includes(tile.id)).reduce((total, tile) => total + tile.price, 0);
    return { cash: player.cash, propertyValue, netWorth: player.cash + propertyValue, propertyCount: ownedIds.length };
  }

  getPropertyOwner(state: PropertyEmpireDomainState, tileId: string) { return state.ownership.find((entry) => entry.tileId === tileId)?.ownerId; }
  checkGameOver(state: PropertyEmpireDomainState): GameResult | null { return state.phase === "FINISHED" ? { outcome: "WIN", winnerId: state.rankings[0], rankings: state.rankings } : null; }
  serialize(state: PropertyEmpireDomainState): string { return JSON.stringify(state); }
  deserialize(data: string): PropertyEmpireDomainState { const value: unknown = JSON.parse(data); if (!isPropertyEmpireState(value)) throw new Error("Invalid Property Empire state"); return value; }

  private roll(state: PropertyEmpireDomainState, playerId: string): GameTransition<PropertyEmpireDomainState, PropertyEmpireEvent> {
    const values = [this.random.int(1, 6), this.random.int(1, 6)] as const;
    const events: PropertyEmpireEvent[] = [{ type: "DICE_ROLLED", playerId, values }];
    const player = currentPlayer(state);
    let next: PropertyEmpireDomainState = { ...state, dice: values, lastEventCardId: undefined };
    if (player.inTransitHold && values[0] !== values[1]) {
      next = this.updatePlayer(next, playerId, (candidate) => ({ ...candidate, inTransitHold: false }));
      events.push({ type: "PLAYER_RELEASED_FROM_TRANSIT_HOLD", playerId, reason: "SERVED" });
      return { state: { ...next, phase: "END_TURN" }, events };
    }
    if (player.inTransitHold) {
      next = this.updatePlayer(next, playerId, (candidate) => ({ ...candidate, inTransitHold: false }));
      events.push({ type: "PLAYER_RELEASED_FROM_TRANSIT_HOLD", playerId, reason: "DOUBLES" });
    }
    const total = values[0] + values[1];
    const from = player.position;
    const passedOrigin = from + total >= PROPERTY_EMPIRE_BOARD.length;
    const destination = (from + total) % PROPERTY_EMPIRE_BOARD.length;
    const pathTileIds = Array.from({ length: total }, (_, offset) => PROPERTY_EMPIRE_BOARD[(from + offset + 1) % PROPERTY_EMPIRE_BOARD.length]!.id);
    if (passedOrigin) {
      next = this.updatePlayer(next, playerId, (candidate) => ({ ...candidate, cash: candidate.cash + state.rules.passSalary }));
      next = this.addTransaction(next, { type: "SALARY", playerId, tileId: PROPERTY_EMPIRE_BOARD[0]!.id, amount: state.rules.passSalary, summary: `Passed Founders' Gate and received ${state.rules.passSalary} credits.` });
      events.push({ type: "PASSED_FOUNDERS_GATE", playerId, amount: state.rules.passSalary });
    }
    next = this.updatePlayer(next, playerId, (candidate) => ({ ...candidate, position: destination }));
    events.push({ type: "TOKEN_MOVED", playerId, fromTileId: PROPERTY_EMPIRE_BOARD[from]!.id, toTileId: PROPERTY_EMPIRE_BOARD[destination]!.id, pathTileIds });
    return this.resolveLanding(next, playerId, events);
  }

  private resolveLanding(state: PropertyEmpireDomainState, playerId: string, events: PropertyEmpireEvent[]): GameTransition<PropertyEmpireDomainState, PropertyEmpireEvent> {
    const player = state.players.find((candidate) => candidate.id === playerId)!;
    const tile = PROPERTY_EMPIRE_BOARD[player.position]!;
    if (tile.type === "PROPERTY") {
      const ownerId = this.getPropertyOwner(state, tile.id);
      if (!ownerId && player.cash >= tile.price) {
        const pendingDecision: PendingPurchaseDecision = { type: "PURCHASE", playerId, propertyId: tile.id, price: tile.price, currentCash: player.cash, projectedCash: player.cash - tile.price };
        events.push({ type: "PROPERTY_OFFERED", playerId, propertyId: tile.id, price: tile.price, projectedCash: pendingDecision.projectedCash });
        return { state: { ...state, phase: "PURCHASE_DECISION", pendingDecision }, events };
      }
      if (!ownerId) {
        events.push({ type: "PROPERTY_UNAFFORDABLE", playerId, propertyId: tile.id, price: tile.price });
        return { state: { ...state, phase: "END_TURN" }, events };
      }
      if (ownerId !== playerId) return this.pay(state, playerId, tile.baseRent, events, "RENT", tile, ownerId);
      return { state: { ...state, phase: "END_TURN" }, events };
    }
    if (tile.type === "TAX") return this.pay(state, playerId, tile.amount, events, "TAX", tile);
    if (tile.type === "EVENT") return this.resolveEvent(state, playerId, tile.deck, events);
    return { state: { ...state, phase: "END_TURN" }, events };
  }

  private buy(state: PropertyEmpireDomainState, action: Extract<PropertyEmpireAction, { type: "BUY_PROPERTY" }>): GameTransition<PropertyEmpireDomainState, PropertyEmpireEvent> {
    const decision = state.pendingDecision!;
    const tile = getPropertyEmpireTile(action.propertyId) as PropertyTile;
    let next = this.updatePlayer(state, action.playerId, (player) => ({ ...player, cash: player.cash - decision.price }));
    next = { ...next, ownership: next.ownership.map((entry) => entry.tileId === action.propertyId ? { ...entry, ownerId: action.playerId } : { ...entry }) };
    next = this.addTransaction(next, { type: "PURCHASE", playerId: action.playerId, tileId: action.propertyId, amount: -decision.price, summary: `Purchased ${tile.name} for ${decision.price} credits.` });
    return { state: { ...next, phase: "END_TURN", pendingDecision: undefined }, events: [{ type: "PROPERTY_PURCHASED", playerId: action.playerId, propertyId: action.propertyId, price: decision.price }] };
  }

  private pay(state: PropertyEmpireDomainState, playerId: string, amountDue: number, events: PropertyEmpireEvent[], type: "RENT" | "TAX", tile: PropertyTile | Extract<(typeof PROPERTY_EMPIRE_BOARD)[number], { type: "TAX" }>, recipientId?: string): GameTransition<PropertyEmpireDomainState, PropertyEmpireEvent> {
    const payer = state.players.find((player) => player.id === playerId)!;
    const amountPaid = Math.min(payer.cash, amountDue);
    let next = this.updatePlayer(state, playerId, (player) => ({ ...player, cash: player.cash - amountPaid }));
    if (recipientId) next = this.updatePlayer(next, recipientId, (player) => ({ ...player, cash: player.cash + amountPaid }));
    next = this.addTransaction(next, { type, playerId, counterpartyId: recipientId, tileId: tile.id, amount: -amountPaid, summary: type === "RENT" ? `Paid ${amountPaid} credits rent at ${tile.name}.` : `Paid ${amountPaid} credits to ${tile.name}.` });
    if (type === "RENT") events.push({ type: "RENT_PAID", fromPlayerId: playerId, toPlayerId: recipientId!, propertyId: tile.id, amountDue, amountPaid });
    else events.push({ type: "TAX_PAID", playerId, tileId: tile.id, amountDue, amountPaid });
    if (amountPaid < amountDue) return this.bankrupt(next, playerId, amountDue, amountPaid, events);
    return { state: { ...next, phase: "END_TURN" }, events };
  }

  private resolveEvent(state: PropertyEmpireDomainState, playerId: string, deck: EventCard["deck"], events: PropertyEmpireEvent[]): GameTransition<PropertyEmpireDomainState, PropertyEmpireEvent> {
    const card = this.random.pick(PROPERTY_EMPIRE_EVENT_CARDS.filter((candidate) => candidate.deck === deck));
    events.push({ type: "EVENT_CARD_DRAWN", playerId, cardId: card.id, title: card.title, summary: card.summary });
    let next: PropertyEmpireDomainState = { ...state, lastEventCardId: card.id };
    if (card.effect.type === "TRANSIT_HOLD") {
      next = this.updatePlayer(next, playerId, (player) => ({ ...player, position: TRANSIT_HOLD_INDEX, inTransitHold: true }));
      events.push({ type: "PLAYER_SENT_TO_TRANSIT_HOLD", playerId, source: "EVENT" });
      return { state: { ...next, phase: "END_TURN" }, events };
    }
    const eventAmount = card.effect.amount;
    if (eventAmount >= 0) {
      next = this.updatePlayer(next, playerId, (player) => ({ ...player, cash: player.cash + eventAmount }));
      next = this.addTransaction(next, { type: "EVENT", playerId, amount: eventAmount, summary: `${card.title}: received ${eventAmount} credits.` });
      events.push({ type: "CASH_CHANGED", playerId, amount: eventAmount, balance: next.players.find((player) => player.id === playerId)!.cash, reason: card.title });
      return { state: { ...next, phase: "END_TURN" }, events };
    }
    const amountDue = Math.abs(eventAmount);
    const payer = next.players.find((player) => player.id === playerId)!;
    const amountPaid = Math.min(payer.cash, amountDue);
    next = this.updatePlayer(next, playerId, (player) => ({ ...player, cash: player.cash - amountPaid }));
    next = this.addTransaction(next, { type: "EVENT", playerId, amount: -amountPaid, summary: `${card.title}: paid ${amountPaid} credits.` });
    events.push({ type: "CASH_CHANGED", playerId, amount: -amountPaid, balance: next.players.find((player) => player.id === playerId)!.cash, reason: card.title });
    if (amountPaid < amountDue) return this.bankrupt(next, playerId, amountDue, amountPaid, events);
    return { state: { ...next, phase: "END_TURN" }, events };
  }

  private bankrupt(state: PropertyEmpireDomainState, playerId: string, amountDue: number, amountPaid: number, events: PropertyEmpireEvent[]): GameTransition<PropertyEmpireDomainState, PropertyEmpireEvent> {
    const releasedPropertyIds = state.ownership.filter((entry) => entry.ownerId === playerId).map((entry) => entry.tileId);
    let next = this.updatePlayer(state, playerId, (player) => ({ ...player, cash: 0, bankrupt: true, inTransitHold: false }));
    next = { ...next, ownership: next.ownership.map((entry) => entry.ownerId === playerId ? { tileId: entry.tileId } : { ...entry }), eliminatedPlayerIds: [...next.eliminatedPlayerIds, playerId] };
    next = this.addTransaction(next, { type: "BANKRUPTCY", playerId, amount: 0, summary: `Could not cover ${amountDue - amountPaid} credits; ${releasedPropertyIds.length} sites returned to the city.` });
    events.push({ type: "PLAYER_BANKRUPT", playerId, amountDue, amountPaid, releasedPropertyIds });
    const finished = this.finishForLastSolvent(next, events);
    if (finished) return finished;
    const advanced = this.endTurn(next, playerId);
    return { state: advanced.state, events: [...events, ...advanced.events] };
  }

  private endTurn(state: PropertyEmpireDomainState, playerId: string): GameTransition<PropertyEmpireDomainState, PropertyEmpireEvent> {
    if (state.turnNumber >= state.rules.maxTurns) {
      const rankings = this.rankByNetWorth(state);
      return { state: { ...state, phase: "FINISHED", dice: undefined, rankings }, events: [{ type: "GAME_FINISHED", rankings, reason: "TURN_LIMIT" }] };
    }
    const nextIndex = this.nextSolventPlayerIndex(state);
    const nextPlayer = state.players[nextIndex]!;
    return {
      state: { ...state, currentPlayerIndex: nextIndex, phase: "ROLL", dice: undefined, pendingDecision: undefined, lastEventCardId: undefined, turnNumber: state.turnNumber + 1 },
      events: [{ type: "TURN_CHANGED", previousPlayerId: playerId, currentPlayerId: nextPlayer.id }],
    };
  }

  private finishForLastSolvent(state: PropertyEmpireDomainState, events: PropertyEmpireEvent[]) {
    const solvent = state.players.filter((player) => !player.bankrupt);
    if (solvent.length !== 1) return undefined;
    const rankings = [solvent[0]!.id, ...[...state.eliminatedPlayerIds].reverse()];
    events.push({ type: "GAME_FINISHED", rankings, reason: "LAST_SOLVENT" });
    return { state: { ...state, phase: "FINISHED" as const, dice: undefined, pendingDecision: undefined, rankings }, events };
  }

  private rankByNetWorth(state: PropertyEmpireDomainState) {
    return state.players.map((player, index) => ({ player, index, finance: this.getPlayerFinance(state, player.id) })).sort((left, right) => Number(left.player.bankrupt) - Number(right.player.bankrupt) || right.finance.netWorth - left.finance.netWorth || right.finance.cash - left.finance.cash || left.index - right.index).map((entry) => entry.player.id);
  }

  private nextSolventPlayerIndex(state: PropertyEmpireDomainState) {
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const index = (state.currentPlayerIndex + offset) % state.players.length;
      if (!state.players[index]!.bankrupt) return index;
    }
    return state.currentPlayerIndex;
  }

  private updatePlayer(state: PropertyEmpireDomainState, playerId: string, update: (player: PropertyEmpirePlayer) => PropertyEmpirePlayer): PropertyEmpireDomainState {
    return { ...state, players: state.players.map((player) => player.id === playerId ? update({ ...player }) : { ...player }) };
  }

  private addTransaction(state: PropertyEmpireDomainState, transaction: Omit<PropertyEmpireTransaction, "id" | "turnNumber" | "balanceAfter">): PropertyEmpireDomainState {
    const player = state.players.find((candidate) => candidate.id === transaction.playerId)!;
    const committed: PropertyEmpireTransaction = { ...transaction, id: `tx-${state.turnNumber}-${state.transactions.length + 1}`, turnNumber: state.turnNumber, balanceAfter: player.cash };
    return { ...state, transactions: [...state.transactions, committed] };
  }
}

const isPropertyEmpireState = (value: unknown): value is PropertyEmpireDomainState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PropertyEmpireDomainState>;
  if (state.gameType !== PROPERTY_EMPIRE_GAME_TYPE || state.gameVersion !== PROPERTY_EMPIRE_GAME_VERSION || state.stateVersion !== PROPERTY_EMPIRE_STATE_VERSION || state.boardVersion !== PROPERTY_EMPIRE_BOARD_VERSION) return false;
  if (!state.rules || !Number.isInteger(state.rules.startingCash) || state.rules.startingCash < 100 || !Number.isInteger(state.rules.passSalary) || state.rules.passSalary < 0 || !Number.isInteger(state.rules.maxTurns) || state.rules.maxTurns < 1) return false;
  if (!Array.isArray(state.players) || state.players.length < 2 || state.players.length > 4) return false;
  const playerIds = state.players.map((player) => player.id);
  if (new Set(playerIds).size !== playerIds.length || !state.players.every((player) => typeof player.id === "string" && player.id.length > 0 && typeof player.name === "string" && player.name.length > 0 && (player.kind === "HUMAN" || player.kind === "BOT") && (player.kind === "BOT" ? player.difficulty === "EASY" || player.difficulty === "NORMAL" || player.difficulty === "HARD" : player.difficulty === undefined) && MARKERS.includes(player.marker) && Number.isInteger(player.cash) && player.cash >= 0 && Number.isInteger(player.position) && player.position >= 0 && player.position < PROPERTY_EMPIRE_BOARD.length && typeof player.inTransitHold === "boolean" && (!player.inTransitHold || player.position === TRANSIT_HOLD_INDEX) && typeof player.bankrupt === "boolean" && (!player.bankrupt || player.cash === 0))) return false;
  if (new Set(state.players.map((player) => player.marker)).size !== state.players.length) return false;
  const bankruptIds = state.players.filter((player) => player.bankrupt).map((player) => player.id);
  if (!Array.isArray(state.ownership) || state.ownership.length !== PROPERTY_TILES.length || !state.ownership.every((entry) => PROPERTY_TILES.some((tile) => tile.id === entry.tileId) && (entry.ownerId === undefined || playerIds.includes(entry.ownerId)) && !bankruptIds.includes(entry.ownerId ?? ""))) return false;
  if (new Set(state.ownership.map((entry) => entry.tileId)).size !== PROPERTY_TILES.length) return false;
  if (!Number.isInteger(state.currentPlayerIndex) || state.currentPlayerIndex! < 0 || state.currentPlayerIndex! >= state.players.length) return false;
  if (state.phase !== "ROLL" && state.phase !== "PURCHASE_DECISION" && state.phase !== "END_TURN" && state.phase !== "FINISHED") return false;
  if (state.dice !== undefined && (!Array.isArray(state.dice) || state.dice.length !== 2 || !state.dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6))) return false;
  if (state.phase === "ROLL" || state.phase === "FINISHED" ? state.dice !== undefined : state.dice === undefined) return false;
  if (state.phase === "PURCHASE_DECISION") {
    const decision = state.pendingDecision;
    const property = decision && PROPERTY_TILES.find((tile) => tile.id === decision.propertyId);
    const active = state.players[state.currentPlayerIndex!];
    if (!decision || !property || decision.playerId !== active?.id || decision.price !== property.price || decision.currentCash !== active.cash || decision.projectedCash !== active.cash - property.price || state.ownership.find((entry) => entry.tileId === property.id)?.ownerId !== undefined) return false;
  } else if (state.pendingDecision !== undefined) return false;
  if (state.lastEventCardId !== undefined && !PROPERTY_EMPIRE_EVENT_CARDS.some((card) => card.id === state.lastEventCardId)) return false;
  if (!Array.isArray(state.transactions) || !state.transactions.every((transaction) => typeof transaction.id === "string" && Number.isInteger(transaction.turnNumber) && transaction.turnNumber >= 1 && playerIds.includes(transaction.playerId) && Number.isInteger(transaction.amount) && Number.isInteger(transaction.balanceAfter) && typeof transaction.summary === "string")) return false;
  if (!Array.isArray(state.eliminatedPlayerIds) || !Array.isArray(state.rankings) || new Set(state.eliminatedPlayerIds).size !== state.eliminatedPlayerIds.length || new Set(state.rankings).size !== state.rankings.length) return false;
  if (state.eliminatedPlayerIds.length !== bankruptIds.length || !state.eliminatedPlayerIds.every((id) => bankruptIds.includes(id)) || !state.rankings.every((id) => playerIds.includes(id))) return false;
  if (state.phase === "FINISHED" ? state.rankings.length !== state.players.length : state.rankings.length !== 0 || state.players[state.currentPlayerIndex!]!.bankrupt) return false;
  return Number.isInteger(state.turnNumber) && state.turnNumber! >= 1;
};

export const replayPropertyEmpire = (engine: PropertyEmpireEngine, replay: GameReplay<PropertyEmpireDomainState, PropertyEmpireAction>) => replay.actions.reduce((state, entry) => engine.reduce(state, entry.action).state, replay.initialState);

export const createPropertyEmpireSavedGame = (
  engine: PropertyEmpireEngine,
  id: string,
  state: PropertyEmpireDomainState,
  actionHistory: SavedGame<PropertyEmpireDomainState, PropertyEmpireAction>["actionHistory"],
  now = new Date().toISOString(),
  extras: Pick<PropertyEmpireSavedGame, "randomState" | "preferences"> = {},
): PropertyEmpireSavedGame => ({
  id,
  gameType: PROPERTY_EMPIRE_GAME_TYPE,
  gameVersion: PROPERTY_EMPIRE_GAME_VERSION,
  stateVersion: PROPERTY_EMPIRE_STATE_VERSION,
  boardVersion: PROPERTY_EMPIRE_BOARD_VERSION,
  serializedState: engine.serialize(state),
  actionHistory,
  createdAt: now,
  updatedAt: now,
  configuration: { players: state.players.map(({ id: playerId, name, kind, difficulty }) => ({ id: playerId, name, kind, difficulty })), rules: { ...state.rules } },
  ...extras,
});
