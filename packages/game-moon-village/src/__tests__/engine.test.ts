import { describe, expect, it } from "vitest";
import { MoonVillageEngine, MoonVillageSeededRandomProvider, replayMoonVillage, roleTeam, type MoonVillageAction, type MoonVillageDomainState, type MoonVillagePlayerConfig, type MoonVillageRole } from "..";

const configs: MoonVillagePlayerConfig[] = ["human", "mira", "tao", "linh", "niko", "sora", "aya", "bao"].map((id, index) => ({ id, name: index === 0 ? "You" : id, kind: index === 0 ? "HUMAN" : "BOT", difficulty: "NORMAL" }));
const make = (count = 6, maxRounds = 12) => { const random = new MoonVillageSeededRandomProvider(42); const engine = new MoonVillageEngine(random); const state = engine.createInitialState({ players: configs.slice(0, count), localPlayerId: "human", maxRounds }); return { engine, state, random }; };
const assign = (state: MoonVillageDomainState, roles: MoonVillageRole[]) => { state.players.forEach((player, index) => { player.role = roles[index]!; player.alive = true; }); };
const fixedRoles: MoonVillageRole[] = ["HEARTH_TENDER", "DUSK_PROWLER", "STAR_READER", "GATE_WARDEN", "DEW_BREWER", "BELL_RANGER"];
const apply = (engine: MoonVillageEngine, state: MoonVillageDomainState, action: MoonVillageAction) => engine.reduce(state, action).state;

