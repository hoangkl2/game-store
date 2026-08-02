import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockRandomProvider } from "@game-store/game-core";
import { PropertyEmpireEngine, type PropertyEmpireDomainState } from "@game-store/game-property-empire";
import { PlayerFinanceGrid, PropertyDetailPanel, PropertyEmpireBoard, TransactionHistory } from "./components";

const config = { players: [{ id: "p1", name: "One" }, { id: "p2", name: "Two", kind: "BOT" as const }] };

describe("Property Empire presentation boundaries", () => {
  it("renders 20 labelled tiles and supports arrow-key tile focus", () => {
    const engine = new PropertyEmpireEngine(new MockRandomProvider([0]));
    const state = engine.createInitialState(config);
    render(<PropertyEmpireBoard state={state} engine={engine} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(20);
    const tiles = screen.getAllByRole("button");
    tiles[0]!.focus();
    fireEvent.keyDown(tiles[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tiles[1]);
    expect(tiles[1]!.getAttribute("aria-label")).toContain("Copper Quay");
  });

  it("renders finance and ownership from engine state", () => {
    const engine = new PropertyEmpireEngine(new MockRandomProvider([0, 0]));
    const initial = engine.createInitialState(config);
    const placed: PropertyEmpireDomainState = { ...initial, players: initial.players.map((player) => player.id === "p1" ? { ...player, position: 19 } : player) };
    const offered = engine.reduce(placed, { type: "ROLL_DICE", playerId: "p1" }).state;
    const bought = engine.reduce(offered, { type: "BUY_PROPERTY", playerId: "p1", propertyId: offered.pendingDecision!.propertyId }).state;
    render(<><PlayerFinanceGrid state={bought} engine={engine} /><PropertyDetailPanel state={bought} engine={engine} tileId="copper-quay" /><TransactionHistory state={bought} open onToggle={vi.fn()} /></>);
    expect(screen.getByText("620 credits")).toBeTruthy();
    expect(screen.getByText("One", { selector: "dd" })).toBeTruthy();
    expect(screen.getByText(/Purchased Copper Quay/)).toBeTruthy();
  });
});
