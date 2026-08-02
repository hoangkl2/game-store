import type { GameEngine, GameReplay, GameResult, GameTransition, RandomProvider, SavedGame, ValidationResult } from "@game-store/game-core";

export const UNO_GAME_TYPE = "UNO" as const;
export const UNO_GAME_VERSION = "1.0.0" as const;
export const UNO_STATE_VERSION = 1 as const;

export type UnoColor = "RED" | "YELLOW" | "GREEN" | "BLUE" | "WILD";
export type UnoCardType = "NUMBER" | "SKIP" | "REVERSE" | "DRAW_TWO" | "WILD" | "WILD_DRAW_FOUR";
export type UnoCard = { id: string; color: UnoColor; type: UnoCardType; number?: number };
export type UnoPlayer = { id: string; name: string; kind: "HUMAN" | "BOT"; hand: UnoCard[] };
export type UnoPhase = "ACTIVE" | "FINISHED";
export type UnoRuleConfig = { players: ReadonlyArray<{ id: string; name: string; kind?: "HUMAN" | "BOT" }>; cardsPerPlayer?: number; allowWildDrawFourAnytime?: boolean };
export type UnoGameState = { gameType: typeof UNO_GAME_TYPE; gameVersion: typeof UNO_GAME_VERSION; stateVersion: typeof UNO_STATE_VERSION; players: UnoPlayer[]; drawPile: UnoCard[]; discardPile: UnoCard[]; currentColor: UnoColor; currentPlayerIndex: number; direction: 1 | -1; phase: UnoPhase; hasDrawnThisTurn: boolean; drawnCardId?: string; winnerId?: string; turnNumber: number };
export type UnoAction =
  | { type: "PLAY_CARD"; playerId: string; cardId: string; chosenColor?: Exclude<UnoColor, "WILD"> }
  | { type: "DRAW_CARD"; playerId: string }
  | { type: "PASS_TURN"; playerId: string };
export type UnoEvent =
  | { type: "CARD_PLAYED"; playerId: string; card: UnoCard; chosenColor?: Exclude<UnoColor, "WILD"> }
  | { type: "CARD_DRAWN"; playerId: string; cardId: string }
  | { type: "PENALTY_DRAWN"; playerId: string; amount: number; cardIds: string[] }
  | { type: "TURN_CHANGED"; playerId: string }
  | { type: "GAME_WON"; playerId: string };

const COLORS: Exclude<UnoColor, "WILD">[] = ["RED", "YELLOW", "GREEN", "BLUE"];
const ACTION_TYPES: UnoCardType[] = ["SKIP", "REVERSE", "DRAW_TWO"];

export function createUnoDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  for (const color of COLORS) {
    cards.push({ id: `${color}-0`, color, type: "NUMBER", number: 0 });
    for (let n = 1; n <= 9; n++) for (let copy = 0; copy < 2; copy++) cards.push({ id: `${color}-${n}-${copy}`, color, type: "NUMBER", number: n });
    for (const type of ACTION_TYPES) for (let copy = 0; copy < 2; copy++) cards.push({ id: `${color}-${type}-${copy}`, color, type });
  }
  for (let copy = 0; copy < 4; copy++) {
    cards.push({ id: `WILD-${copy}`, color: "WILD", type: "WILD" });
    cards.push({ id: `WILD_DRAW_FOUR-${copy}`, color: "WILD", type: "WILD_DRAW_FOUR" });
  }
  return cards;
}

export function shuffle<T>(items: readonly T[], random: RandomProvider): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = random.int(0, i); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}
export function isUnoCardPlayable(card: UnoCard, state: UnoGameState): boolean { return cardMatches(card, state); }

function nextIndex(state: UnoGameState, from = state.currentPlayerIndex, steps = 1): number {
  const count = state.players.length;
  return ((from + state.direction * steps) % count + count) % count;
}
function lastCard(cards: UnoCard[]): UnoCard { return cards[cards.length - 1]!; }
function currentPlayer(state: UnoGameState): UnoPlayer { return state.players[state.currentPlayerIndex]!; }
function cardMatches(card: UnoCard, state: UnoGameState): boolean { const top = lastCard(state.discardPile); return card.color === "WILD" || card.color === state.currentColor || (card.type === "NUMBER" && top.type === "NUMBER" && card.number === top.number) || (card.type !== "NUMBER" && card.type !== "WILD" && card.type !== "WILD_DRAW_FOUR" && card.type === top.type); }
function withTurn(state: UnoGameState, index: number): UnoGameState { return { ...state, currentPlayerIndex: index, hasDrawnThisTurn: false, drawnCardId: undefined, turnNumber: state.turnNumber + 1 }; }