describe("Moon Village engine", () => {
  it("creates deterministic valid role compositions for 5-8 residents", () => {
    for (const count of [5, 6, 7, 8]) {
      const first = make(count).state; const second = make(count).state;
      expect(first.players.map((player) => player.role)).toEqual(second.players.map((player) => player.role));
      expect(first.players.filter((player) => player.role === "DUSK_PROWLER")).toHaveLength(count === 8 ? 2 : 1);
      expect(first.phase).toBe("ROLE_REVEAL");
    }
    expect(() => make(4)).toThrow("5 to 8");
    const { engine } = make();
    expect(() => engine.createInitialState({ players: configs, localPlayerId: "missing" })).toThrow("missing");
    expect(() => engine.createInitialState({ players: [...configs.slice(0, 5), configs[0]!], localPlayerId: "human" })).toThrow("unique");
    expect(() => engine.createInitialState({ players: configs.slice(0, 5), localPlayerId: "human", maxRounds: 0 })).toThrow("max rounds");
  });

  it("validates actor, phase, and immutable transitions", () => {
    const { engine, state } = make(); const before = JSON.stringify(state);
    expect(engine.validateAction(state, { type: "ACKNOWLEDGE_ROLE", playerId: "ghost" })).toMatchObject({ valid: false, code: "UNKNOWN_PLAYER" });
    expect(engine.validateAction(state, { type: "CAST_VOTE", playerId: "human", targetPlayerId: "mira" })).toMatchObject({ valid: false, code: "ILLEGAL_ACTION" });
    const result = engine.reduce(state, { type: "ACKNOWLEDGE_ROLE", playerId: "human" });
    expect(JSON.stringify(state)).toBe(before); expect(result.state.sequence).toBe(1); expect(result.events.some((event) => event.type === "PHASE_CHANGED")).toBe(true);
    expect(() => engine.reduce(state, { type: "CAST_VOTE", playerId: "human", targetPlayerId: "mira" })).toThrow("ILLEGAL_ACTION");
  });

  it("resolves protection before attack and records reader knowledge privately", () => {
    const { engine, state } = make(); assign(state, fixedRoles);
    let next = apply(engine, state, { type: "ACKNOWLEDGE_ROLE", playerId: "human" });
    next = apply(engine, next, { type: "SELECT_PROWLER_TARGET", playerId: "mira", targetPlayerId: "human" });
    const read = engine.reduce(next, { type: "SELECT_READER_TARGET", playerId: "tao", targetPlayerId: "mira" }); next = read.state;
    expect(read.events).toContainEqual(expect.objectContaining({ type: "INVESTIGATION_RECORDED", team: "DUSK" }));
    next = apply(engine, next, { type: "SELECT_WARDEN_TARGET", playerId: "linh", targetPlayerId: "human" });
    next = apply(engine, next, { type: "PASS_NIGHT", playerId: "niko" });
    expect(next.players[0]!.alive).toBe(true); expect(next.phase).toBe("DAY_ANNOUNCEMENT");
    expect(engine.projectForPlayer(next, "tao").private.knowledge).toContainEqual(expect.objectContaining({ targetPlayerId: "mira", team: "DUSK" }));
    expect(engine.projectForPlayer(next, "human").private.knowledge).toEqual([]);
  });

  it("supports brewer restore and one-use mark with duplicate target elimination", () => {
    const { engine, state } = make(); assign(state, fixedRoles);
    let next = apply(engine, state, { type: "ACKNOWLEDGE_ROLE", playerId: "human" });
    next = apply(engine, next, { type: "SELECT_PROWLER_TARGET", playerId: "mira", targetPlayerId: "human" });
    next = apply(engine, next, { type: "SELECT_READER_TARGET", playerId: "tao", targetPlayerId: "mira" });
    next = apply(engine, next, { type: "SELECT_WARDEN_TARGET", playerId: "linh", targetPlayerId: "sora" });
    expect(engine.getValidActions(next, "niko")).toContainEqual({ type: "BREWER_RESTORE", playerId: "niko", targetPlayerId: "human" });
    next = apply(engine, next, { type: "BREWER_RESTORE", playerId: "niko", targetPlayerId: "human" });
    expect(next.players[0]!.alive).toBe(true); expect(next.brewerRestoreUsedBy).toEqual(["niko"]);

    next.phase = "NIGHT_BREWER"; next.night.brewerChoices = {}; next.night.attackTargetId = "tao";
    const marked = engine.reduce(next, { type: "BREWER_MARK", playerId: "niko", targetPlayerId: "tao" }).state;
    expect(marked.players.find((player) => player.id === "tao")?.alive).toBe(false); expect(marked.brewerMarkUsedBy).toContain("niko");
  });

  it("skips missing night roles and enforces Warden repeat restrictions", () => {
    const { engine, state } = make(); assign(state, fixedRoles); state.players.find((player) => player.id === "tao")!.alive = false;
    state.players.find((player) => player.id === "niko")!.alive = false;
    state.previousWardenTargets.linh = "human";
    let next = apply(engine, state, { type: "ACKNOWLEDGE_ROLE", playerId: "human" });
    next = apply(engine, next, { type: "SELECT_PROWLER_TARGET", playerId: "mira", targetPlayerId: "sora" });
    expect(next.phase).toBe("NIGHT_WARDEN");
    expect(engine.getValidActions(next, "linh").some((action) => "targetPlayerId" in action && action.targetPlayerId === "human")).toBe(false);
    next = apply(engine, next, { type: "SELECT_WARDEN_TARGET", playerId: "linh", targetPlayerId: "linh" });
    expect(next.phase === "DAY_ANNOUNCEMENT" || next.phase === "FINISHED" || next.phase === "RANGER_RETALIATION").toBe(true);
  });

  it("collects private votes, resolves ties, and exposes only resolved tallies", () => {
    const { engine, state } = make(5); assign(state, fixedRoles.slice(0, 5)); state.phase = "DAY_VOTING";
    let next = state;
    const votes: [string, string][] = [["human", "mira"], ["mira", "human"], ["tao", "mira"], ["linh", "human"], ["niko", "tao"]];
    for (const [playerId, targetPlayerId] of votes) next = apply(engine, next, { type: "CAST_VOTE", playerId, targetPlayerId });
    expect(next.phase).toBe("RESOLVE_VOTE"); expect(next.lastVoteResult?.tied).toBe(true); expect(next.players.every((player) => player.alive)).toBe(true);
    expect(engine.projectPublic(next).lastVoteResult?.votes).toEqual(next.votes);
  });

  it("allows an eliminated Bell Ranger to retaliate and then resolves the vote", () => {
    const { engine, state } = make(); assign(state, fixedRoles); state.phase = "DAY_VOTING";
    let next = state;
    for (const player of next.players) next = apply(engine, next, { type: "CAST_VOTE", playerId: player.id, targetPlayerId: player.id === "sora" ? "human" : "sora" });
    expect(next.phase).toBe("RANGER_RETALIATION"); expect(next.players.find((player) => player.id === "sora")?.alive).toBe(false);
    expect(engine.getValidActions(next, "sora")).toContainEqual({ type: "SELECT_RANGER_TARGET", playerId: "sora", targetPlayerId: "human" });
    next = apply(engine, next, { type: "SELECT_RANGER_TARGET", playerId: "sora", targetPlayerId: "human" });
    expect(next.players[0]!.alive).toBe(false); expect(["RESOLVE_VOTE", "FINISHED"]).toContain(next.phase);
    expect(next.publicLog.at(-1)).toContain("final bell");
  });

  it("applies Dawn and Dusk win conditions and round-limit results", () => {
    const { engine, state } = make(); assign(state, fixedRoles); state.phase = "DAY_VOTING";
    state.players.filter((player) => player.id !== "mira").forEach((player) => { state.votes[player.id] = "mira"; });
    const dawn = engine.reduce(state, { type: "CAST_VOTE", playerId: "mira", targetPlayerId: "human" }).state;
    const finished = apply(engine, dawn, { type: "ACKNOWLEDGE_VOTE", playerId: "human" });
    expect(finished.winnerTeam).toBe("DAWN"); expect(engine.checkGameOver(finished)?.outcome).toBe("WIN");

    const duskState = make().state; assign(duskState, fixedRoles); duskState.players.forEach((player) => { player.alive = player.id === "mira" || player.id === "human"; }); duskState.phase = "RESOLVE_VOTE";
    const dusk = apply(engine, duskState, { type: "ACKNOWLEDGE_VOTE", playerId: "human" });
    expect(dusk.winnerTeam).toBe("DUSK");

    const limited = make(5, 1).state; assign(limited, fixedRoles.slice(0, 5)); limited.phase = "RESOLVE_VOTE";
    const limitResult = apply(engine, limited, { type: "ACKNOWLEDGE_VOTE", playerId: "human" });
    expect(limitResult.phase).toBe("FINISHED"); expect(limitResult.winnerTeam).toBe("DAWN");
  });

  it("projects no unauthorized roles/actions before finish and reveals after finish", () => {
    const { engine, state } = make(); assign(state, fixedRoles);
    const publicJson = JSON.stringify(engine.projectPublic(state));
    expect(publicJson).not.toContain("DUSK_PROWLER"); expect(publicJson).not.toContain("STAR_READER"); expect(publicJson).not.toContain("prowlerVotes");
    const human = engine.projectForPlayer(state, "human");
    expect(human.private.role).toBe("HEARTH_TENDER"); expect(JSON.stringify(human)).not.toContain("STAR_READER");
    expect(() => engine.projectForModerator(state, Symbol("fake"))).toThrow("trusted server");
    state.phase = "FINISHED"; state.winnerTeam = "DAWN";
    expect(engine.projectPublic(state).revealedRoles).toHaveLength(6); expect(roleTeam("DUSK_PROWLER")).toBe("DUSK");
  });

  it("serializes strictly and replays deterministic actions", () => {
    const { engine, state } = make();
    const action: MoonVillageAction = { type: "ACKNOWLEDGE_ROLE", playerId: "human" };
    const next = engine.reduce(state, action).state;
    expect(engine.deserialize(engine.serialize(next))).toEqual(next);
    expect(replayMoonVillage(engine, state, [action])).toEqual(next);
    expect(() => engine.deserialize("null")).toThrow("Invalid");
    expect(() => engine.deserialize(JSON.stringify({ ...next, stateVersion: 99 }))).toThrow("Unsupported");
    expect(() => engine.deserialize(JSON.stringify({ ...next, players: [{ id: "broken" }] }))).toThrow("corrupt");
  });
});
