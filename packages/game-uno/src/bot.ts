import type { BotDifficulty, GameBot, RandomProvider } from "@game-store/game-core";
import type { UnoAction, UnoCard, UnoGameState } from "./engine";
import { UnoEngine } from "./engine";

export type UnoBotDifficulty = Extract<BotDifficulty, "EASY" | "NORMAL" | "HARD">;
function playableCard(action: UnoAction, state: UnoGameState): UnoCard | undefined { return action.type === "PLAY_CARD" ? state.players.find((p) => p.id === action.playerId)?.hand.find((c) => c.id === action.cardId) : undefined; }
function score(action: UnoAction, state: UnoGameState, difficulty: UnoBotDifficulty): number {
  if (action.type === "DRAW_CARD") return difficulty === "EASY" ? 0 : -15;
  if (action.type === "PASS_TURN") return -20;
  const card = playableCard(action, state)!; const own = state.players.find((p) => p.id === action.playerId)!;
  let value = card.type === "NUMBER" ? 10 : card.type === "SKIP" || card.type === "REVERSE" ? 25 : card.type === "DRAW_TWO" ? 35 : card.type === "WILD" ? 20 : 45;
  if (own.hand.length <= 2) value += 80;
  if (difficulty !== "EASY" && card.color !== "WILD") value += own.hand.filter((c) => c.color === card.color).length * 3;
  if (difficulty === "HARD") { const opponent = state.players.filter((p) => p.id !== action.playerId).sort((a, b) => a.hand.length - b.hand.length)[0]; if (opponent && opponent.hand.length <= 2 && ["SKIP", "DRAW_TWO", "WILD_DRAW_FOUR"].includes(card.type)) value += 35; if (card.type === "WILD_DRAW_FOUR") value -= 8; }
  return value;
}

export class UnoBot implements GameBot<UnoGameState, UnoAction> {
  constructor(private readonly engine: UnoEngine, private readonly random: RandomProvider, private readonly difficulty: UnoBotDifficulty = "NORMAL") {}
  chooseAction(state: UnoGameState, playerId: string): UnoAction {
    const actions = this.engine.getValidActions(state, playerId); if (actions.length === 0) throw new Error("No valid UNO action");
    if (this.difficulty === "EASY") return this.random.pick(actions);
    const ranked = actions.map((action) => ({ action, value: score(action, state, this.difficulty) })).sort((a, b) => b.value - a.value);
    const top = ranked.filter((item) => item.value === ranked[0]!.value).map((item) => item.action); return this.random.pick(top);
  }
}