export class UnoEngine implements GameEngine<UnoGameState, UnoAction, UnoEvent, UnoRuleConfig> {
  constructor(private readonly random: RandomProvider) {}

  createInitialState(config: UnoRuleConfig): UnoGameState {
    if (config.players.length < 2 || config.players.length > 4) throw new Error("UNO requires 2 to 4 players");
    const cardsPerPlayer = config.cardsPerPlayer ?? 7;
    if (cardsPerPlayer < 1) throw new Error("cardsPerPlayer must be positive");
    if (cardsPerPlayer * config.players.length + 1 > 108) throw new Error("Not enough cards for the configured deal");
    let deck = shuffle(createUnoDeck(), this.random);
    const players: UnoPlayer[] = config.players.map((player) => ({ ...player, kind: player.kind ?? "HUMAN", hand: [] }));
    for (let i = 0; i < cardsPerPlayer; i++) for (const player of players) player.hand.push(deck.shift()!);
    while (deck[0]?.color === "WILD" || deck[0]?.type !== "NUMBER") deck = [...deck.slice(1), deck[0]!];
    const first = deck.shift()!;
    return { gameType: UNO_GAME_TYPE, gameVersion: UNO_GAME_VERSION, stateVersion: UNO_STATE_VERSION, players, drawPile: deck, discardPile: [first], currentColor: first.color as Exclude<UnoColor, "WILD">, currentPlayerIndex: 0, direction: 1, phase: "ACTIVE", hasDrawnThisTurn: false, turnNumber: 0 };
  }

  validateAction(state: UnoGameState, action: UnoAction): ValidationResult {
    if (state.phase !== "ACTIVE") return { valid: false, code: "GAME_OVER", message: "The game is already over" };
    const player = currentPlayer(state);
    if (action.playerId !== player.id) return { valid: false, code: "NOT_YOUR_TURN", message: "It is not this player's turn" };
    if (action.type === "DRAW_CARD") return state.hasDrawnThisTurn ? { valid: false, code: "ALREADY_DREW", message: "A card was already drawn this turn" } : { valid: true };
    if (action.type === "PASS_TURN") return state.hasDrawnThisTurn ? { valid: true } : { valid: false, code: "MUST_DRAW", message: "Draw before passing" };
    const card = player.hand.find((item) => item.id === action.cardId);
    if (!card) return { valid: false, code: "CARD_NOT_IN_HAND", message: "The card is not in this hand" };
    if (state.hasDrawnThisTurn && state.drawnCardId !== card.id) return { valid: false, code: "ONLY_DRAWN_CARD", message: "Only the card drawn this turn may be played" };
    if (!cardMatches(card, state)) return { valid: false, code: "CARD_NOT_PLAYABLE", message: "The card does not match the current color or discard" };
    if ((card.type === "WILD" || card.type === "WILD_DRAW_FOUR") && !action.chosenColor) return { valid: false, code: "COLOR_REQUIRED", message: "Choose a color for a wild card" };
    if (action.chosenColor && card.color !== "WILD") return { valid: false, code: "COLOR_NOT_ALLOWED", message: "Only wild cards may choose a color" };
    return { valid: true };
  }

