export type AnimationSpeed = "OFF" | "FAST" | "NORMAL" | "SLOW";
export type AnimationPriority = "CRITICAL" | "NORMAL" | "DECORATIVE";

export const motionDurations = { instant: 0, fast: 140, standard: 220, deliberate: 380, cinematic: 760, celebration: 1200 } as const;
export const motionEasings = {
  standard: "cubic-bezier(0.2, 0, 0, 1)", enter: "cubic-bezier(0, 0, 0, 1)", exit: "cubic-bezier(0.4, 0, 1, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1.2)", "spring-soft": "cubic-bezier(0.34, 1.56, 0.64, 1)", "spring-snappy": "cubic-bezier(0.2, 1.45, 0.55, 1)",
} as const;

export const effectiveDuration = (durationMs: number, speed: AnimationSpeed, reducedMotion: boolean, priority: AnimationPriority) => {
  if (priority === "DECORATIVE" && (speed === "OFF" || reducedMotion)) return 0;
  if (reducedMotion || speed === "OFF") return priority === "CRITICAL" ? Math.min(80, durationMs) : 0;
  if (speed === "FAST") return Math.max(40, Math.round(durationMs * 0.55));
  if (speed === "SLOW") return Math.min(1800, Math.round(durationMs * 1.5));
  return durationMs;
};
