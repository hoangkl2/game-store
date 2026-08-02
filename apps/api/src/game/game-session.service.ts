import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { IdempotencyStatus, Prisma } from "@prisma/client";
import { hashCanonicalAction } from "@game-store/backend-core";
import { SeededRandomProvider } from "@game-store/game-core";
import { UnoEngine } from "@game-store/game-uno";
import type { GameActionResult } from "@game-store/realtime-core";
import { randomUUID } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { MetricsService } from "../observability/metrics.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import type { GameActionDto } from "./game.dto";
import { GameProjectionService } from "./game-projection.service";
import { PrismaIdempotencyRepository } from "./prisma-idempotency.repository";
import { StateCipherService } from "./state-cipher.service";
import { AuthoritativeStateService } from "./authoritative-state.service";
import { isColorClashAction } from "./color-clash-action";

type SafeEvent = Record<string, unknown>;
type StoredActionResult = GameActionResult<SafeEvent> & Record<string, unknown>;
const retrySerializable = async <T>(operation: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation(); }
    catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") || attempt >= 2) throw error; }
  }
};

@Injectable()
export class GameSessionService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly idempotency: PrismaIdempotencyRepository, private readonly cipher: StateCipherService, private readonly authoritativeState: AuthoritativeStateService, private readonly projections: GameProjectionService, private readonly metrics: MetricsService, private readonly audit: AuditService) {}
  private async reject(key: { gameSessionId: string; identityId: string; requestId: string }, ownerToken: string, stateVersion: number, code: string, snapshotRequired = false): Promise<StoredActionResult> {
    const result: StoredActionResult = { protocolVersion: 1, requestId: key.requestId, accepted: false, gameSessionId: key.gameSessionId, stateVersion, rejectionCode: code, snapshotRequired };
    await this.idempotency.complete(key, ownerToken, { accepted: false, resultingStateVersion: stateVersion, result, completedAt: new Date().toISOString() }); this.metrics.actions.inc({ outcome: code.toLowerCase() }); return result;
  }
  async submit(identityId: string, gameSessionId: string, command: GameActionDto): Promise<StoredActionResult> {
    const started = performance.now(); const ownerToken = `${process.pid}:${randomUUID()}`; const key = { gameSessionId, identityId, requestId: command.requestId };
    const boundSeat = await this.prisma.gameSeat.findUnique({ where: { gameSessionId_identityId: { gameSessionId, identityId } }, select: { playerId: true, control: true } });
    if (!boundSeat || boundSeat.playerId !== command.playerId || boundSeat.control !== "HUMAN") {
      await this.audit.record({ action: "game.action", outcome: "DENIED", actorId: identityId, resourceType: "game-session", resourceId: gameSessionId, metadata: { reason: "seat_mismatch" } });
      this.metrics.actions.inc({ outcome: "unauthorized" });
      return { protocolVersion: 1, requestId: command.requestId, accepted: false, gameSessionId, stateVersion: 0, rejectionCode: "UNAUTHORIZED" };
    }
    const claim = await this.idempotency.claim({ ...key, actionHash: hashCanonicalAction({ protocolVersion: command.protocolVersion, playerId: command.playerId, expectedStateVersion: command.expectedStateVersion, action: command.action }), ownerToken, now: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
    if (claim.kind === "COLLISION") { this.metrics.actions.inc({ outcome: "collision" }); return { protocolVersion: 1, requestId: command.requestId, accepted: false, gameSessionId, stateVersion: claim.record.resultingStateVersion ?? 0, rejectionCode: "REQUEST_ID_COLLISION" }; }
    if (claim.kind === "DUPLICATE") return claim.record.result as StoredActionResult;
    if (claim.kind === "IN_FLIGHT") { const result = await this.idempotency.waitForCompletion(key); if (result) { this.metrics.actions.inc({ outcome: "duplicate" }); return result as StoredActionResult; } throw new ServiceUnavailableException("Original request is still processing"); }
    const lockOwner = await this.redis.acquireLock(`game:${gameSessionId}:action`, 15_000);
    if (!lockOwner) return this.reject(key, ownerToken, command.expectedStateVersion, "COORDINATION_UNAVAILABLE");
    try {
      let ownerEpoch: number;
      try {
        ownerEpoch = (await this.prisma.gameSession.update({ where: { id: gameSessionId }, data: { ownerEpoch: { increment: 1 } }, select: { ownerEpoch: true } })).ownerEpoch;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return this.reject(key, ownerToken, 0, "SESSION_NOT_FOUND");
        throw error;
      }
      const session = await this.prisma.gameSession.findUnique({ where: { id: gameSessionId }, include: { seats: true, snapshots: { where: { quarantinedAt: null }, orderBy: { stateVersion: "desc" }, take: 50 } } });
      if (!session || !session.snapshots[0]) return this.reject(key, ownerToken, 0, "SESSION_NOT_FOUND");
      const seat = session.seats.find((candidate) => candidate.identityId === identityId);
      if (!seat || seat.playerId !== command.playerId || seat.control !== "HUMAN") { await this.audit.record({ action: "game.action", outcome: "DENIED", actorId: identityId, resourceType: "game-session", resourceId: gameSessionId, metadata: { reason: "seat_mismatch" } }); return this.reject(key, ownerToken, session.stateVersion, "UNAUTHORIZED"); }
      if (session.status !== "ACTIVE") return this.reject(key, ownerToken, session.stateVersion, "SESSION_CLOSED");
      if (session.stateVersion !== command.expectedStateVersion) return this.reject(key, ownerToken, session.stateVersion, "STALE_VERSION", true);
      if (!isColorClashAction(command.action) || command.action.playerId !== seat.playerId) return this.reject(key, ownerToken, session.stateVersion, "MALFORMED_COMMAND");
      const engine = new UnoEngine(new SeededRandomProvider(Number(session.randomSeed))); const state = await this.authoritativeState.loadColorClash(session.id, Number(session.randomSeed), session.stateVersion, session.snapshots);
      const validation = engine.validateAction(state, command.action); if (!validation.valid) return this.reject(key, ownerToken, session.stateVersion, "INVALID_ACTION");
      const transition = engine.reduce(state, command.action); const nextVersion = session.stateVersion + 1; let sequence = session.eventSequence;
      const safeEvents = transition.events.map((event) => { sequence += 1; return { eventId: `${gameSessionId}:${sequence}`, sequenceNumber: sequence, gameSessionId, stateVersion: nextVersion, type: event.type, occurredAt: new Date().toISOString(), payload: this.projections.publicColorClashEvent(event) }; });
      const protectedState = this.cipher.encrypt(engine.serialize(transition.state)); const nextSnapshotId = randomUUID();
      const protectedAction = this.cipher.encrypt(JSON.stringify(command.action));
      const result: StoredActionResult = { protocolVersion: 1, requestId: command.requestId, accepted: true, gameSessionId, stateVersion: nextVersion, events: safeEvents };
      await retrySerializable(() => this.prisma.$transaction(async (transaction) => {
        const changed = await transaction.gameSession.updateMany({ where: { id: gameSessionId, status: "ACTIVE", stateVersion: session.stateVersion, ownerEpoch }, data: { stateVersion: nextVersion, eventSequence: sequence, latestSnapshotId: nextSnapshotId, currentTurnPlayerId: transition.state.players[transition.state.currentPlayerIndex]!.id, turnStartedAt: new Date(), status: transition.state.phase === "FINISHED" ? "FINISHED" : "ACTIVE", finishedAt: transition.state.phase === "FINISHED" ? new Date() : undefined } });
        if (changed.count !== 1) throw new ConflictException("STALE_VERSION");
        await transaction.gameSnapshot.create({ data: { id: nextSnapshotId, gameSessionId, gameVersion: transition.state.gameVersion, stateVersion: nextVersion, eventSequence: sequence, projectionVersion: 1, encryptedPayload: protectedState.encryptedPayload, checksum: protectedState.checksum, reason: transition.state.phase === "FINISHED" ? "TERMINAL" : "ACTION" } });
        await transaction.gameCommand.create({ data: { gameSessionId, stateVersion: nextVersion, requestId: command.requestId, actorPlayerId: seat.playerId, encryptedPayload: protectedAction.encryptedPayload, checksum: protectedAction.checksum } });
        for (let index = 0; index < transition.events.length; index += 1) { const event = transition.events[index]!; const encrypted = this.cipher.encrypt(JSON.stringify(event)); await transaction.gameEvent.create({ data: { gameSessionId, sequence: session.eventSequence + index + 1, resultingStateVersion: nextVersion, eventType: event.type, requestId: command.requestId, actorPlayerId: seat.playerId, encryptedPayload: encrypted.encryptedPayload } }); }
        const completed = await transaction.idempotencyRecord.updateMany({ where: { gameSessionId, identityId, requestId: command.requestId, ownerToken, status: IdempotencyStatus.PROCESSING }, data: { status: IdempotencyStatus.COMPLETED, accepted: true, resultingStateVersion: nextVersion, response: result as unknown as Prisma.InputJsonValue, completedAt: new Date() } });
        if (completed.count !== 1) throw new Error("IDEMPOTENCY_OWNERSHIP_LOST");
        await transaction.outboxEvent.create({ data: { aggregateType: "game-session", aggregateId: gameSessionId, aggregateVersion: nextVersion, eventType: "game.state.committed", payload: { gameSessionId, stateVersion: nextVersion } } });
        await transaction.auditLog.create({ data: { action: "game.action", outcome: "SUCCESS", actorId: identityId, resourceType: "game-session", resourceId: gameSessionId, metadata: { stateVersion: nextVersion } } });
        if (transition.state.phase === "FINISHED") {
          const winnerPlayerId = transition.state.winnerId; if (!winnerPlayerId) throw new Error("TERMINAL_STATE_WITHOUT_WINNER");
          const durationSeconds = Math.max(0, Math.floor((Date.now() - (session.startedAt?.getTime() ?? session.createdAt.getTime())) / 1000));
          await transaction.gameResult.create({ data: { gameSessionId, gameType: session.gameType, winnerPlayerId, completionReason: "COMPLETED", durationSeconds, rulePreset: "standard", statistics: { turns: transition.state.turnNumber }, participants: { create: session.seats.map((participant) => ({ userId: participant.userId, playerId: participant.playerId, rank: participant.playerId === winnerPlayerId ? 1 : 2, control: participant.control })) } } });
          await transaction.gameSeat.updateMany({ where: { gameSessionId, playerId: winnerPlayerId }, data: { finalRank: 1 } });
          await transaction.gameSeat.updateMany({ where: { gameSessionId, playerId: { not: winnerPlayerId } }, data: { finalRank: 2 } });
          if (session.roomId) await transaction.room.update({ where: { id: session.roomId }, data: { status: "FINISHED", version: { increment: 1 } } });
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
      this.metrics.actions.inc({ outcome: "accepted" }); return result;
    } catch (error) {
      if (error instanceof ConflictException) return this.reject(key, ownerToken, command.expectedStateVersion, "STALE_VERSION", true);
      throw error;
    } finally { await this.redis.releaseLock(`game:${gameSessionId}:action`, lockOwner).catch(() => false); this.metrics.actionDuration.observe({ game: "color_clash", outcome: "complete" }, (performance.now() - started) / 1000); }
  }
  async snapshot(identityId: string, gameSessionId: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { id: gameSessionId }, include: { seats: true, snapshots: { where: { quarantinedAt: null }, orderBy: { stateVersion: "desc" }, take: 50 } } });
    if (!session || !session.snapshots[0]) throw new NotFoundException("Game session not found"); const seat = session.seats.find((candidate) => candidate.identityId === identityId); if (!seat) throw new ForbiddenException("Game session access denied");
    const state = await this.authoritativeState.loadColorClash(session.id, Number(session.randomSeed), session.stateVersion, session.snapshots);
    return { protocolVersion: 1, gameSessionId, stateVersion: session.stateVersion, serverTime: new Date().toISOString(), recipient: { type: "PLAYER", playerId: seat.playerId }, projection: this.projections.colorClash(state, { mode: "PLAYER", playerId: seat.playerId }), status: session.status, lastEventSequence: session.eventSequence };
  }
  async result(identityId: string, gameSessionId: string) {
    const seat = await this.prisma.gameSeat.findUnique({ where: { gameSessionId_identityId: { gameSessionId, identityId } } }); if (!seat) throw new NotFoundException("Result not found");
    return this.prisma.gameResult.findUnique({ where: { gameSessionId }, include: { participants: true } });
  }
}
