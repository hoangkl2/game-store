import type { AudioCommand } from "./types";

export type AudioQueueState = { queue: AudioCommand[]; current?: AudioCommand; completedIds: string[] };
type Listener = (state: AudioQueueState) => void;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export class AudioCommandQueue {
  private state: AudioQueueState = { queue: [], completedIds: [] };
  private readonly listeners = new Set<Listener>();
  snapshot() { return clone(this.state); }
  subscribe(listener: Listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  enqueue(command: AudioCommand) { this.assert(command); if (this.has(command.id) || this.isRepeated(command)) return false; this.state.queue.push({ ...command }); this.emit(); return true; }
  takeNext() { if (this.state.current) return this.state.current; this.state.current = this.state.queue.shift(); this.emit(); return this.state.current; }
  complete(id?: string) { if (!this.state.current || (id && id !== this.state.current.id)) return; this.state.completedIds = [...this.state.completedIds, this.state.current.id].slice(-100); this.state.current = undefined; this.emit(); }
  discardDecorative() { this.state.queue = this.state.queue.filter((command) => command.priority !== "DECORATIVE"); this.emit(); }
  stopGroup(group: string) { if (this.state.current?.interruptGroup === group) this.state.current = undefined; this.state.queue = this.state.queue.filter((command) => command.interruptGroup !== group); this.emit(); }
  clearRoute() { this.state = { queue: [], completedIds: this.state.completedIds }; this.emit(); }
  clearObsolete(beforeSequence: number) { if (this.state.current?.sourceEventSequence !== undefined && this.state.current.sourceEventSequence < beforeSequence) this.state.current = undefined; this.state.queue = this.state.queue.filter((command) => command.sourceEventSequence === undefined || command.sourceEventSequence >= beforeSequence); this.emit(); }
  resetForReconnect() { this.clearRoute(); }
  private has(id: string) { return this.state.current?.id === id || this.state.queue.some((command) => command.id === id) || this.state.completedIds.includes(id); }
  private isRepeated(command: AudioCommand) { const recent = [this.state.current, ...this.state.queue].filter((item): item is AudioCommand => Boolean(item)); return command.priority !== "CRITICAL" && recent.some((item) => item.assetId === command.assetId && item.sourceEventId === command.sourceEventId); }
  private assert(command: AudioCommand) { if (!command.id || !command.sourceEventId || !Number.isFinite(command.createdAt) || (command.volume !== undefined && (!Number.isFinite(command.volume) || command.volume < 0))) throw new Error("Invalid audio command"); }
  private emit() { const state = this.snapshot(); this.listeners.forEach((listener) => listener(state)); }
}
