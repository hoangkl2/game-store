import { describe, expect, it } from "vitest";
import { adaptColorClashEvent, adaptMoonVillageProjection, adaptPropertyEmpireEvent, adaptRoyalRaceEvent } from "./adapters";

describe("domain event animation adapters", () => {
  it("maps one committed presentation-safe event for each public game", () => {
    expect(adaptColorClashEvent({ type: "CARD_PLAYED", playerId: "p1", card: { id: "c1", color: "RED", type: "NUMBER", number: 4 } }, "uno-1", 1)[0]).toMatchObject({ type: "COLOR_CLASH_CARD_PLAYED", payload: { cardId: "c1", color: "RED" } });
    expect(adaptRoyalRaceEvent({ type: "PIECE_MOVED", playerId: "p1", pieceId: "piece", fromCellId: "a", toCellId: "b", pathCellIds: ["a", "b"] }, "race-1", 2)[0]).toMatchObject({ type: "ROYAL_RACE_TOKEN_MOVED", payload: { toCellId: "b" } });
    expect(adaptPropertyEmpireEvent({ type: "TOKEN_MOVED", playerId: "p1", fromTileId: "a", toTileId: "b", pathTileIds: ["a", "b"] }, "empire-1", 3)[0]).toMatchObject({ type: "PROPERTY_EMPIRE_TOKEN_MOVED", payload: { toTileId: "b" } });
  });
  it("accepts only Moon Village public projection data and excludes private role information", () => {
    const commands = adaptMoonVillageProjection({ projectionVersion: 1, phase: "DAY_ANNOUNCEMENT", round: 2, maxRounds: 6, sequence: 7, players: [{ id: "p1", name: "A", kind: "HUMAN", alive: true, seat: 0 }], publicLog: ["Dawn"], discussionMessages: [], draw: false });
    expect(commands[0]).toMatchObject({ type: "MOON_VILLAGE_DAY_TRANSITION", payload: { phase: "DAY_ANNOUNCEMENT", round: 2 } });
    expect(JSON.stringify(commands)).not.toContain("ROLE"); expect(JSON.stringify(commands)).not.toContain("targetPlayerId");
    expect(adaptMoonVillageProjection({ projectionVersion: 1, phase: "NIGHT_READER", round: 2, maxRounds: 6, sequence: 8, players: [], publicLog: [], discussionMessages: [], draw: false })).toEqual([]);
  });
});
