import { cn } from "@/lib/utils";
import { playerIdentities } from "@game-store/ui";

const playerSymbols = { circle: "●", triangle: "▲", square: "■", diamond: "◆", star: "★", hexagon: "⬡", plus: "+", crescent: "☾" } as const;

export function Avatar({ name, player = 1, className }: { name: string; player?: number; className?: string }) {
  const identity = playerIdentities.find((candidate) => candidate.id === player) ?? playerIdentities[0];
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return <span aria-label={`${name}, player ${identity.id}: ${identity.symbol}, ${identity.pattern}`} title={`${name} — player ${identity.id}`} className={cn("relative inline-flex size-10 items-center justify-center rounded-circle border-2 text-sm font-bold", className)} style={{ background: `var(--player-${identity.id}-subtle)`, borderColor: `var(--player-${identity.id}-border)`, color: `var(--player-${identity.id}-border)` }}>
    {initials || "?"}
    <span aria-hidden="true" className="absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-circle border text-[9px] leading-none" style={{ background: `var(--player-${identity.id})`, borderColor: "var(--surface)", color: `var(--player-${identity.id}-foreground)` }}>{playerSymbols[identity.symbol]}</span>
  </span>;
}
