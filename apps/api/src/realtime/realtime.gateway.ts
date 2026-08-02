import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { RATE_LIMIT_POLICIES, type RateLimitScope } from "@game-store/backend-core";
import { createHmac } from "node:crypto";
import type { Namespace, Socket } from "socket.io";
import { AuthTokenService } from "../auth/auth-token.service";
import type { AuthPrincipal } from "../auth/auth.types";
import { RuntimeConfigService } from "../config/environment";
import { GameSessionService } from "../game/game-session.service";
import { OUTBOX_COMMITTED_EVENT } from "../game/outbox.service";
import { ReconnectService } from "../game/reconnect.service";
import { MetricsService } from "../observability/metrics.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { RoomService } from "../rooms/room.service";

interface AuthenticatedSocketData { principal: AuthPrincipal; accessToken: string }
type AuthenticatedSocket = Socket & { data: AuthenticatedSocketData };
type Ack = (result: unknown) => void;

@Injectable()
@WebSocketGateway({ namespace: "/platform", transports: ["websocket", "polling"], maxHttpBufferSize: 65_536, pingInterval: 25_000, pingTimeout: 20_000 })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Namespace;

  constructor(
    private readonly tokens: AuthTokenService,
    private readonly config: RuntimeConfigService,
    private readonly redis: RedisService,
    private readonly rooms: RoomService,
    private readonly games: GameSessionService,
    private readonly reconnect: ReconnectService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService
  ) {}

  afterInit(server: Namespace): void {
    server.use(async (client, next) => {
      try {
      const origin = client.handshake.headers.origin;
      if (!origin || !this.config.get("CORS_ORIGINS").includes(origin)) throw new Error("Origin rejected");
      const candidate = client.handshake.auth.accessToken;
      if (typeof candidate !== "string" || candidate.length > 4096) throw new Error("Authentication required");
      const principal = await this.tokens.verify(candidate);
        client.data = { principal, accessToken: candidate } satisfies AuthenticatedSocketData;
        next();
      } catch { next(new Error("AUTHENTICATION_FAILED")); }
    });
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    await client.join(`identity:${client.data.principal.identityId}`);
    await this.redis.setPresence(client.data.principal.identityId);
    this.metrics.socketConnections.inc();
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.data.principal) this.metrics.socketConnections.dec();
  }

  @SubscribeMessage("room:v1:subscribe")
  async subscribeRoom(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown, ack?: Ack): Promise<void> {
    await this.respond(ack, async () => {
      const principal = await this.authenticateEvent(client); await this.socketLimit(principal, "SPECTATOR_JOIN"); this.assertPayloadSize(body);
      const code = this.requiredString(body, "roomCode", 16).toUpperCase();
      const room = await this.rooms.getByCode(code, principal.identityId);
      await client.join(`room:${room.roomId}`);
      return { event: "room:v1:snapshot", room };
    });
  }

  @SubscribeMessage("game:v1:subscribe")
  async subscribeGame(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown, ack?: Ack): Promise<void> {
    await this.respond(ack, async () => {
      const principal = await this.authenticateEvent(client); await this.socketLimit(principal, "SNAPSHOT"); this.assertPayloadSize(body);
      const gameSessionId = this.requiredString(body, "gameSessionId", 128);
      const snapshot = await this.games.snapshot(principal.identityId, gameSessionId);
      await client.join(this.playerChannel(gameSessionId, principal.identityId));
      return { event: "game:v1:snapshot", snapshot };
    });
  }

  @SubscribeMessage("game:v1:action")
  async submitAction(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown, ack?: Ack): Promise<void> {
    await this.respond(ack, async () => {
      const principal = await this.authenticateEvent(client); await this.socketLimit(principal, "GAME_ACTION_BURST"); this.assertPayloadSize(body);
      const payload = this.requiredRecord(body);
      const gameSessionId = this.requiredString(payload, "gameSessionId", 128);
      const command = this.requiredRecord(payload.command);
      this.validateGameCommand(command);
      return this.games.submit(principal.identityId, gameSessionId, command as never);
    });
  }

  @SubscribeMessage("game:v1:reconnect")
  async reconnectGame(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown, ack?: Ack): Promise<void> {
    await this.respond(ack, async () => {
      const principal = await this.authenticateEvent(client); await this.socketLimit(principal, "RECONNECT"); this.assertPayloadSize(body);
      const token = this.requiredString(body, "reconnectToken", 256);
      const result = await this.reconnect.consume(principal.identityId, token);
      await client.join(this.playerChannel(result.gameSessionId, principal.identityId));
      return { event: "game:v1:reconnected", ...result };
    });
  }

  @SubscribeMessage("system:v1:ping")
  async ping(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown, ack?: Ack): Promise<void> {
    await this.respond(ack, async () => { const principal = await this.authenticateEvent(client); this.assertPayloadSize(body); await this.redis.setPresence(principal.identityId); return { event: "system:v1:pong", serverTime: new Date().toISOString() }; });
  }

  @OnEvent(OUTBOX_COMMITTED_EVENT)
  async publishCommitted(event: { eventType: string; aggregateId: string }): Promise<void> {
    if (!event.eventType.startsWith("game.")) return;
    const seats = await this.prisma.gameSeat.findMany({ where: { gameSessionId: event.aggregateId }, select: { identityId: true } });
    await Promise.all(seats.map(async ({ identityId }) => {
      try {
        const snapshot = await this.games.snapshot(identityId, event.aggregateId);
        this.server.to(this.playerChannel(event.aggregateId, identityId)).emit("game:v1:snapshot", snapshot);
      } catch { this.metrics.projectionFailures.inc(); }
    }));
  }

  private playerChannel(gameSessionId: string, identityId: string): string { return `game:${gameSessionId}:identity:${identityId}`; }
  private requiredRecord(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_PAYLOAD"); return value as Record<string, unknown>; }
  private requiredString(value: unknown, key: string, maximum: number): string { const candidate = this.requiredRecord(value)[key]; if (typeof candidate !== "string" || candidate.length < 1 || candidate.length > maximum) throw new Error("INVALID_PAYLOAD"); return candidate; }
  private assertPayloadSize(value: unknown): void { if (Buffer.byteLength(JSON.stringify(value), "utf8") > this.config.get("MAX_SOCKET_PAYLOAD_BYTES")) throw new Error("PAYLOAD_TOO_LARGE"); }
  private validateGameCommand(command: Record<string, unknown>): void {
    if (command.protocolVersion !== 1 || typeof command.requestId !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(command.requestId) || typeof command.playerId !== "string" || !Number.isInteger(command.expectedStateVersion) || Number(command.expectedStateVersion) < 0 || typeof command.sentAt !== "string" || !Number.isFinite(Date.parse(command.sentAt)) || !command.action || typeof command.action !== "object" || Array.isArray(command.action)) throw new Error("INVALID_COMMAND");
  }
  private async authenticateEvent(client: AuthenticatedSocket): Promise<AuthPrincipal> { const principal = await this.tokens.verify(client.data.accessToken); client.data.principal = principal; return principal; }
  private async socketLimit(principal: AuthPrincipal, scope: RateLimitScope): Promise<void> {
    const policy = RATE_LIMIT_POLICIES[scope]; const material = `${principal.identityId}:${principal.sessionId}`;
    const key = createHmac("sha256", this.config.get("ACCESS_TOKEN_SECRET")).update(material).digest("base64url");
    try { if (await this.redis.incrementWindow(`ratelimit:${scope}:identity-session:${key}`, policy.windowSeconds) > policy.limit) throw new HttpException({ code: "RATE_LIMITED", retryAfterSeconds: policy.windowSeconds }, HttpStatus.TOO_MANY_REQUESTS); }
    catch (error) { if (error instanceof HttpException) throw error; throw new HttpException({ code: "COORDINATION_UNAVAILABLE" }, HttpStatus.SERVICE_UNAVAILABLE); }
  }
  private async respond(ack: Ack | undefined, operation: () => Promise<unknown>): Promise<void> {
    try { ack?.({ ok: true, data: await operation() }); }
    catch (error) {
      const safeCodes = new Set(["INVALID_PAYLOAD", "INVALID_COMMAND", "PAYLOAD_TOO_LARGE"]);
      const response = error instanceof HttpException ? error.getResponse() : undefined;
      const code = typeof response === "object" && response && "code" in response ? String(response.code) : error instanceof Error && safeCodes.has(error.message) ? error.message : error instanceof HttpException ? "REQUEST_REJECTED" : "INTERNAL_ERROR";
      ack?.({ ok: false, error: { code } });
    }
  }
}
