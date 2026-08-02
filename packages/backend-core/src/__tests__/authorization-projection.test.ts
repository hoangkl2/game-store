import { describe, expect, it } from "vitest";
import { authorize, type AuthorizationContext } from "../authorization";
import { ProjectionService, type GameProjectionAdapter } from "../projection";

const context: AuthorizationContext = {
  identityId: "identity-1",
  accountStatus: "ACTIVE",
  roles: ["PLAYER"],
  room: { membershipIdentityId: "identity-1", isHost: true, isSpectator: false },
  session: { seatIdentityId: "identity-1", playerId: "player-1", control: "HUMAN" }
};

describe("authorization", () => {
  it("binds room and game permissions to the verified identity and seat", () => {
    expect(authorize(context, { operation: "MANAGE_ROOM" })).toEqual({ allowed: true });
    expect(authorize(context, { operation: "SUBMIT_GAME_ACTION", suppliedPlayerId: "player-1" })).toEqual({ allowed: true });
    expect(authorize(context, { operation: "VIEW_PLAYER_PROJECTION", suppliedPlayerId: "player-1" })).toEqual({ allowed: true });
    expect(authorize(context, { operation: "SUBMIT_GAME_ACTION", suppliedPlayerId: "player-2" })).toMatchObject({ allowed: false, code: "SEAT_MISMATCH" });
    expect(authorize({ ...context, room: { ...context.room!, isHost: false } }, { operation: "MANAGE_ROOM" })).toMatchObject({ code: "NOT_HOST" });
    expect(authorize({ ...context, room: undefined }, { operation: "MANAGE_ROOM" })).toMatchObject({ code: "NOT_MEMBER" });
    expect(authorize({ ...context, accountStatus: "SUSPENDED" }, { operation: "SUBMIT_GAME_ACTION", suppliedPlayerId: "player-1" })).toMatchObject({ code: "IDENTITY_DISABLED" });
  });

  it("separates spectator, bot, moderator, and support grants", () => {
    expect(authorize({ ...context, room: { ...context.room!, isSpectator: true } }, { operation: "VIEW_SPECTATOR_PROJECTION" })).toEqual({ allowed: true });
    expect(authorize(context, { operation: "VIEW_SPECTATOR_PROJECTION" })).toMatchObject({ code: "NOT_MEMBER" });
    expect(authorize({ ...context, roles: ["SYSTEM_BOT"], session: { ...context.session!, control: "BOT" } }, { operation: "SUBMIT_BOT_ACTION", suppliedPlayerId: "player-1" })).toEqual({ allowed: true });
    expect(authorize(context, { operation: "SUBMIT_BOT_ACTION", suppliedPlayerId: "player-1" })).toMatchObject({ code: "CONTROL_MISMATCH" });
    expect(authorize({ ...context, session: { ...context.session!, control: "BOT" } }, { operation: "SUBMIT_GAME_ACTION", suppliedPlayerId: "player-1" })).toMatchObject({ code: "CONTROL_MISMATCH" });
    expect(authorize({ ...context, roles: ["MODERATOR"], session: { ...context.session!, moderatorGrant: true } }, { operation: "VIEW_MODERATOR_PROJECTION" })).toEqual({ allowed: true });
    expect(authorize({ ...context, roles: ["MODERATOR"] }, { operation: "VIEW_MODERATOR_PROJECTION" })).toMatchObject({ code: "MISSING_GRANT" });
    expect(authorize({ ...context, roles: ["SUPPORT"] }, { operation: "VIEW_SUPPORT_DIAGNOSTICS" })).toEqual({ allowed: true });
    expect(authorize(context, { operation: "VIEW_SUPPORT_DIAGNOSTICS" })).toMatchObject({ code: "MISSING_GRANT" });
  });
});

type SecretState = { players: Record<string, { role: string; team: string }>; publicRound: number };
const state: SecretState = { players: { p1: { role: "READER", team: "DAWN" }, p2: { role: "PROWLER", team: "DUSK" } }, publicRound: 2 };
const adapter: GameProjectionAdapter<SecretState> = {
  player: (source, playerId) => ({ round: source.publicRound, ownRole: source.players[playerId]!.role }),
  opponent: (source, _recipient, subject) => ({ round: source.publicRound, opponentId: subject }),
  teammate: (source, playerId) => ({ round: source.publicRound, team: source.players[playerId]!.team, teammateIds: [] }),
  spectator: (source) => ({ round: source.publicRound }),
  moderator: (source) => ({ round: source.publicRound, roles: Object.fromEntries(Object.entries(source.players).map(([id, player]) => [id, player.role])) })
};

describe("projection authorization", () => {
  it("returns only the adapter projection for the granted recipient mode", () => {
    const service = new ProjectionService();
    const grant = { identityId: "i1", playerId: "p1", modes: ["PLAYER", "OPPONENT", "TEAMMATE"] as const };
    const player = service.project(state, { identityId: "i1", mode: "PLAYER", playerId: "p1" }, grant, adapter) as { ownRole: string };
    expect(player).toEqual({ round: 2, ownRole: "READER" });
    expect(JSON.stringify(player)).not.toContain("PROWLER");
    expect(service.project(state, { identityId: "i1", mode: "OPPONENT", playerId: "p1", subjectPlayerId: "p2" }, grant, adapter)).toEqual({ round: 2, opponentId: "p2" });
    expect(service.project(state, { identityId: "i1", mode: "TEAMMATE", playerId: "p1" }, grant, adapter)).toEqual({ round: 2, team: "DAWN", teammateIds: [] });
    player.ownRole = "mutated";
    expect(state.players.p1!.role).toBe("READER");
  });

  it("fails closed for identity, mode, seat, opponent, and moderator mismatches", () => {
    const service = new ProjectionService();
    const playerGrant = { identityId: "i1", playerId: "p1", modes: ["PLAYER", "OPPONENT"] as const };
    expect(() => service.project(state, { identityId: "i2", mode: "PLAYER", playerId: "p1" }, playerGrant, adapter)).toThrow("ACCESS_DENIED");
    expect(() => service.project(state, { identityId: "i1", mode: "SPECTATOR" }, playerGrant, adapter)).toThrow("ACCESS_DENIED");
    expect(() => service.project(state, { identityId: "i1", mode: "PLAYER", playerId: "p2" }, playerGrant, adapter)).toThrow("ACCESS_DENIED");
    expect(() => service.project(state, { identityId: "i1", mode: "OPPONENT", playerId: "p1", subjectPlayerId: "p1" }, playerGrant, adapter)).toThrow("ACCESS_DENIED");
    expect(service.project(state, { identityId: "spectator", mode: "SPECTATOR" }, { identityId: "spectator", modes: ["SPECTATOR"] }, adapter)).toEqual({ round: 2 });
    expect(service.project(state, { identityId: "mod", mode: "MODERATOR" }, { identityId: "mod", modes: ["MODERATOR"] }, adapter)).toMatchObject({ roles: { p2: "PROWLER" } });
  });
});
