import { describe, expect, it } from "vitest";
import { isColorClashAction } from "./color-clash-action";

describe("Color Clash command envelope", () => {
  it("accepts only structurally bounded engine actions", () => {
    expect(isColorClashAction({ type: "DRAW_CARD", playerId: "p1" })).toBe(true);
    expect(isColorClashAction({ type: "PASS_TURN", playerId: "p1" })).toBe(true);
    expect(isColorClashAction({ type: "PLAY_CARD", playerId: "p1", cardId: "c1", chosenColor: "BLUE" })).toBe(true);
    expect(isColorClashAction({ type: "PLAY_CARD", playerId: "p1", cardId: "c1" })).toBe(true);
  });

  it.each([null, [], "DRAW_CARD", {}, { type: "DRAW_CARD" }, { type: "PLAY_CARD", playerId: "p1" }, { type: "PLAY_CARD", playerId: "p1", cardId: "c1", chosenColor: "WILD" }, { type: "SET_WINNER", playerId: "p1" }])("rejects malformed or authoritative-field spoofing payload %#", (value) => {
    expect(isColorClashAction(value)).toBe(false);
  });
});