  reduce(state: UnoGameState, action: UnoAction): GameTransition<UnoGameState, UnoEvent> {
    const validation = this.validateAction(state, action);
    if (!validation.valid) throw new Error(`${validation.code}: ${validation.message}`);
    if (action.type === "DRAW_CARD") {
      let drawPile = [...state.drawPile]; let discardPile = [...state.discardPile];
      if (drawPile.length === 0 && discardPile.length > 1) { drawPile = shuffle(discardPile.slice(0, -1), this.random); discardPile = [lastCard(discardPile)]; }
      if (drawPile.length === 0) return { state: { ...state, hasDrawnThisTurn: true, drawnCardId: undefined }, events: [] };
      const card = drawPile.shift()!; const players = state.players.map((p) => p.id === action.playerId ? { ...p, hand: [...p.hand, card] } : { ...p, hand: [...p.hand] });
      return { state: { ...state, players, drawPile, discardPile, hasDrawnThisTurn: true, drawnCardId: card.id }, events: [{ type: "CARD_DRAWN", playerId: action.playerId, cardId: card.id }] };
    }
    if (action.type === "PASS_TURN") { const next = withTurn(state, nextIndex(state)); return { state: next, events: [{ type: "TURN_CHANGED", playerId: currentPlayer(next).id }] }; }
    const card = currentPlayer(state).hand.find((item) => item.id === action.cardId)!;
    let drawPile = [...state.drawPile]; let discardPile = [...state.discardPile, card];
    const players = state.players.map((p) => p.id === action.playerId ? { ...p, hand: p.hand.filter((item) => item.id !== card.id) } : { ...p, hand: [...p.hand] });
    const playedPlayer = players.find((p) => p.id === action.playerId)!;
    const playedColor = card.color === "WILD" ? action.chosenColor! : card.color;
    if (playedPlayer.hand.length === 0) return { state: { ...state, players, discardPile, currentColor: playedColor, phase: "FINISHED", winnerId: action.playerId, hasDrawnThisTurn: false, drawnCardId: undefined }, events: [{ type: "CARD_PLAYED", playerId: action.playerId, card, chosenColor: action.chosenColor }, { type: "GAME_WON", playerId: action.playerId }] };
    let steps = card.type === "SKIP" ? 2 : card.type === "REVERSE" ? (state.players.length === 2 ? 2 : 1) : 1;
    const events: UnoEvent[] = [{ type: "CARD_PLAYED", playerId: action.playerId, card, chosenColor: action.chosenColor }];
    let nextState: UnoGameState = { ...state, players, drawPile, discardPile, currentColor: playedColor, direction: card.type === "REVERSE" ? (state.direction === 1 ? -1 : 1) : state.direction, hasDrawnThisTurn: false, drawnCardId: undefined };
    if (card.type === "DRAW_TWO" || card.type === "WILD_DRAW_FOUR") {
      const amount = card.type === "DRAW_TWO" ? 2 : 4; const targetIndex = nextIndex(nextState); const ids: string[] = [];
      for (let i = 0; i < amount; i++) { if (drawPile.length === 0 && discardPile.length > 1) { drawPile = shuffle(discardPile.slice(0, -1), this.random); discardPile = [lastCard(discardPile)]; } if (drawPile.length === 0) break; const penalty = drawPile.shift()!; ids.push(penalty.id); players[targetIndex] = { ...players[targetIndex]!, hand: [...players[targetIndex]!.hand, penalty] }; }
      nextState = { ...nextState, players, drawPile, discardPile }; events.push({ type: "PENALTY_DRAWN", playerId: players[targetIndex]!.id, amount: ids.length, cardIds: ids }); steps = 2;
    }
    nextState = withTurn(nextState, nextIndex(nextState, state.currentPlayerIndex, steps));
    events.push({ type: "TURN_CHANGED", playerId: currentPlayer(nextState).id });
    return { state: nextState, events };
  }

  getValidActions(state: UnoGameState, playerId: string): UnoAction[] {
    if (state.phase !== "ACTIVE" || currentPlayer(state).id !== playerId) return [];
    const candidateCards = currentPlayer(state).hand.filter((card) => cardMatches(card, state) && (!state.hasDrawnThisTurn || card.id === state.drawnCardId));
    const actions: UnoAction[] = candidateCards.flatMap((card) => card.color === "WILD" ? COLORS.map((chosenColor) => ({ type: "PLAY_CARD", playerId, cardId: card.id, chosenColor } as UnoAction)) : [{ type: "PLAY_CARD", playerId, cardId: card.id }]);
    if (!state.hasDrawnThisTurn) actions.push({ type: "DRAW_CARD", playerId }); else actions.push({ type: "PASS_TURN", playerId });
    return actions;
  }

  checkGameOver(state: UnoGameState): GameResult | null { return state.phase === "FINISHED" ? { outcome: "WIN", winnerId: state.winnerId } : null; }
  serialize(state: UnoGameState): string { return JSON.stringify(state); }
  deserialize(data: string): UnoGameState { const parsed: unknown = JSON.parse(data); if (!isUnoState(parsed)) throw new Error("Invalid UNO state"); return parsed; }
}

function isUnoState(value: unknown): value is UnoGameState { const state = value as UnoGameState; return !!state && typeof state === "object" && state.gameType === UNO_GAME_TYPE && state.stateVersion === UNO_STATE_VERSION && Array.isArray(state.players) && Array.isArray(state.drawPile) && Array.isArray(state.discardPile) && state.discardPile.length > 0; }

export function replayUno(engine: UnoEngine, replay: GameReplay<UnoGameState, UnoAction>): UnoGameState { return replay.actions.reduce((state, entry) => engine.reduce(state, entry.action).state, replay.initialState); }
export function createUnoSavedGame(engine: UnoEngine, id: string, state: UnoGameState, actionHistory: SavedGame<UnoGameState, UnoAction>["actionHistory"], now = new Date().toISOString()): SavedGame<UnoGameState, UnoAction> { return { id, gameType: UNO_GAME_TYPE, gameVersion: UNO_GAME_VERSION, stateVersion: UNO_STATE_VERSION, serializedState: engine.serialize(state), actionHistory, createdAt: now, updatedAt: now }; }
