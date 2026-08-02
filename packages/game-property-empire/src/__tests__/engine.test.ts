import { describe, expect, it } from "vitest";
import { MockRandomProvider } from "@game-store/game-core";
import { PROPERTY_EMPIRE_BOARD, PROPERTY_TILES, TRANSIT_HOLD_INDEX } from "../board";
import { PropertyEmpireEngine, type PropertyEmpireDomainState } from "../engine";

const config = { players: [{ id: "p1", name: "One" }, { id: "p2", name: "Two", kind: "BOT" as const }] };
const create = (values: number[] = [0]) => { const engine = new PropertyEmpireEngine(new MockRandomProvider(values)); return { engine, state: engine.createInitialState(config) }; };
const place = (state: PropertyEmpireDomainState, playerId: string, position: number) => ({ ...state, players: state.players.map((player) => player.id === playerId ? { ...player, position } : player) });

describe("PropertyEmpireEngine", () => {
  it("creates a complete original board-backed state and validates setup", () => {
    const { engine, state } = create();
    expect(PROPERTY_EMPIRE_BOARD).toHaveLength(20);
    expect(new Set(PROPERTY_EMPIRE_BOARD.map((tile) => tile.id)).size).toBe(20);
    expect(state.ownership).toHaveLength(PROPERTY_TILES.length);
    expect(engine.getValidActions(state, "p1")).toEqual([{ type: "ROLL_DICE", playerId: "p1" }]);
    expect(() => engine.createInitialState({ players: [{ id: "same", name: "One" }, { id: "same", name: "Two" }] })).toThrow("unique");
    expect(() => engine.createInitialState({ players: config.players, maxTurns: 0 })).toThrow("Invalid");
  });

  it("rolls, moves, passes Founders' Gate, and creates an engine purchase decision", () => {
    const { engine, state } = create([0, 0]);
    const before = place(state, "p1", 19);
    const result = engine.reduce(before, { type: "ROLL_DICE", playerId: "p1" });
    expect(before.players[0]?.position).toBe(19);
    expect(result.state.players[0]).toMatchObject({ position: 1, cash: 720 });
    expect(result.state.pendingDecision).toMatchObject({ propertyId: "copper-quay", price: 100, projectedCash: 620 });
    expect(result.events.map((event) => event.type)).toEqual(["DICE_ROLLED", "PASSED_FOUNDERS_GATE", "TOKEN_MOVED", "PROPERTY_OFFERED"]);
  });

  it("buys or declines only the pending property without UI-side finance rules", () => {
    const { engine, state } = create([0, 0]);
    const offered = engine.reduce(place(state, "p1", 19), { type: "ROLL_DICE", playerId: "p1" }).state;
    expect(engine.validateAction(offered, { type: "BUY_PROPERTY", playerId: "p1", propertyId: "kiteworks-yard" })).toMatchObject({ valid: false, code: "STALE_PROPERTY_DECISION" });
    const bought = engine.reduce(offered, { type: "BUY_PROPERTY", playerId: "p1", propertyId: "copper-quay" });
    expect(bought.state.players[0]?.cash).toBe(620);
    expect(engine.getPropertyOwner(bought.state, "copper-quay")).toBe("p1");
    expect(bought.state.transactions.at(-1)).toMatchObject({ type: "PURCHASE", amount: -100 });

    const secondEngine = new PropertyEmpireEngine(new MockRandomProvider([0, 0]));
    const secondOffer = secondEngine.reduce(place(secondEngine.createInitialState(config), "p1", 19), { type: "ROLL_DICE", playerId: "p1" }).state;
    const declined = secondEngine.reduce(secondOffer, { type: "DECLINE_PROPERTY", playerId: "p1", propertyId: "copper-quay" });
    expect(secondEngine.getPropertyOwner(declined.state, "copper-quay")).toBeUndefined();
    expect(declined.events).toContainEqual({ type: "PROPERTY_DECLINED", playerId: "p1", propertyId: "copper-quay" });
  });

  it("pays rent to an owner and tax to the city", () => {
    const { engine, state } = create([0, 0]);
    const rentState = { ...place(state, "p1", 19), ownership: state.ownership.map((entry) => entry.tileId === "copper-quay" ? { ...entry, ownerId: "p2" } : entry) };
    const rent = engine.reduce(rentState, { type: "ROLL_DICE", playerId: "p1" });
    expect(rent.state.players.find((player) => player.id === "p1")?.cash).toBe(700);
    expect(rent.state.players.find((player) => player.id === "p2")?.cash).toBe(620);
    expect(rent.events.some((event) => event.type === "RENT_PAID")).toBe(true);

    const taxState = place(state, "p1", 2);
    const tax = engine.reduce(taxState, { type: "ROLL_DICE", playerId: "p1" });
    expect(tax.state.players[0]?.cash).toBe(540);
    expect(tax.state.transactions.at(-1)).toMatchObject({ type: "TAX", amount: -60 });
  });

  it("draws deterministic original event cards and handles Transit Hold", () => {
    const eventEngine = new PropertyEmpireEngine(new MockRandomProvider([0, 0, 0]));
    const eventState = place(eventEngine.createInitialState(config), "p1", 0);
    const grant = eventEngine.reduce(eventState, { type: "ROLL_DICE", playerId: "p1" });
    expect(grant.state.lastEventCardId).toBe("market-city-grant");
    expect(grant.state.players[0]?.cash).toBe(680);

    const holdEngine = new PropertyEmpireEngine(new MockRandomProvider([0, 0, 0]));
    const hold = holdEngine.reduce(place(holdEngine.createInitialState(config), "p1", 6), { type: "ROLL_DICE", playerId: "p1" });
    expect(hold.state.players[0]).toMatchObject({ position: TRANSIT_HOLD_INDEX, inTransitHold: true });
    expect(hold.events.some((event) => event.type === "PLAYER_SENT_TO_TRANSIT_HOLD")).toBe(true);
  });

  it("releases held players after serving or doubles", () => {
    const servedEngine = new PropertyEmpireEngine(new MockRandomProvider([0, 0.2]));
    const base = servedEngine.createInitialState(config);
    const held = { ...base, players: base.players.map((player) => player.id === "p1" ? { ...player, position: TRANSIT_HOLD_INDEX, inTransitHold: true } : player) };
    const served = servedEngine.reduce(held, { type: "ROLL_DICE", playerId: "p1" });
    expect(served.state.players[0]).toMatchObject({ position: TRANSIT_HOLD_INDEX, inTransitHold: false });
    expect(served.events).toContainEqual({ type: "PLAYER_RELEASED_FROM_TRANSIT_HOLD", playerId: "p1", reason: "SERVED" });

    const doublesEngine = new PropertyEmpireEngine(new MockRandomProvider([0, 0]));
    const doubles = doublesEngine.reduce(held, { type: "ROLL_DICE", playerId: "p1" });
    expect(doubles.state.players[0]?.position).toBe(12);
    expect(doubles.events).toContainEqual({ type: "PLAYER_RELEASED_FROM_TRANSIT_HOLD", playerId: "p1", reason: "DOUBLES" });
  });

  it("commits respectful bankruptcy and an engine-owned winner", () => {
    const { engine, state } = create([0, 0]);
    const custom: PropertyEmpireDomainState = {
      ...place(state, "p1", 1),
      players: place(state, "p1", 1).players.map((player) => player.id === "p1" ? { ...player, cash: 10 } : player),
      ownership: state.ownership.map((entry) => entry.tileId === "kiteworks-yard" ? { ...entry, ownerId: "p2" } : entry),
    };
    const result = engine.reduce(custom, { type: "ROLL_DICE", playerId: "p1" });
    expect(result.state.phase).toBe("FINISHED");
    expect(result.state.rankings).toEqual(["p2", "p1"]);
    expect(result.state.players[0]).toMatchObject({ cash: 0, bankrupt: true });
    expect(engine.checkGameOver(result.state)).toEqual({ outcome: "WIN", winnerId: "p2", rankings: ["p2", "p1"] });
  });

  it("ends at the configured turn limit using engine net worth ranking", () => {
    const engine = new PropertyEmpireEngine(new MockRandomProvider([0]));
    const state = engine.createInitialState({ ...config, maxTurns: 1 });
    const resolved: PropertyEmpireDomainState = { ...state, phase: "END_TURN", dice: [1, 1], players: state.players.map((player) => player.id === "p2" ? { ...player, cash: 700 } : player) };
    const result = engine.reduce(resolved, { type: "END_TURN", playerId: "p1" });
    expect(result.state.rankings).toEqual(["p2", "p1"]);
    expect(result.events).toEqual([{ type: "GAME_FINISHED", rankings: ["p2", "p1"], reason: "TURN_LIMIT" }]);
  });

  it("automatically advances after bankruptcy when multiple players remain", () => {
    const engine = new PropertyEmpireEngine(new MockRandomProvider([0, 0]));
    const initial = engine.createInitialState({ players: [...config.players, { id: "p3", name: "Three", kind: "BOT" }] });
    const atRent = place(initial, "p1", 1);
    const state: PropertyEmpireDomainState = {
      ...atRent,
      players: atRent.players.map((player) => player.id === "p1" ? { ...player, cash: 10 } : player),
      ownership: atRent.ownership.map((entry) => entry.tileId === "kiteworks-yard" ? { ...entry, ownerId: "p3" } : entry),
    };
    const result = engine.reduce(state, { type: "ROLL_DICE", playerId: "p1" });
    expect(result.state).toMatchObject({ phase: "ROLL", currentPlayerIndex: 1, turnNumber: 2 });
    expect(result.events.at(-1)).toEqual({ type: "TURN_CHANGED", previousPlayerId: "p1", currentPlayerId: "p2" });
  });
});
