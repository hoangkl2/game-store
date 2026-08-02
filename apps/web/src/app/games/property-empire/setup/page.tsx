"use client";

import { useState } from "react";
import Link from "next/link";
import type { PropertyEmpireBotDifficulty } from "@game-store/game-property-empire";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const rosters = {
  standard: ["You / Venture / waves", "Cora / Keystone / stripes", "Milo / Arc / hatch", "Iris / North / dots"],
  quick: ["You / Venture / waves", "Cora / Keystone / stripes"],
};

export default function PropertyEmpireSetupPage() {
  const [preset, setPreset] = useState<keyof typeof rosters>("standard");
  const [difficulty, setDifficulty] = useState<PropertyEmpireBotDifficulty>("NORMAL");
  const [speed, setSpeed] = useState<"fast" | "normal" | "relaxed">("normal");

  return <AppShell>
    <Link className="font-semibold text-primary hover:underline" href="/games/property-empire">Back to Property Empire</Link>
    <header className="mt-5 max-w-[var(--readable-max)]"><p className="font-semibold text-primary">Offline setup</p><h1 className="mt-2 font-display text-4xl font-semibold">Plan your city route</h1><p className="mt-3 text-muted-foreground">Choose an original route preset and bot behavior. Economic outcomes remain engine-controlled.</p></header>
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.75fr]">
      <section aria-labelledby="empire-roster" className="space-y-3"><h2 id="empire-roster" className="text-2xl font-bold">City investors</h2>{rosters[preset].map((player, index) => <Card key={player} className="flex items-center justify-between gap-3"><p className="font-semibold">P{index + 1} {player}</p><Badge variant={index === 0 ? "guest" : "bot"}>{index === 0 ? "Local" : `${difficulty} bot`}</Badge></Card>)}</section>
      <aside className="space-y-4">
        <Card><h2 className="text-xl font-bold">Match preset</h2><div className="mt-3 grid gap-2"><Button variant={preset === "standard" ? "primary" : "outline"} aria-pressed={preset === "standard"} onClick={() => setPreset("standard")}>Standard / 3 bots / 60 turns</Button><Button variant={preset === "quick" ? "primary" : "outline"} aria-pressed={preset === "quick"} onClick={() => setPreset("quick")}>Quick / 1 bot / 10 turns</Button></div>
          <h3 className="mt-5 font-bold">Bot difficulty</h3><div className="mt-2 flex flex-wrap gap-2">{(["EASY", "NORMAL", "HARD"] as const).map((value) => <Button key={value} size="compact" variant={difficulty === value ? "secondary" : "outline"} aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{value}</Button>)}</div>
          <h3 className="mt-5 font-bold">Bot presentation speed</h3><div className="mt-2 flex flex-wrap gap-2">{(["fast", "normal", "relaxed"] as const).map((value) => <Button key={value} size="compact" variant={speed === value ? "secondary" : "outline"} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}</Button>)}</div>
        </Card>
        <Card><h2 className="text-xl font-bold">MVP economy</h2><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li>Purchase or decline district sites</li><li>Automatic base rent and civic levies</li><li>Original public dispatch cards</li><li>Basic Transit Hold and bankruptcy</li></ul><p className="mt-3 text-xs text-muted-foreground">Auctions, trades, mortgages, and structures are documented but deferred.</p><Link className="mt-4 inline-flex min-h-11 items-center rounded-button bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2" href={`/games/property-empire/play?preset=${preset}&difficulty=${difficulty.toLowerCase()}&speed=${speed}`}>Start Property Empire</Link></Card>
      </aside>
    </div>
  </AppShell>;
}
