import { describe, expect, it } from "vitest";
import { adaptColorClashAudio, adaptMoonVillagePublicAudio, adaptPropertyEmpireAudio, adaptRoomPublicAudio, adaptRoyalRaceAudio } from "./adapters";

describe("audio adapters", () => {
  it("maps one committed public cue for each game and room", () => {
    expect(adaptColorClashAudio({ type: "CARD_PLAYED", playerId: "p", card: { id: "c", color: "RED", type: "NUMBER", number: 4 } }, "color", 1)[0]).toMatchObject({ assetId: "color-card-played", caption: "Card played." });
    expect(adaptRoyalRaceAudio({ type: "DICE_ROLLED", playerId: "p", value: 6 }, "race", 2)[0]).toMatchObject({ assetId: "royal-die-settled", caption: "Die settled on 6." });
    expect(adaptPropertyEmpireAudio({ type: "TOKEN_MOVED", playerId: "p", fromTileId: "a", toTileId: "b", pathTileIds: ["a", "b"] }, "property", 3)[0]).toMatchObject({ assetId: "property-token-arrived" });
    expect(adaptRoomPublicAudio({ type: "RESYNCED", sequence: 4 })[0]).toMatchObject({ assetId: "system-resynced", authorizedAudience: "PUBLIC" });
  });
  it("accepts only the Moon Village public projection and emits no secret metadata", () => {
    const commands = adaptMoonVillagePublicAudio({ projectionVersion: 1, phase: "DAY_ANNOUNCEMENT", round: 2, maxRounds: 6, sequence: 7, players: [], publicLog: [], discussionMessages: [], draw: false });
    expect(commands[0]).toMatchObject({ assetId: "moon-public-transition", caption: "Village phase changed." });
    expect(JSON.stringify(commands)).not.toMatch(/ROLE|target|INVESTIGATION|PROWLER|READER/i);
    expect(adaptMoonVillagePublicAudio({ projectionVersion: 1, phase: "NIGHT_READER", round: 2, maxRounds: 6, sequence: 8, players: [], publicLog: [], discussionMessages: [], draw: false })).toEqual([]);
  });
});
