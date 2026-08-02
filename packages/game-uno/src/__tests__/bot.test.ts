import { describe, expect, it } from "vitest";
import { SeededRandomProvider } from "@game-store/game-core";
import { UnoBot } from "../bot";
import { UnoEngine, type UnoGameState } from "../engine";

function setup(): { engine: UnoEngine; state: UnoGameState } { const engine = new UnoEngine(new SeededRandomProvider(9)); return { engine, state: engine.createInitialState({ players: [{ id: "bot", name: "Bot", kind: "BOT" }, { id: "human", name: "Human" }] }) }; }
describe("UNO bots", () => {
  it("EASY always chooses an engine-valid action", () => { const { engine, state } = setup(); const action = new UnoBot(engine, new SeededRandomProvider(1), "EASY").chooseAction(state, "bot"); expect(engine.validateAction(state, action)).toEqual({ valid: true }); });
  it("NORMAL and HARD return actions without mutating state", () => { const { engine, state } = setup(); const before = engine.serialize(state); for (const difficulty of ["NORMAL", "HARD"] as const) { const action = new UnoBot(engine, new SeededRandomProvider(2), difficulty).chooseAction(state, "bot"); expect(engine.validateAction(state, action)).toEqual({ valid: true }); } expect(engine.serialize(state)).toBe(before); });
});
