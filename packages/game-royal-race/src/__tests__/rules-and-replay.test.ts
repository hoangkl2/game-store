import { describe, expect, it } from "vitest";
import { MockRandomProvider, type GameReplay } from "@game-store/game-core";
import {
  createRoyalRaceSavedGame,
  FINISH_POSITION,
  replayRoyalRace,
  RoyalRaceEngine,
  TRACK_LENGTH,
  type RoyalRaceAction,
  type RoyalRaceState,
} from "../engine";
import { deserializeRoyalRaceSavedGame } from "../storage";
import { ReplayableSeededRandomProvider } from "../random";

const players = [
  { id: "p1", name: "One" },
  { id: "p2", name: "Two", kind: "BOT" as const },
  { id: "p3", name: "Three", kind: "BOT" as const },
];

describe("Royal Race rules and replay integration", () => {
  it("enters the home path and preserves the input state", () => {
    const engine = new RoyalRaceEngine(new MockRandomProvider([0]));
    const initial = engine.createInitialState({ players });
    const state: RoyalRaceState = {
      ...initial,
      phase: "MOVE",
      dice: 1,
      pieces: initial.pieces.map((piece) => piece.id === "p1-1" ? { ...piece, position: TRACK_LENGTH - 1 } : piece),
    };

    const result = engine.reduce(state, { type: "MOVE_PIECE", playerId: "p1", pieceId: "p1-1" });

    expect(state.pieces.find((piece) => piece.id === "p1-1")?.position).toBe(TRACK_LENGTH - 1);
    expect(result.state.pieces.find((piece) => piece.id === "p1-1")?.position).toBe(TRACK_LENGTH);
    expect(result.events).toContainEqual({ type: "PIECE_ENTERED_HOME_PATH", pieceId: "p1-1" });
  });

  it("ranks completed players, skips them, and assigns the final ranking", () => {
    const engine = new RoyalRaceEngine(new MockRandomProvider([0]));
    const initial = engine.createInitialState({ players, piecesPerPlayer: 1 });
    const p1Finishing: RoyalRaceState = {
      ...initial,
      phase: "MOVE",
      dice: 1,
      pieces: initial.pieces.map((piece) => piece.id === "p1-1" ? { ...piece, position: FINISH_POSITION - 1 } : piece),
    };
    const first = engine.reduce(p1Finishing, { type: "MOVE_PIECE", playerId: "p1", pieceId: "p1-1" });
    expect(first.state.rankings).toEqual(["p1"]);
    expect(first.state.currentPlayerIndex).toBe(1);

    const p2Finishing: RoyalRaceState = {
      ...first.state,
      phase: "MOVE",
      dice: 1,
      pieces: first.state.pieces.map((piece) => piece.id === "p2-1" ? { ...piece, position: FINISH_POSITION - 1 } : piece),
    };
    const final = engine.reduce(p2Finishing, { type: "MOVE_PIECE", playerId: "p2", pieceId: "p2-1" });
    expect(final.state.phase).toBe("FINISHED");
    expect(final.state.rankings).toEqual(["p1", "p2", "p3"]);
    expect(engine.checkGameOver(final.state)).toEqual({ outcome: "WIN", winnerId: "p1", rankings: ["p1", "p2", "p3"] });
  });

  it("skips an already ranked player in turn rotation", () => {
    const engine = new RoyalRaceEngine(new MockRandomProvider([0]));
    const initial = engine.createInitialState({ players, piecesPerPlayer: 1 });
    const state: RoyalRaceState = {
      ...initial,
      phase: "MOVE",
      dice: 1,
      rankings: ["p2"],
      pieces: initial.pieces.map((piece) => piece.id === "p1-1" ? { ...piece, position: 1 } : piece),
    };
    const result = engine.reduce(state, { type: "MOVE_PIECE", playerId: "p1", pieceId: "p1-1" });
    expect(result.state.currentPlayerIndex).toBe(2);
  });

  it("replays the same committed actions deterministically", () => {
    const firstEngine = new RoyalRaceEngine(new MockRandomProvider([0.99]));
    const initial = firstEngine.createInitialState({ players: players.slice(0, 2), piecesPerPlayer: 1 });
    const actions: RoyalRaceAction[] = [
      { type: "ROLL_DICE", playerId: "p1" },
      { type: "MOVE_PIECE", playerId: "p1", pieceId: "p1-1" },
    ];
    const expected = actions.reduce((state, action) => firstEngine.reduce(state, action).state, initial);
    const replay: GameReplay<RoyalRaceState, RoyalRaceAction> = {
      gameType: "ROYAL_RACE",
      gameVersion: "1.0.0",
      initialState: initial,
      actions: actions.map((action, sequence) => ({ sequence, action, timestamp: `2026-08-02T00:00:0${sequence}.000Z` })),
    };
    const replayEngine = new RoyalRaceEngine(new MockRandomProvider([0.99]));
    expect(replayRoyalRace(replayEngine, replay)).toEqual(expected);
  });

  it("versions saves and rejects malformed or incompatible snapshots", () => {
    const engine = new RoyalRaceEngine(new MockRandomProvider([0]));
    const state = engine.createInitialState({ players: players.slice(0, 2) });
    const saved = createRoyalRaceSavedGame(engine, "save-1", state, [], "2026-08-02T00:00:00.000Z");
    expect(deserializeRoyalRaceSavedGame(engine, saved)).toEqual(state);
    expect(() => engine.deserialize(JSON.stringify({ ...state, phase: "MOVE", dice: 9 }))).toThrow("Invalid Royal Race state");
    expect(() => deserializeRoyalRaceSavedGame(engine, { ...saved, stateVersion: 99 })).toThrow("Unsupported Royal Race save");
  });

  it("rejects invalid setup and out-of-turn actions", () => {
    const engine = new RoyalRaceEngine(new MockRandomProvider([0]));
    expect(() => engine.createInitialState({ players: [{ id: "same", name: "One" }, { id: "same", name: "Two" }] })).toThrow("unique");
    const state = engine.createInitialState({ players: players.slice(0, 2) });
    expect(engine.validateAction(state, { type: "ROLL_DICE", playerId: "p2" })).toMatchObject({ valid: false, code: "NOT_YOUR_TURN" });
  });

  it("restores the exact random sequence after an offline save", () => {
    const uninterrupted = new ReplayableSeededRandomProvider(42);
    uninterrupted.int(1, 6);
    const snapshot = uninterrupted.snapshot();
    const expectedNext = uninterrupted.int(1, 6);
    const restored = new ReplayableSeededRandomProvider(42);
    restored.restore(snapshot);
    expect(restored.int(1, 6)).toBe(expectedNext);
    expect(() => restored.restore({ ...snapshot, seed: 99 })).toThrow("Invalid Royal Race random snapshot");
  });
});
