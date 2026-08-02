import { describe, expect, it } from "vitest";
import { createMoonVillageBotMemory, createMoonVillageSavedGame, MoonVillageBot, MoonVillageEngine, MoonVillageOfflineSession, MoonVillageSeededRandomProvider, validateMoonVillageSavedGame, type MoonVillagePlayerConfig } from "..";

const players: MoonVillagePlayerConfig[] = ["human", "a", "b", "c", "d", "e"].map((id, index) => ({ id, name: id, kind: index ? "BOT" : "HUMAN", difficulty: index ? "HARD" : undefined }));
const setup = () => { const gameRandom = new MoonVillageSeededRandomProvider(7); const botRandom = new MoonVillageSeededRandomProvider(9); const engine = new MoonVillageEngine(gameRandom); const session = MoonVillageOfflineSession.create(engine, gameRandom, botRandom, { players, localPlayerId: "human", maxRounds: 2 }); return { gameRandom, botRandom, engine, session }; };

describe("Moon Village bots, session, and saves", () => {
  it("snapshots and restores random streams strictly", () => {
    const random = new MoonVillageSeededRandomProvider(12); const first = random.next(); const snapshot = random.snapshot(); const future = [random.next(), random.int(1, 6)]; random.restore(snapshot);
    expect([random.next(), random.int(1, 6)]).toEqual(future); expect(first).toBeGreaterThanOrEqual(0);
    expect(random.pick(["moon"])).toBe("moon"); expect(() => random.pick([])).toThrow("empty");
    expect(() => random.restore({ ...snapshot, seed: 13 })).toThrow("Invalid");
  });

  it("bots choose only projected legal actions and update bounded private memory", () => {
    const { engine } = setup(); const state = engine.createInitialState({ players, localPlayerId: "human" });
    state.phase = "DAY_VOTING";
    const projection = engine.projectForPlayer(state, "a"); const memory = createMoonVillageBotMemory(projection.public);
    const easy = new MoonVillageBot(new MoonVillageSeededRandomProvider(1), "EASY"); const normal = new MoonVillageBot(new MoonVillageSeededRandomProvider(2), "NORMAL"); const hard = new MoonVillageBot(new MoonVillageSeededRandomProvider(3), "HARD");
    expect(projection.private.legalActions).toContainEqual(easy.chooseAction(projection, memory));
    expect(projection.private.legalActions).toContainEqual(normal.chooseAction(projection, memory));
    expect(projection.private.legalActions).toContainEqual(hard.chooseAction(projection, memory));
    const observed = hard.observe(projection, memory); expect(observed.knownTeams).toEqual(expect.any(Object)); expect(hard.createIntent(projection, observed).intent).toMatch(/ACCUSE|OBSERVE/);
  });

  it("session exposes only the local projection, advances bots, and rejects impersonation", () => {
    const { session } = setup(); const initial = session.projection();
    expect(initial.private.playerId).toBe("human");
    expect(() => session.submitLocal({ type: "ACKNOWLEDGE_ROLE", playerId: "a" })).toThrow("authorized local");
    session.submitLocal({ type: "ACKNOWLEDGE_ROLE", playerId: "human" });
    let guard = 0; while (session.hasPendingBotAction() && guard++ < 20) session.advanceOneBot("NORMAL");
    expect(session.publicSequence()).toBeGreaterThan(1);
  });

  it("versions save envelopes and restores deterministic session snapshots", () => {
    const source = setup(); source.session.submitLocal({ type: "ACKNOWLEDGE_ROLE", playerId: "human" });
    if (source.session.hasPendingBotAction()) source.session.advanceOneBot("HARD");
    const snapshot = source.session.exportSnapshot(); const save = createMoonVillageSavedGame("slot", snapshot, { botDifficulty: "HARD", botSpeed: "FAST" }, "2026-01-01T00:00:00.000Z");
    expect(validateMoonVillageSavedGame(save)).toEqual(save); expect(save.createdAt).toBe("2026-01-01T00:00:00.000Z");
    const target = setup(); expect(target.session.restore(snapshot)).toEqual(source.session.projection());
    expect(() => validateMoonVillageSavedGame({ ...save, saveVersion: 99 })).toThrow("Unsupported");
    expect(() => validateMoonVillageSavedGame(null)).toThrow("Invalid");
    expect(() => target.session.restore({ ...snapshot, actionHistory: null as never })).toThrow("Corrupt");
    const botId = Object.keys(snapshot.botMemories)[0]!;
    const injected = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    injected.botMemories[botId]!.knownTeams.ghost = "DUSK";
    expect(() => target.session.restore(injected)).toThrow("Unauthorized");
  });
});
