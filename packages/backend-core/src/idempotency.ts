import { createHash } from "node:crypto";

export type IdempotencyStatus = "PROCESSING" | "COMPLETED" | "REJECTED" | "EXPIRED";
export interface IdempotencyKey { gameSessionId: string; identityId: string; requestId: string }
export interface IdempotencyRecord<TResult> extends IdempotencyKey {
  actionHash: string;
  status: IdempotencyStatus;
  ownerToken: string;
  accepted?: boolean;
  resultingStateVersion?: number;
  result?: TResult;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
}

export type IdempotencyClaim<TResult> =
  | { kind: "CLAIMED"; record: IdempotencyRecord<TResult> }
  | { kind: "DUPLICATE" | "IN_FLIGHT" | "COLLISION"; record: IdempotencyRecord<TResult> };

export interface IdempotencyRepository<TResult> {
  claim(input: IdempotencyKey & { actionHash: string; ownerToken: string; now: string; expiresAt: string }): Promise<IdempotencyClaim<TResult>>;
  complete(key: IdempotencyKey, ownerToken: string, completion: { accepted: boolean; resultingStateVersion: number; result: TResult; completedAt: string }): Promise<IdempotencyRecord<TResult>>;
  find(key: IdempotencyKey): Promise<IdempotencyRecord<TResult> | undefined>;
}

const clone = <T>(value: T): T => structuredClone(value);

function stableJson(value: unknown, seen = new Set<object>()): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Action contains a non-finite number"); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item, seen)).join(",")}]`;
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error("Action contains a non-plain object");
    if (seen.has(value)) throw new Error("Action contains a cycle");
    seen.add(value);
    const object = value as Record<string, unknown>;
    const result = `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key], seen)}`).join(",")}}`;
    seen.delete(value);
    return result;
  }
  throw new Error("Action contains an unsupported value");
}

export const hashCanonicalAction = (action: unknown): string => createHash("sha256").update(stableJson(action)).digest("base64url");

export type IdempotentExecutionResult<TResult> =
  | { kind: "EXECUTED" | "REPLAYED"; result: TResult; resultingStateVersion: number; accepted: boolean }
  | { kind: "IN_FLIGHT" | "COLLISION" };

export class IdempotencyCoordinator<TResult> {
  constructor(private readonly repository: IdempotencyRepository<TResult>) {}

  async execute(input: IdempotencyKey & { action: unknown; ownerToken: string; now: string; expiresAt: string }, operation: () => Promise<{ accepted: boolean; resultingStateVersion: number; result: TResult }>): Promise<IdempotentExecutionResult<TResult>> {
    const claim = await this.repository.claim({ ...input, actionHash: hashCanonicalAction(input.action) });
    if (claim.kind === "COLLISION") return { kind: "COLLISION" };
    if (claim.kind === "IN_FLIGHT") return { kind: "IN_FLIGHT" };
    if (claim.kind === "DUPLICATE") {
      if (claim.record.result === undefined || claim.record.accepted === undefined || claim.record.resultingStateVersion === undefined) throw new Error("Completed idempotency record is incomplete");
      return { kind: "REPLAYED", result: clone(claim.record.result), accepted: claim.record.accepted, resultingStateVersion: claim.record.resultingStateVersion };
    }
    const outcome = await operation();
    const completed = await this.repository.complete(input, input.ownerToken, { ...outcome, completedAt: input.now });
    return { kind: "EXECUTED", result: clone(completed.result as TResult), accepted: completed.accepted as boolean, resultingStateVersion: completed.resultingStateVersion as number };
  }
}
