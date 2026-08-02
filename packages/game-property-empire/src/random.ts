import type { RandomProvider } from "@game-store/game-core";

export type PropertyEmpireRandomSnapshot = { seed: number; state: number; calls: number };

export class PropertyEmpireSeededRandomProvider implements RandomProvider {
  private state: number;
  private calls = 0;

  constructor(private readonly seed: number) { this.state = seed >>> 0; }
  next(): number { this.state = (1664525 * this.state + 1013904223) >>> 0; this.calls += 1; return this.state / 4294967296; }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(items: readonly T[]): T { if (items.length === 0) throw new Error("Cannot pick from an empty list"); return items[this.int(0, items.length - 1)]!; }
  snapshot(): PropertyEmpireRandomSnapshot { return { seed: this.seed, state: this.state, calls: this.calls }; }
  restore(snapshot: PropertyEmpireRandomSnapshot): void { if (snapshot.seed !== this.seed || !Number.isInteger(snapshot.state) || !Number.isInteger(snapshot.calls) || snapshot.calls < 0) throw new Error("Invalid Property Empire random snapshot"); this.state = snapshot.state >>> 0; this.calls = snapshot.calls; }
}
