export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type ValidationResult = { valid: true } | { valid: false; code: string; message: string };
export type GameResult = { winnerId?: string; outcome: "WIN" | "DRAW" | "ABANDONED"; rankings?: string[] };
export type GameTransition<TState, TEvent> = { state: TState; events: TEvent[] };
export type Player = { id: string; name: string; kind: "HUMAN" | "BOT" };
export type BotPlayer = Player & { kind: "BOT"; difficulty: BotDifficulty; personality: BotPersonality };
export type HumanPlayer = Player & { kind: "HUMAN" };
export type Turn = { playerId: string; number: number; direction?: 1 | -1 };
export type RandomProvider = { next(): number; int(min: number, max: number): number; pick<T>(items: readonly T[]): T };
export type ActionHistory<TAction> = { sequence: number; action: TAction; timestamp: string }[];
export type GameReplay<TState, TAction> = { gameType: string; gameVersion: string; initialState: TState; actions: ActionHistory<TAction>; seed?: string };
export type SavedGame<TState, TAction> = { id: string; gameType: string; gameVersion: string; stateVersion: number; serializedState: string; actionHistory: ActionHistory<TAction>; createdAt: string; updatedAt: string };
export type BotDifficulty = "EASY" | "NORMAL" | "HARD" | "EXPERT";
export type BotPersonality = "RANDOM" | "PASSIVE" | "BALANCED" | "AGGRESSIVE" | "DEFENSIVE";

export interface GameEngine<TState, TAction, TEvent, TRuleConfig> {
  createInitialState(config: TRuleConfig): TState;
  validateAction(state: TState, action: TAction): ValidationResult;
  reduce(state: TState, action: TAction): GameTransition<TState, TEvent>;
  getValidActions(state: TState, playerId: string): TAction[];
  checkGameOver(state: TState): GameResult | null;
  serialize(state: TState): string;
  deserialize(data: string): TState;
}

export interface GameBot<TState, TAction> { chooseAction(state: TState, playerId: string): TAction; }

export class MathRandomProvider implements RandomProvider {
  next(): number { return Math.random(); }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(items: readonly T[]): T { if (items.length === 0) throw new Error("Cannot pick from an empty list"); return items[this.int(0, items.length - 1)]!; }
}

export class SeededRandomProvider implements RandomProvider {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number { this.state = (1664525 * this.state + 1013904223) >>> 0; return this.state / 4294967296; }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(items: readonly T[]): T { if (items.length === 0) throw new Error("Cannot pick from an empty list"); return items[this.int(0, items.length - 1)]!; }
}

export class MockRandomProvider implements RandomProvider {
  private index = 0;
  constructor(private readonly values: readonly number[]) {}
  next(): number { if (this.values.length === 0) throw new Error("Mock random values are empty"); const value = this.values[this.index++ % this.values.length]!; return Math.max(0, Math.min(0.999999999, value)); }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(items: readonly T[]): T { if (items.length === 0) throw new Error("Cannot pick from an empty list"); return items[this.int(0, items.length - 1)]!; }
}
