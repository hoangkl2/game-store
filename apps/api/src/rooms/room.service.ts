import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RoomStatus } from "@prisma/client";
import { SeededRandomProvider } from "@game-store/game-core";
import { UNO_GAME_VERSION, UnoEngine } from "@game-store/game-uno";
import { randomBytes, randomUUID } from "node:crypto";
import { GameProjectionService } from "../game/game-projection.service";
import { StateCipherService } from "../game/state-cipher.service";
import { PrismaService } from "../prisma/prisma.service";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const roomCode = () => [...randomBytes(8)].map((value) => alphabet[value % alphabet.length]).join("");

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService, private readonly cipher: StateCipherService, private readonly projections: GameProjectionService) {}
  private normalizeCode(code: string): string { const normalized = code.toUpperCase(); if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalized)) throw new NotFoundException("Room not found"); return normalized; }
  private safeRoom(room: { id: string; normalizedCode: string; gameSlug: string; status: string; hostIdentityId: string; settings: Prisma.JsonValue; version: number; capacity: number; expiresAt: Date; members: Array<{ identityId: string; playerId: string; displayName: string; seatIndex: number; role: string; control: string; ready: boolean; connected: boolean }> }) {
    return { roomId: room.id, roomCode: room.normalizedCode, gameSlug: room.gameSlug, status: room.status, hostIdentityId: room.hostIdentityId, settings: room.settings, version: room.version, capacity: room.capacity, expiresAt: room.expiresAt.toISOString(), members: room.members.map((member) => ({ playerId: member.playerId, displayName: member.displayName, seatIndex: member.seatIndex, role: member.role, control: member.control, ready: member.ready, connected: member.connected, isHost: member.identityId === room.hostIdentityId })) };
  }
  async create(userId: string, capacity: number) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } }); if (!profile) throw new NotFoundException("Profile unavailable");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const room = await this.prisma.$transaction(async (transaction) => {
          const created = await transaction.room.create({ data: { normalizedCode: roomCode(), gameSlug: "color-clash", hostIdentityId: userId, capacity, expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), settings: { cardsPerPlayer: 7, ruleConfigVersion: 1 }, members: { create: { userId, identityId: userId, playerId: `player-${userId}`, displayName: profile.displayName, seatIndex: 0, role: "HOST", connected: true } } }, include: { members: true } });
          await transaction.auditLog.create({ data: { action: "room.create", outcome: "SUCCESS", actorId: userId, resourceType: "room", resourceId: created.id } });
          return created;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return this.safeRoom(room);
      } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || attempt === 2) throw error; }
    }
    throw new ConflictException("Room code allocation failed");
  }
  async getByCode(code: string, identityId: string) {
    const room = await this.prisma.room.findUnique({ where: { normalizedCode: this.normalizeCode(code) }, include: { members: true } });
    if (!room || !room.members.some((member) => member.identityId === identityId)) throw new NotFoundException("Room not found");
    return this.safeRoom(room);
  }
  async join(code: string, userId: string, displayName: string) {
    const room = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.room.findUnique({ where: { normalizedCode: this.normalizeCode(code) }, include: { members: true } });
      if (!current || current.status !== RoomStatus.WAITING || current.expiresAt <= new Date()) throw new NotFoundException("Room not available");
      const existing = current.members.find((member) => member.identityId === userId); if (existing) return current;
      if (current.members.filter((member) => member.role !== "SPECTATOR").length >= current.capacity) throw new ConflictException("Room is full");
      const used = new Set(current.members.map((member) => member.seatIndex)); let seatIndex = 0; while (used.has(seatIndex)) seatIndex += 1;
      await transaction.roomMember.create({ data: { roomId: current.id, userId, identityId: userId, playerId: `player-${userId}`, displayName: displayName.normalize("NFKC").trim(), seatIndex, connected: true } });
      const updated = await transaction.room.update({ where: { id: current.id }, data: { version: { increment: 1 } }, include: { members: true } });
      await transaction.auditLog.create({ data: { action: "room.join", outcome: "SUCCESS", actorId: userId, resourceType: "room", resourceId: current.id } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.safeRoom(room);
  }
  async setReady(code: string, userId: string, ready: boolean, expectedVersion: number) {
    const room = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.room.findUnique({ where: { normalizedCode: this.normalizeCode(code) }, include: { members: true } });
      if (!current || current.status !== RoomStatus.WAITING || !current.members.some((member) => member.identityId === userId)) throw new NotFoundException("Room not found");
      const updated = await transaction.room.updateMany({ where: { id: current.id, version: expectedVersion, status: RoomStatus.WAITING }, data: { version: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException("STALE_ROOM_VERSION");
      await transaction.roomMember.update({ where: { roomId_identityId: { roomId: current.id, identityId: userId } }, data: { ready } });
      return transaction.room.findUniqueOrThrow({ where: { id: current.id }, include: { members: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.safeRoom(room);
  }
  async start(code: string, userId: string, expectedVersion: number) {
    const current = await this.prisma.room.findUnique({ where: { normalizedCode: this.normalizeCode(code) }, include: { members: { orderBy: { seatIndex: "asc" } } } });
    if (!current) throw new NotFoundException("Room not found");
    if (current.hostIdentityId !== userId) throw new ForbiddenException("Only the host can start");
    const players = current.members.filter((member) => member.role !== "SPECTATOR");
    if (current.version !== expectedVersion) throw new ConflictException("STALE_ROOM_VERSION");
    if (players.length < 2 || players.some((member) => !member.ready || !member.connected)) throw new ConflictException("ROOM_NOT_READY");
    const seed = randomBytes(4).readUInt32BE(0); const engine = new UnoEngine(new SeededRandomProvider(seed));
    const state = engine.createInitialState({ players: players.map((member) => ({ id: member.playerId, name: member.displayName, kind: member.control === "BOT" ? "BOT" : "HUMAN" })), cardsPerPlayer: 7 });
    const serialized = engine.serialize(state); const protectedState = this.cipher.encrypt(serialized); const sessionId = randomUUID(); const snapshotId = randomUUID();
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.room.updateMany({ where: { id: current.id, version: expectedVersion, status: RoomStatus.WAITING }, data: { status: RoomStatus.IN_GAME, version: { increment: 1 } } });
      if (claimed.count !== 1) throw new ConflictException("STALE_ROOM_VERSION");
      await transaction.gameSession.create({ data: { id: sessionId, roomId: current.id, gameType: "COLOR_CLASH", status: "ACTIVE", gameVersion: UNO_GAME_VERSION, ruleConfigVersion: 1, ruleConfig: { cardsPerPlayer: 7 }, stateVersion: 1, eventSequence: 0, randomSeed: seed.toString(), currentTurnPlayerId: state.players[state.currentPlayerIndex]!.id, turnStartedAt: new Date(), latestSnapshotId: snapshotId, startedAt: new Date(), seats: { create: players.map((member) => ({ userId: member.userId, identityId: member.identityId, playerId: member.playerId, displayName: member.displayName, seatIndex: member.seatIndex, control: member.control, controlEpoch: member.controlEpoch })) }, snapshots: { create: { id: snapshotId, gameVersion: UNO_GAME_VERSION, stateVersion: 1, eventSequence: 0, projectionVersion: 1, encryptedPayload: protectedState.encryptedPayload, checksum: protectedState.checksum, reason: "INITIAL" } }, }, include: { seats: true } });
      await transaction.outboxEvent.create({ data: { aggregateType: "game-session", aggregateId: sessionId, aggregateVersion: 1, eventType: "game.session.started", payload: { gameSessionId: sessionId, stateVersion: 1 } } });
      await transaction.auditLog.create({ data: { action: "game_session.create", outcome: "SUCCESS", actorId: userId, resourceType: "game-session", resourceId: sessionId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { gameSessionId: sessionId, stateVersion: 1, projection: this.projections.colorClash(state, { mode: "PLAYER", playerId: players.find((member) => member.identityId === userId)!.playerId }) };
  }
}
