import { Injectable } from "@nestjs/common";
import { IdempotencyStatus, Prisma } from "@prisma/client";
import type { IdempotencyClaim, IdempotencyKey, IdempotencyRecord, IdempotencyRepository } from "@game-store/backend-core";
import { PrismaService } from "../prisma/prisma.service";

type StoredResult = Record<string, unknown>;
const toRecord = (value: { gameSessionId: string; identityId: string; requestId: string; actionHash: string; status: IdempotencyStatus; ownerToken: string; accepted: boolean | null; resultingStateVersion: number | null; response: Prisma.JsonValue | null; createdAt: Date; expiresAt: Date; completedAt: Date | null }): IdempotencyRecord<StoredResult> => ({ gameSessionId: value.gameSessionId, identityId: value.identityId, requestId: value.requestId, actionHash: value.actionHash, status: value.status, ownerToken: value.ownerToken, accepted: value.accepted ?? undefined, resultingStateVersion: value.resultingStateVersion ?? undefined, result: value.response && typeof value.response === "object" && !Array.isArray(value.response) ? value.response as StoredResult : undefined, createdAt: value.createdAt.toISOString(), expiresAt: value.expiresAt.toISOString(), completedAt: value.completedAt?.toISOString() });

@Injectable()
export class PrismaIdempotencyRepository implements IdempotencyRepository<StoredResult> {
  constructor(private readonly prisma: PrismaService) {}
  async claim(input: IdempotencyKey & { actionHash: string; ownerToken: string; now: string; expiresAt: string }): Promise<IdempotencyClaim<StoredResult>> {
    try {
      const created = await this.prisma.idempotencyRecord.create({ data: { gameSessionId: input.gameSessionId, identityId: input.identityId, requestId: input.requestId, actionHash: input.actionHash, ownerToken: input.ownerToken, claimExpiresAt: new Date(Date.parse(input.now) + 30_000), expiresAt: new Date(input.expiresAt) } });
      return { kind: "CLAIMED", record: toRecord(created) };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      const existing = await this.prisma.idempotencyRecord.findUniqueOrThrow({ where: { gameSessionId_identityId_requestId: { gameSessionId: input.gameSessionId, identityId: input.identityId, requestId: input.requestId } } });
      if (existing.actionHash !== input.actionHash) return { kind: "COLLISION", record: toRecord(existing) };
      if (existing.status === IdempotencyStatus.PROCESSING && existing.claimExpiresAt <= new Date(input.now)) {
        const reclaimed = await this.prisma.idempotencyRecord.updateMany({ where: { id: existing.id, status: IdempotencyStatus.PROCESSING, claimExpiresAt: { lte: new Date(input.now) } }, data: { ownerToken: input.ownerToken, claimExpiresAt: new Date(Date.parse(input.now) + 30_000), expiresAt: new Date(input.expiresAt) } });
        if (reclaimed.count === 1) return { kind: "CLAIMED", record: toRecord(await this.prisma.idempotencyRecord.findUniqueOrThrow({ where: { id: existing.id } })) };
      }
      return { kind: existing.status === IdempotencyStatus.PROCESSING ? "IN_FLIGHT" : "DUPLICATE", record: toRecord(existing) };
    }
  }
  async complete(key: IdempotencyKey, ownerToken: string, completion: { accepted: boolean; resultingStateVersion: number; result: StoredResult; completedAt: string }): Promise<IdempotencyRecord<StoredResult>> {
    const updated = await this.prisma.idempotencyRecord.updateMany({ where: { gameSessionId: key.gameSessionId, identityId: key.identityId, requestId: key.requestId, ownerToken, status: IdempotencyStatus.PROCESSING }, data: { status: completion.accepted ? IdempotencyStatus.COMPLETED : IdempotencyStatus.REJECTED, accepted: completion.accepted, resultingStateVersion: completion.resultingStateVersion, response: completion.result as Prisma.InputJsonValue, completedAt: new Date(completion.completedAt) } });
    if (updated.count !== 1) throw new Error("Idempotency claim is not owned");
    return toRecord(await this.prisma.idempotencyRecord.findUniqueOrThrow({ where: { gameSessionId_identityId_requestId: key } }));
  }
  async find(key: IdempotencyKey): Promise<IdempotencyRecord<StoredResult> | undefined> { const value = await this.prisma.idempotencyRecord.findUnique({ where: { gameSessionId_identityId_requestId: key } }); return value ? toRecord(value) : undefined; }
  async waitForCompletion(key: IdempotencyKey, milliseconds = 2500): Promise<StoredResult | undefined> {
    const deadline = Date.now() + milliseconds;
    while (Date.now() < deadline) { const record = await this.find(key); if (record?.status === "COMPLETED" || record?.status === "REJECTED") return record.result; await new Promise((resolve) => setTimeout(resolve, 50)); }
    return undefined;
  }
}
