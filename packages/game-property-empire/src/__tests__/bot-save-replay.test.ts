import { describe, expect, it } from "vitest";
import { MockRandomProvider, type GameReplay } from "@game-store/game-core";
import { PropertyEmpireBot } from "../bot";
import { createPropertyEmpireSavedGame, PropertyEmpireEngine, replayPropertyEmpire, type PropertyEmpireAction, type PropertyEmpireDomainState } from "../engine";
import { PropertyEmpireSeededRandomProvider } from "../random";
import { deserializePropertyEmpireSavedGame } from "../storage";

const players = [{ id: "p1", name: "One" }, { id: "p2", name: "Two", kind: "BOT" as const, difficulty: "HARD" as const }];

describe("Property Empire bots, replay, and persistence", () => {
  it("all bot difficulties return legal engine actions", () => {
    for (const difficulty of ["EASY", "NORMAL", "HARD"] as const) {
      const engine = new PropertyEmpireEngine(new MockRandomProvider([0]));
      const state = engine.createInitialState({ players: [{ id: "p1", name: "One", kind: "BOT", difficulty }, { id: "p2", name: "Two" }] });
      const action = new PropertyEmpireBot(engine, new MockRandomProvider([0.5])).chooseAction(state, "p1");
      expect(engine.validateAction(state, action)).toEqual({ valid: true });
    }
  });

  it("reserve-aware bots buy healthy offers and decline risky ones", () => {
    const engine = new PropertyEmpireEngine(new MockRandomProvider([0, 0]));
    const bot = new PropertyEmpireBot(engine, new MockRandomProvider([0]));
    const initial = engine.createInitialState({ players });
    const placed: PropertyEmpireDomainState = { ...initial, players: initial.players.map((player) => player.id === "p1" ? { ...player, position: 19, kind: "BOT", difficulty: "HARD" } : player) };
    const offered = engine.reduce(placed, { type: "ROLL_DICE", playerId: "p1" }).state;
    expect(bot.chooseAction(offered, "p1").type).toBe("BUY_PROPERTY");
    const poor: PropertyEmpireDomainState = { ...offered, players: offered.players.map((player) => player.id === "p1" ? { ...player, cash: 110 } : player), pendingDecision: { ...offered.pendingDecision!, currentCash: 110, projectedCash: 10 } };
    expect(bot.chooseAction(poor, "p1").type).toBe("DECLINE_PROPERTY");
  });

  it("replays committed actions with the same injected random stream", () => {
    const firstEngine = new PropertyEmpireEngine(new MockRandomProvider([0, 0, 0]));
    const initial = firstEngine.createInitialState({ players });
    const actions: PropertyEmpireAction[] = [{ type: "ROLL_DICE", playerId: "p1" }, { type: "END_TURN", playerId: "p1" }];
    const expected = actions.reduce((state, action) => firstEngine.reduce(state, action).state, initial);
    const replay: GameReplay<PropertyEmpireDomainState, PropertyEmpireAction> = { gameType: "PROPERTY_EMPIRE", gameVersion: "1.0.0", initialState: initial, actions: actions.map((action, sequence) => ({ action, sequence, timestamp: `2026-08-02T00:00:0${sequence}.000Z` })) };
    expect(replayPropertyEmpire(new PropertyEmpireEngine(new MockRandomProvider([0, 0, 0])), replay)).toEqual(expected);
  });

  it("strictly serializes versioned saves and restores random streams", () => {
    const random = new PropertyEmpireSeededRandomProvider(505);
    const botRandom = new PropertyEmpireSeededRandomProvider(77);
    const engine = new PropertyEmpireEngine(random);
    const state = engine.createInitialState({ players });
    random.int(1, 6);
    botRandom.next();
    const saved = createPropertyEmpireSavedGame(engine, "save-1", state, [], "2026-08-02T00:00:00.000Z", { randomState: { game: random.snapshot(), bot: botRandom.snapshot() }, preferences: { botSpeed: "FAST" } });
    expect(deserializePropertyEmpireSavedGame(engine, saved)).toEqual(state);
    const restored = new PropertyEmpireSeededRandomProvider(505);
    restored.restore(saved.randomState!.game);
    expect(restored.int(1, 6)).toBe(random.int(1, 6));
    expect(() => deserializePropertyEmpireSavedGame(engine, { ...saved, boardVersion: 99 as 1 })).toThrow("Unsupported");
    expect(() => engine.deserialize(JSON.stringify({ ...state, phase: "ROLL", dice: [9, 9] }))).toThrow("Invalid Property Empire state");
    expect(() => restored.restore({ ...saved.randomState!.game, seed: 999 })).toThrow("Invalid Property Empire random snapshot");
  });

  it("rejects out-of-turn and unresolved actions", () => {
    const engine = new PropertyEmpireEngine(new MockRandomProvider([0]));
    const state = engine.createInitialState({ players });
    expect(engine.validateAction(state, { type: "ROLL_DICE", playerId: "p2" })).toMatchObject({ valid: false, code: "NOT_YOUR_TURN" });
    expect(engine.validateAction(state, { type: "END_TURN", playerId: "p1" })).toMatchObject({ valid: false, code: "TURN_NOT_RESOLVED" });
    expect(() => new PropertyEmpireBot(engine, new MockRandomProvider([0])).chooseAction({ ...state, phase: "FINISHED", rankings: ["p1", "p2"] }, "p1")).toThrow("No legal");
  });
});
