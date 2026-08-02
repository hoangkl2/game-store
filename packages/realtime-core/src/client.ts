import type { GameActionCommand, GameActionResult, GameSnapshot, RealtimeConnectionState, RealtimeConnectionStatus, RealtimeDomainEvent } from "./types";

export class RequestIdGenerator {
  private counter = 0;
  constructor(private readonly prefix: string) { if (!/^[a-z0-9-]{2,32}$/i.test(prefix)) throw new Error("Invalid request ID prefix"); }
  next(now = Date.now()) { this.counter += 1; return `${this.prefix}-${now.toString(36)}-${this.counter.toString(36)}`; }
}

export type PendingCommand<TAction> = { command: GameActionCommand<TAction>; status: "PENDING" | "ACKNOWLEDGED" | "REJECTED" };
export class PendingCommandRegistry<TAction> {
  private readonly entries = new Map<string, PendingCommand<TAction>>();
  constructor(private readonly limit = 16) { if (limit < 1) throw new Error("Pending command limit must be positive"); }
  add(command: GameActionCommand<TAction>) { if (this.entries.has(command.requestId)) return false; if (this.pending().length >= this.limit) throw new Error("Pending command limit reached"); this.entries.set(command.requestId, { command: structuredClone(command), status: "PENDING" }); return true; }
  acknowledge(result: GameActionResult) { const entry = this.entries.get(result.requestId); if (!entry) return false; entry.status = result.accepted ? "ACKNOWLEDGED" : "REJECTED"; return true; }
  clearSession(gameSessionId: string) { for (const [id, entry] of this.entries) if (entry.command.gameSessionId === gameSessionId) this.entries.delete(id); }
  clearStale(stateVersion: number) { for (const [id, entry] of this.entries) if (entry.status === "PENDING" && entry.command.expectedStateVersion <= stateVersion) this.entries.delete(id); }
  pending() { return [...this.entries.values()].filter((entry) => entry.status === "PENDING").map((entry) => structuredClone(entry)); }
  size() { return this.entries.size; }
}

export type EventCursorResult = "ACCEPTED" | "DUPLICATE" | "OLD" | "GAP";
export class RealtimeEventCursor {
  private sequence = 0; private readonly seen = new Set<string>(); private readonly order: string[] = [];
  constructor(private readonly rememberedIds = 256) { if (rememberedIds < 1) throw new Error("Event memory must be positive"); }
  accept(event: RealtimeDomainEvent<unknown>): EventCursorResult { if (this.seen.has(event.eventId)) return "DUPLICATE"; if (event.sequenceNumber <= this.sequence) return "OLD"; if (event.sequenceNumber !== this.sequence + 1) return "GAP"; this.sequence = event.sequenceNumber; this.seen.add(event.eventId); this.order.push(event.eventId); while (this.order.length > this.rememberedIds) this.seen.delete(this.order.shift()!); return "ACCEPTED"; }
  applySnapshot(snapshot: GameSnapshot<unknown>) { this.sequence = snapshot.lastEventSequence; this.seen.clear(); this.order.length = 0; }
  currentSequence() { return this.sequence; }
}

const allowed: Record<RealtimeConnectionStatus, readonly RealtimeConnectionStatus[]> = {
  IDLE: ["CONNECTING", "CLOSED"], CONNECTING: ["AUTHENTICATING", "DISCONNECTED", "FAILED", "CLOSED"], AUTHENTICATING: ["CONNECTED", "FAILED", "DISCONNECTED", "CLOSED"],
  CONNECTED: ["DEGRADED", "RECONNECTING", "DISCONNECTED", "CLOSED"], DEGRADED: ["CONNECTED", "RECONNECTING", "DISCONNECTED", "FAILED", "CLOSED"],
  RECONNECTING: ["AUTHENTICATING", "RESYNCHRONIZING", "DISCONNECTED", "FAILED", "CLOSED"], RESYNCHRONIZING: ["CONNECTED", "RECONNECTING", "FAILED", "CLOSED"],
  DISCONNECTED: ["RECONNECTING", "CLOSED", "FAILED"], CLOSED: [], FAILED: ["CONNECTING", "RECONNECTING", "CLOSED"],
};
export class RealtimeConnectionMachine {
  private state: RealtimeConnectionState = { status: "IDLE", retryCount: 0 };
  constructor(private readonly maxRetries = 6) {}
  transition(status: RealtimeConnectionStatus, patch: Partial<Omit<RealtimeConnectionState, "status">> = {}) { if (!allowed[this.state.status].includes(status)) throw new Error(`Invalid realtime transition: ${this.state.status} -> ${status}`); const retryCount = status === "RECONNECTING" ? this.state.retryCount + 1 : status === "CONNECTED" ? 0 : this.state.retryCount; if (retryCount > this.maxRetries) { this.state = { ...this.state, status: "FAILED", lastError: "Reconnect retry limit reached", retryCount }; return this.snapshot(); } this.state = { ...this.state, ...patch, status, retryCount }; return this.snapshot(); }
  snapshot() { return structuredClone(this.state); }
}

export class RouteSubscriptionRegistry {
  private readonly subscriptions = new Map<string, () => void>();
  bind(key: string, unsubscribe: () => void) { if (!key.trim()) throw new Error("Subscription key is required"); this.subscriptions.get(key)?.(); this.subscriptions.set(key, unsubscribe); }
  release(key: string) { const unsubscribe = this.subscriptions.get(key); if (!unsubscribe) return false; unsubscribe(); this.subscriptions.delete(key); return true; }
  cleanup() { for (const unsubscribe of this.subscriptions.values()) unsubscribe(); this.subscriptions.clear(); }
  size() { return this.subscriptions.size; }
}
