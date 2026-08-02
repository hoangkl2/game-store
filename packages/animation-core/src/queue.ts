import type { AnimationPriority, AnimationSpeed } from "./tokens";

export type AnimationCommand<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string; type: string; sourceEventId: string; sourceEventSequence?: number; payload: TPayload;
  priority: AnimationPriority; blocking: boolean; skippable: boolean; durationMs: number; groupId?: string; createdAt: number;
};
export type AnimationStatus = "IDLE" | "PLAYING" | "PAUSED" | "CANCELLED";
export type AnimationState = { queue: AnimationCommand[]; current?: AnimationCommand; parallel: AnimationCommand[]; status: AnimationStatus; speed: AnimationSpeed; reducedMotion: boolean; lowPerformance: boolean; hidden: boolean };
type Listener = (state: AnimationState) => void;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class AnimationQueue {
  private state: AnimationState;
  private readonly listeners = new Set<Listener>();
  constructor(initial: Partial<Pick<AnimationState, "speed" | "reducedMotion" | "lowPerformance">> = {}) { this.state = { queue: [], parallel: [], status: "IDLE", speed: initial.speed ?? "NORMAL", reducedMotion: initial.reducedMotion ?? false, lowPerformance: initial.lowPerformance ?? false, hidden: false }; }
  snapshot(): AnimationState { return copy(this.state); }
  subscribe(listener: Listener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  enqueue(command: AnimationCommand) { this.assert(command); if (this.hasId(command.id)) return; this.state.queue.push(this.normalize(command)); this.pump(); this.emit(); }
  enqueueMany(commands: readonly AnimationCommand[]) { commands.forEach((command) => { this.assert(command); if (!this.hasId(command.id)) this.state.queue.push(this.normalize(command)); }); this.pump(); this.emit(); }
  replaceGroup(groupId: string, commands: readonly AnimationCommand[]) { this.cancelGroup(groupId, false); this.enqueueMany(commands.map((command) => ({ ...command, groupId }))); }
  complete(commandId?: string) { const id = commandId ?? this.state.current?.id; if (!id) return; const active = this.active(); if (!active.some((command) => command.id === id)) return; this.setActive(active.filter((command) => command.id !== id)); if (!this.active().length) this.pump(); this.emit(); }
  pause() { if (this.state.status !== "PLAYING") return; this.state.status = "PAUSED"; this.emit(); }
  resume() { if (this.state.status !== "PAUSED" || this.state.hidden) return; this.state.status = this.active().length ? "PLAYING" : "IDLE"; this.pump(); this.emit(); }
  skipCurrent() { const removable = this.active().filter((command) => command.skippable); if (!removable.length) return; this.setActive(this.active().filter((command) => !command.skippable)); if (!this.active().length) this.pump(); this.emit(); }
  fastForward() { this.setActive(this.active().filter((command) => !command.skippable)); this.state.queue = this.state.queue.filter((command) => !command.skippable && command.priority !== "DECORATIVE"); if (!this.active().length) this.pump(); this.emit(); }
  cancelGroup(groupId: string, emit = true) { const before = this.active().length + this.state.queue.length; this.setActive(this.active().filter((command) => command.groupId !== groupId)); this.state.queue = this.state.queue.filter((command) => command.groupId !== groupId); if (!this.active().length && before) { this.state.status = "CANCELLED"; this.pump(); } if (emit) this.emit(); }
  clearObsolete(beforeEventSequence: number) { this.setActive(this.active().filter((command) => command.sourceEventSequence === undefined || command.sourceEventSequence >= beforeEventSequence)); this.state.queue = this.state.queue.filter((command) => command.sourceEventSequence === undefined || command.sourceEventSequence >= beforeEventSequence); if (!this.active().length) this.pump(); this.emit(); }
  resetForReconnect() { this.setActive([]); this.state.queue = []; this.state.status = "CANCELLED"; this.emit(); this.state.status = "IDLE"; this.emit(); }
  setSpeed(speed: AnimationSpeed) { this.state.speed = speed; this.emit(); }
  setReducedMotion(reducedMotion: boolean) { this.state.reducedMotion = reducedMotion; if (reducedMotion) this.fastForward(); else this.emit(); }
  setLowPerformance(lowPerformance: boolean) { this.state.lowPerformance = lowPerformance; if (lowPerformance) { this.state.queue = this.state.queue.filter((command) => command.priority !== "DECORATIVE"); } this.emit(); }
  setDocumentHidden(hidden: boolean) { this.state.hidden = hidden; if (hidden) { this.state.queue = this.state.queue.filter((command) => command.priority !== "DECORATIVE"); this.pause(); } else if (this.state.status === "PAUSED") this.resume(); else { this.pump(); this.emit(); } }
  isInputBlocked() { return this.active().some((command) => command.priority === "CRITICAL" && command.blocking); }
  private active() { return this.state.current ? [this.state.current, ...this.state.parallel] : []; }
  private setActive(commands: AnimationCommand[]) { this.state.current = commands[0]; this.state.parallel = commands.slice(1); if (!commands.length && this.state.status !== "PAUSED") this.state.status = "IDLE"; }
  private pump() { if (this.state.status === "PAUSED" || this.state.hidden || this.active().length || !this.state.queue.length) return; const first = this.state.queue.shift()!; const group = first.groupId; const pending = this.state.queue; const parallel = group ? pending.filter((command) => command.groupId === group) : []; if (group) this.state.queue = pending.filter((command) => command.groupId !== group);
    this.state.current = first; this.state.parallel = parallel; this.state.status = "PLAYING";
  }
  private normalize(command: AnimationCommand): AnimationCommand { return command.priority === "DECORATIVE" ? { ...command, blocking: false } : { ...command, durationMs: Math.max(0, command.durationMs) }; }
  private hasId(id: string) { return this.active().some((command) => command.id === id) || this.state.queue.some((command) => command.id === id); }
  private assert(command: AnimationCommand) { if (!command.id || !command.type || !command.sourceEventId || !Number.isFinite(command.durationMs) || command.durationMs < 0) throw new Error("Invalid animation command"); }
  private emit() { const snapshot = this.snapshot(); this.listeners.forEach((listener) => listener(snapshot)); }
}
