import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { hashOpaqueToken, issueOpaqueToken } from "@game-store/backend-core";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { MetricsService } from "../observability/metrics.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { GameSessionService } from "./game-session.service";

@Injectable()
export class ReconnectService {
  constructor(private readonly prisma: PrismaService, private readonly games: GameSessionService, private readonly metrics: MetricsService, private readonly audit: AuditService, private readonly redis: RedisService) {}
  async issue(identityId: string, gameSessionId: string) {
    const seat = await this.prisma.gameSeat.findUnique({ where: { gameSessionId_identityId: { gameSessionId, identityId } } }); if (!seat) throw new ForbiddenException("Reconnect access denied");
    const id = randomUUID(); const secret = issueOpaqueToken(); const token = `${id}.${secret}`;
    await this.prisma.reconnectSession.create({ data: { id, gameSessionId, identityId, playerId: seat.playerId, controlEpoch: seat.controlEpoch, tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + 30_000) } });
    await this.redis.setReconnectGrace(identityId, gameSessionId, 60);
    return { reconnectToken: token, expiresAt: new Date(Date.now() + 30_000).toISOString() };
  }
  async consume(identityId: string, token: string) {
    const id = token.slice(0, token.indexOf(".")); const hash = hashOpaqueToken(token);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.reconnectSession.findUnique({ where: { id } });
      if (!current || current.identityId !== identityId || current.status !== "ACTIVE" || current.expiresAt <= new Date() || hash.length !== current.tokenHash.length || !timingSafeEqual(Buffer.from(hash), Buffer.from(current.tokenHash))) throw new UnauthorizedException("Reconnect grant expired or revoked");
      const seat = await transaction.gameSeat.findUnique({ where: { gameSessionId_identityId: { gameSessionId: current.gameSessionId, identityId } } }); if (!seat || seat.controlEpoch !== current.controlEpoch || seat.control !== "HUMAN") throw new UnauthorizedException("Reconnect seat changed");
      const nextId = randomUUID(); const secret = issueOpaqueToken(); const nextToken = `${nextId}.${secret}`;
      const consumed = await transaction.reconnectSession.updateMany({ where: { id: current.id, status: "ACTIVE" }, data: { status: "CONSUMED", consumedAt: new Date(), replacedById: nextId } }); if (consumed.count !== 1) throw new UnauthorizedException("Reconnect grant already consumed");
      await transaction.reconnectSession.create({ data: { id: nextId, gameSessionId: current.gameSessionId, identityId, playerId: current.playerId, controlEpoch: current.controlEpoch, tokenHash: hashOpaqueToken(nextToken), expiresAt: new Date(Date.now() + 30_000), lastEventSequence: current.lastEventSequence } });
      return { gameSessionId: current.gameSessionId, reconnectToken: nextToken };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const snapshot = await this.games.snapshot(identityId, rotated.gameSessionId); this.metrics.reconnects.inc({ outcome: "success" }); await this.audit.record({ action: "game.reconnect", outcome: "SUCCESS", actorId: identityId, resourceType: "game-session", resourceId: rotated.gameSessionId }); return { ...rotated, snapshot };
  }
}
