import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/app.module";
import { RuntimeConfigService } from "../../src/config/environment";
import { PrismaService } from "../../src/prisma/prisma.service";

const runtime = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;
const origin = "http://localhost:3000";
type Identity = { token: string; csrf: string; refresh: string; agent: ReturnType<typeof request.agent> };

const cookieValue = (headers: string[] | string | undefined, name: string): string => {
  const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
  const pair = values.map((header) => header.split(";", 1)[0]!).find((entry) => entry.startsWith(`${name}=`));
  if (!pair) throw new Error(`Missing ${name} cookie`);
  return decodeURIComponent(pair.slice(name.length + 1));
};

runtime("Phase 10 production runtime integration", () => {
  let app: INestApplication; let prisma: PrismaService; let host: Identity; let guest: Identity;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== "test" || !process.env.DATABASE_URL?.includes("game_store")) throw new Error("Integration tests require an explicit game_store test database");
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.use(cookieParser()); app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }));
    await app.init(); prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "OutboxEvent", "AuditLog", "UserAchievement", "Achievement", "Ranking", "ResultParticipant", "GameResult", "ReconnectSession", "IdempotencyRecord", "GameCommand", "GameEvent", "GameSnapshot", "GameSeat", "GameSession", "MatchmakingTicket", "Invitation", "RoomMember", "Room", "AuthSession", "Profile", "User" CASCADE');
  });
  afterAll(async () => { await app?.close(); });

  const register = async (email: string, displayName: string): Promise<Identity> => {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post("/api/v1/auth/register").set("Origin", origin).send({ email, password: "correct-horse-battery-staple", displayName }).expect(201);
    const names = app.get(RuntimeConfigService);
    return { token: response.body.accessToken as string, csrf: cookieValue(response.headers["set-cookie"], names.get("CSRF_COOKIE_NAME")), refresh: cookieValue(response.headers["set-cookie"], names.get("REFRESH_COOKIE_NAME")), agent };
  };

  it("enforces validation, CORS, authorization, refresh rotation, and replay revocation", async () => {
    host = await register("host@example.test", "Host"); guest = await register("guest@example.test", "Guest");
    const replacementHost = await register("host-two@example.test", "Host Two");
    await request(app.getHttpServer()).post("/api/v1/rooms").send({ capacity: 2 }).expect(401);
    await request(app.getHttpServer()).post("/api/v1/rooms").set("Authorization", `Bearer ${replacementHost.token}`).send({ capacity: 2, hostIdentityId: "spoofed-admin" }).expect(400);
    await request(app.getHttpServer()).post("/api/v1/auth/login").set("Origin", origin).send({ email: "' OR 1=1 --", password: "x" }).expect(400);
    const preflight = await request(app.getHttpServer()).options("/api/v1/auth/refresh").set("Origin", origin).set("Access-Control-Request-Method", "POST");
    expect(preflight.headers["access-control-allow-origin"]).toBe(origin);

    const oldCookie = `gs_refresh=${encodeURIComponent(host.refresh)}; gs_csrf=${encodeURIComponent(host.csrf)}`;
    const rotated = await host.agent.post("/api/v1/auth/refresh").set("Origin", origin).set("x-csrf-token", host.csrf).expect(201);
    const rotatedAccess = rotated.body.accessToken as string;
    await request(app.getHttpServer()).post("/api/v1/auth/refresh").set("Origin", origin).set("x-csrf-token", host.csrf).set("Cookie", oldCookie).expect(401);
    await request(app.getHttpServer()).post("/api/v1/rooms").set("Authorization", `Bearer ${rotatedAccess}`).send({ capacity: 2 }).expect(401);
    host = replacementHost;
  });

  it("persists a room and executes one concurrent duplicate action exactly once", async () => {
    const created = await request(app.getHttpServer()).post("/api/v1/rooms").set("Authorization", `Bearer ${host.token}`).send({ gameSlug: "color-clash", capacity: 2 }).expect(201);
    const code = created.body.roomCode as string;
    const joined = await request(app.getHttpServer()).post(`/api/v1/rooms/${code}/join`).set("Authorization", `Bearer ${guest.token}`).send({ displayName: "Guest" }).expect(201);
    let version = joined.body.version as number;
    const hostReady = await request(app.getHttpServer()).post(`/api/v1/rooms/${code}/ready`).set("Authorization", `Bearer ${host.token}`).send({ ready: true, expectedRoomVersion: version }).expect(201); version = hostReady.body.version;
    const guestReady = await request(app.getHttpServer()).post(`/api/v1/rooms/${code}/ready`).set("Authorization", `Bearer ${guest.token}`).send({ ready: true, expectedRoomVersion: version }).expect(201); version = guestReady.body.version;
    const started = await request(app.getHttpServer()).post(`/api/v1/rooms/${code}/start`).set("Authorization", `Bearer ${host.token}`).send({ expectedRoomVersion: version }).expect(201);
    const gameSessionId = started.body.gameSessionId as string;

    const seats = await prisma.gameSeat.findMany({ where: { gameSessionId } });
    const currentId = started.body.projection.currentPlayerId as string; const currentSeat = seats.find((seat) => seat.playerId === currentId)!;
    const identity = currentSeat.identityId === (await prisma.user.findUniqueOrThrow({ where: { normalizedEmail: "host-two@example.test" } })).id ? host : guest;
    const snapshot = await request(app.getHttpServer()).get(`/api/v1/games/${gameSessionId}/snapshot`).set("Authorization", `Bearer ${identity.token}`).expect(200);
    const command = { protocolVersion: 1, requestId: "duplicate-action-1", playerId: currentId, expectedStateVersion: snapshot.body.stateVersion, sentAt: new Date().toISOString(), action: snapshot.body.projection.legalActions[0] };
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/games/${gameSessionId}/actions`).set("Authorization", `Bearer ${identity.token}`).send(command).expect(201),
      request(app.getHttpServer()).post(`/api/v1/games/${gameSessionId}/actions`).set("Authorization", `Bearer ${identity.token}`).send(command).expect(201)
    ]);
    expect(first.body).toEqual(second.body); expect(first.body.accepted).toBe(true);
    expect(await prisma.gameCommand.count({ where: { gameSessionId, requestId: command.requestId } })).toBe(1);
    expect((await prisma.gameSession.findUniqueOrThrow({ where: { id: gameSessionId } })).stateVersion).toBe(command.expectedStateVersion + 1);

    const after = await request(app.getHttpServer()).get(`/api/v1/games/${gameSessionId}/snapshot`).set("Authorization", `Bearer ${host.token}`).expect(200);
    const nextSeat = seats.find((seat) => seat.playerId === after.body.projection.currentPlayerId)!; const nextIdentity = nextSeat.identityId === currentSeat.identityId ? identity : identity === host ? guest : host;
    const nextSnapshot = await request(app.getHttpServer()).get(`/api/v1/games/${gameSessionId}/snapshot`).set("Authorization", `Bearer ${nextIdentity.token}`).expect(200);
    const stale = await request(app.getHttpServer()).post(`/api/v1/games/${gameSessionId}/actions`).set("Authorization", `Bearer ${nextIdentity.token}`).send({ ...command, requestId: "stale-action-1", playerId: nextSeat.playerId, expectedStateVersion: nextSnapshot.body.stateVersion - 1, action: nextSnapshot.body.projection.legalActions[0] }).expect(201);
    expect(stale.body).toMatchObject({ accepted: false, rejectionCode: "STALE_VERSION", snapshotRequired: true });

    const grant = await request(app.getHttpServer()).post(`/api/v1/games/${gameSessionId}/reconnect-grants`).set("Authorization", `Bearer ${host.token}`).expect(201);
    const reconnected = await request(app.getHttpServer()).post("/api/v1/games/reconnect").set("Authorization", `Bearer ${host.token}`).send({ reconnectToken: grant.body.reconnectToken }).expect(201);
    expect(reconnected.body.snapshot.gameSessionId).toBe(gameSessionId);
    await request(app.getHttpServer()).post("/api/v1/games/reconnect").set("Authorization", `Bearer ${host.token}`).send({ reconnectToken: grant.body.reconnectToken }).expect(401);
  });
});
