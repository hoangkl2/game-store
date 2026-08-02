import type { IdempotencyClaim, IdempotencyKey, IdempotencyRecord, IdempotencyRepository } from "../idempotency";

const keyOf = (key: IdempotencyKey): string => `${key.gameSessionId}\u0000${key.identityId}\u0000${key.requestId}`;
const clone = <T>(value: T): T => structuredClone(value);

/** Test adapter only. Production must bind IdempotencyRepository to durable transactional storage. */
export class InMemoryIdempotencyRepository<TResult> implements IdempotencyRepository<TResult> {
  private readonly records = new Map<string, IdempotencyRecord<TResult>>();

  async claim(input: IdempotencyKey & { actionHash: string; ownerToken: string; now: string; expiresAt: string }): Promise<IdempotencyClaim<TResult>> {
    const key = keyOf(input);
    const existing = this.records.get(key);
    if (existing && existing.status !== "EXPIRED" && Date.parse(existing.expiresAt) > Date.parse(input.now)) {
      if (existing.actionHash !== input.actionHash) return { kind: "COLLISION", record: clone(existing) };
      return { kind: existing.status === "PROCESSING" ? "IN_FLIGHT" : "DUPLICATE", record: clone(existing) };
    }
    const record: IdempotencyRecord<TResult> = { gameSessionId: input.gameSessionId, identityId: input.identityId, requestId: input.requestId, actionHash: input.actionHash, status: "PROCESSING", ownerToken: input.ownerToken, createdAt: input.now, expiresAt: input.expiresAt };
    this.records.set(key, record);
    return { kind: "CLAIMED", record: clone(record) };
  }

  async complete(key: IdempotencyKey, ownerToken: string, completion: { accepted: boolean; resultingStateVersion: number; result: TResult; completedAt: string }): Promise<IdempotencyRecord<TResult>> {
    const stored = this.records.get(keyOf(key));
    if (!stored || stored.status !== "PROCESSING" || stored.ownerToken !== ownerToken) throw new Error("Idempotency claim is not owned");
    const completed: IdempotencyRecord<TResult> = { ...stored, status: completion.accepted ? "COMPLETED" : "REJECTED", accepted: completion.accepted, resultingStateVersion: completion.resultingStateVersion, result: clone(completion.result), completedAt: completion.completedAt };
    this.records.set(keyOf(key), completed);
    return clone(completed);
  }

  async find(key: IdempotencyKey): Promise<IdempotencyRecord<TResult> | undefined> {
    const record = this.records.get(keyOf(key));
    return record ? clone(record) : undefined;
  }
}
