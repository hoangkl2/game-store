"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAnimationQueue } from "./provider";

export function MotionSafe({ children, className }: { children: ReactNode; className?: string }) { const { reducedMotion } = useAnimationQueue(); return <div className={cn(className, "motion-safe")} data-reduced-motion={reducedMotion || undefined}>{children}</div>; }
export function ReducedMotionFallback({ children, fallback }: { children: ReactNode; fallback: ReactNode }) { const { reducedMotion } = useAnimationQueue(); return <>{reducedMotion ? fallback : children}</>; }
export function PageTransition({ children }: { children: ReactNode }) { return <main className="motion-page-enter">{children}</main>; }
export function PresenceTransition({ open, children }: { open: boolean; children: ReactNode }) { return open ? <div className="motion-presence-enter">{children}</div> : null; }
export function GameEventTransition({ children }: { children: ReactNode }) { const { state } = useAnimationQueue(); return <div data-animation-status={state.status}>{children}</div>; }
export function CelebrationLayer({ children }: { children: ReactNode }) { const { reducedMotion, speed } = useAnimationQueue(); return <div aria-hidden="true" className={cn("motion-celebration", (reducedMotion || speed === "OFF") && "hidden")}>{children}</div>; }
export function ConnectionTransition({ status }: { status: "IDLE" | "RECONNECTING" | "RESYNCED" }) { return <p role="status" className="text-sm text-muted-foreground">{status === "RECONNECTING" ? "Reconnecting: animations are paused until the latest state arrives." : status === "RESYNCED" ? "Resynchronized to the latest game state." : "Connection stable."}</p>; }
