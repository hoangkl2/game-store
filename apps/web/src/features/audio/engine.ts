"use client";

import { getAudioAsset, type AudioCommand } from "@game-store/audio-core";

type ActiveTone = { oscillator: OscillatorNode; gain: GainNode; group?: string; volume: number };
type BrowserWindow = Window & { webkitAudioContext?: typeof AudioContext };

export class BrowserAudioEngine {
  private context?: AudioContext;
  private readonly active = new Map<string, ActiveTone>();
  private muted = false;
  async unlock() {
    if (typeof window === "undefined") return false;
    const Constructor = window.AudioContext ?? (window as BrowserWindow).webkitAudioContext;
    if (!Constructor) return false;
    this.context ??= new Constructor();
    try { await this.context.resume(); return this.context.state === "running"; } catch { return false; }
  }
  play(command: AudioCommand, volume: number) {
    if (!this.context || this.context.state !== "running") return false;
    const asset = getAudioAsset(command.assetId); const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    oscillator.type = command.priority === "CRITICAL" ? "triangle" : "sine"; oscillator.frequency.value = asset.frequency;
    const normalizedVolume = Math.max(0, Math.min(0.2, volume)); gain.gain.value = this.muted ? 0 : normalizedVolume; oscillator.connect(gain).connect(this.context.destination);
    const key = command.id; this.active.set(key, { oscillator, gain, group: command.interruptGroup, volume: normalizedVolume }); oscillator.onended = () => this.active.delete(key);
    oscillator.start(); oscillator.stop(this.context.currentTime + asset.durationMs / 1000); return true;
  }
  stopGroup(group: string) { for (const [key, active] of this.active) if (active.group === group) { active.oscillator.stop(); this.active.delete(key); } }
  stop(commandId: string) { const active = this.active.get(commandId); if (!active) return; active.oscillator.stop(); this.active.delete(commandId); }
  stopAll() { for (const active of this.active.values()) active.oscillator.stop(); this.active.clear(); }
  setMuted(muted: boolean) { this.muted = muted; for (const active of this.active.values()) active.gain.gain.value = muted ? 0 : active.volume; }
  fadeGroup(group: string, targetVolume: number, durationMs: number) { if (!this.context) return; const target = Math.max(0, Math.min(0.2, targetVolume)); for (const active of this.active.values()) if (active.group === group) { active.gain.gain.cancelScheduledValues(this.context.currentTime); active.gain.gain.linearRampToValueAtTime(this.muted ? 0 : target, this.context.currentTime + Math.max(0, durationMs) / 1000); active.volume = target; } }
  replaceMusic(command: AudioCommand, volume: number) { this.stopGroup("music"); return this.play({ ...command, interruptGroup: "music", loop: true }, volume); }
  duckMusic() { this.fadeGroup("music", 0.03, 80); }
  restoreMusic() { this.fadeGroup("music", 0.12, 120); }
  async pause() { if (this.context?.state === "running") await this.context.suspend(); }
  async resume() { if (this.context?.state === "suspended") await this.context.resume(); }
  dispose() { this.stopAll(); void this.context?.close(); this.context = undefined; }
}
