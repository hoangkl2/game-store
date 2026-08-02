import { describe, expect, it } from "vitest";
import { hashCanonicalAction, IdempotencyCoordinator } from "../idempotency";
import { InMemoryIdempotencyRepository } from "../testing/in-memory-idempotency";

const base = { gameSessionId: "game-1", identityId: "identity-1", requestId: "request-1", action: { type: "DRAW", nested: { b: 2, a: 1 } }, ownerToken: "worker-1", now: "2026-08-02T00:00:00.000Z", expiresAt: "2026-08-03T00:00:00.000Z" };

describe("durable idempotency semantics", () => {
  it("executes once, replays the original result, and rejects request collisions", async () => {
    const repository = new InMemoryIdempotencyRepository<{ code: string }>();
    const coordinator = new IdempotencyCoordinator(repository);
    let executions = 0;
    const operation = async () => { executions += 1; return { accepted: true, resultingStateVersion: 2, result: { code: "ACCEPTED" } }; };
    expect(await coordinator.execute(base, operation)).toEqual({ kind: "EXECUTED", accepted: true, resultingStateVersion: 2, result: { code: "ACCEPTED" } });
    expect(await coordinator.execute({ ...base, ownerToken: "worker-2" }, operation)).toEqual({ kind: "REPLAYED", accepted: true, resultingStateVersion: 2, result: { code: "ACCEPTED" } });
    expect(await coordinator.execute({ ...base, action: { type: "PLAY" }, ownerToken: "worker-3" }, operation)).toEqual({ kind: "COLLISION" });
    expect(executions).toBe(1);
  });

  it("prevents concurrent duplicates from executing twice", async () => {
    const repository = new InMemoryIdempotencyRepository<string>();
    const coordinator = new IdempotencyCoordinator(repository);
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    let executions = 0;
    const first = coordinator.execute(base, async () => { executions += 1; await wait; return { accepted: true, resultingStateVersion: 2, result: "ok" }; });
    await Promise.resolve();
    expect(await coordinator.execute({ ...base, ownerToken: "worker-2" }, async () => { executions += 1; return { accepted: true, resultingStateVersion: 3, result: "wrong" }; })).toEqual({ kind: "IN_FLIGHT" });
    release();
    await expect(first).resolves.toMatchObject({ kind: "EXECUTED", result: "ok" });
    expect(executions).toBe(1);
  });

  it("stores rejected outcomes and safely reclaims expired records", async () => {
    const repository = new InMemoryIdempotencyRepository<string>();
    const coordinator = new IdempotencyCoordinator(repository);
    const rejected = async () => ({ accepted: false, resultingStateVersion: 1, result: "INVALID_ACTION" });
    expect(await coordinator.execute(base, rejected)).toMatchObject({ kind: "EXECUTED", accepted: false });
    expect(await coordinator.execute({ ...base, ownerToken: "worker-2" }, rejected)).toMatchObject({ kind: "REPLAYED", result: "INVALID_ACTION" });
    const reclaimed = await repository.claim({ gameSessionId: "game-2", identityId: "i", requestId: "r", actionHash: "hash", ownerToken: "old", now: "2026-08-01T00:00:00.000Z", expiresAt: "2026-08-01T01:00:00.000Z" });
    expect(reclaimed.kind).toBe("CLAIMED");
    expect((await repository.claim({ gameSessionId: "game-2", identityId: "i", requestId: "r", actionHash: "hash", ownerToken: "new", now: "2026-08-02T00:00:00.000Z", expiresAt: "2026-08-03T00:00:00.000Z" })).kind).toBe("CLAIMED");
    await expect(repository.complete({ gameSessionId: "game-2", identityId: "i", requestId: "r" }, "old", { accepted: true, resultingStateVersion: 2, result: "bad", completedAt: base.now })).rejects.toThrow("not owned");
    expect(await repository.find({ gameSessionId: "missing", identityId: "i", requestId: "r" })).toBeUndefined();
  });

  it("canonicalizes object keys and rejects unsafe action values", () => {
    expect(hashCanonicalAction({ b: 2, a: [true, null, "x"] })).toBe(hashCanonicalAction({ a: [true, null, "x"], b: 2 }));
    expect(() => hashCanonicalAction({ value: Number.NaN })).toThrow("non-finite");
    expect(() => hashCanonicalAction({ value: undefined })).toThrow("unsupported");
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    expect(() => hashCanonicalAction(cyclic)).toThrow("cycle");
    expect(() => hashCanonicalAction(new Date())).toThrow("non-plain");
  });
});
