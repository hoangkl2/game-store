"use client";

import { useState } from "react";
import Link from "next/link";
import type { MoonVillageBotDifficulty } from "@game-store/game-moon-village";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const residents = ["You / Lantern", "Mira / Comet", "Tao / Oak", "Linh / River", "Niko / Bell", "Sora / Cloud"];

export default function MoonVillageSetupPage() {
  const [difficulty, setDifficulty] = useState<MoonVillageBotDifficulty>("NORMAL");
  const [speed, setSpeed] = useState<"fast" | "normal" | "relaxed">("normal");
  const [preset, setPreset] = useState<"quick" | "standard">("standard");
  const roster = preset === "quick" ? residents.slice(0, 5) : residents;
  return <AppShell><Link className="font-semibold text-primary hover:underline" href="/games/moon-village">Back to Moon Village</Link><header className="mt-5 max-w-[var(--readable-max)]"><p className="font-semibold text-primary">Offline social deduction</p><h1 className="mt-2 font-display text-4xl font-semibold">Gather beneath the lanterns</h1><p className="mt-3 text-muted-foreground">One local resident plays with deterministic bots. Roles and legal actions come only from private engine projections.</p></header><div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.8fr]"><section aria-labelledby="moon-roster" className="space-y-3"><h2 id="moon-roster" className="text-2xl font-bold">Village residents</h2>{roster.map((resident, index) => <Card key={resident} className="flex items-center justify-between"><p className="font-semibold">Resident {index + 1} / {resident}</p><Badge variant={index === 0 ? "guest" : "bot"}>{index === 0 ? "Private local view" : `${difficulty} bot`}</Badge></Card>)}</section><aside className="space-y-4"><Card><h2 className="text-xl font-bold">Round preset</h2><div className="mt-3 grid gap-2"><Button variant={preset === "standard" ? "primary" : "outline"} aria-pressed={preset === "standard"} onClick={() => setPreset("standard")}>Village / 6 residents / 6 rounds</Button><Button variant={preset === "quick" ? "primary" : "outline"} aria-pressed={preset === "quick"} onClick={() => setPreset("quick")}>Short vigil / 5 residents / 2 rounds</Button></div><h3 className="mt-5 font-bold">Bot deduction</h3><div className="mt-2 flex flex-wrap gap-2">{(["EASY", "NORMAL", "HARD"] as const).map((value) => <Button key={value} size="compact" variant={difficulty === value ? "secondary" : "outline"} aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{value}</Button>)}</div><h3 className="mt-5 font-bold">Presentation speed</h3><div className="mt-2 flex flex-wrap gap-2">{(["fast", "normal", "relaxed"] as const).map((value) => <Button key={value} size="compact" variant={speed === value ? "secondary" : "outline"} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}</Button>)}</div></Card><Card><h2 className="text-xl font-bold">Privacy boundary</h2><p className="mt-2 text-sm text-muted-foreground">The screen receives your player-specific projection. Other roles, night targets, and unresolved votes are never rendered or hidden in the DOM.</p><p className="mt-3 text-xs text-muted-foreground">Voice, matchmaking, online moderation, and local pass-and-play are not included.</p><Link className="mt-4 inline-flex min-h-11 items-center rounded-button bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2" href={`/games/moon-village/play?preset=${preset}&difficulty=${difficulty.toLowerCase()}&speed=${speed}`}>Enter Moon Village</Link></Card></aside></div></AppShell>;
}
