"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const rosters = {
  classic: ["You / Circle / rings", "Orion / Triangle / stripes", "Lyra / Square / grid", "Nova / Diamond / dots"],
  quick: ["You / Circle / rings", "Orion / Triangle / stripes"],
};

export default function RoyalRaceSetupPage() {
  const [preset, setPreset] = useState<keyof typeof rosters>("classic");
  const [speed, setSpeed] = useState<"fast" | "normal" | "relaxed">("normal");
  const roster = rosters[preset];

  return <AppShell>
    <Link className="font-semibold text-primary hover:underline" href="/games/royal-race">Back to Royal Race</Link>
    <header className="mt-5 max-w-[var(--readable-max)]">
      <p className="font-semibold text-primary">Offline setup</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Prepare the Royal Race</h1>
      <p className="mt-3 text-muted-foreground">Configure a local race against bots. Dice and legal moves are resolved only by the game engine.</p>
    </header>
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
      <section aria-labelledby="race-roster" className="space-y-3">
        <h2 id="race-roster" className="text-2xl font-bold">Race roster</h2>
        {roster.map((player, index) => <Card key={player} className="flex items-center justify-between gap-3">
          <p className="font-semibold">P{index + 1} {player}</p>
          <Badge variant={index === 0 ? "guest" : "bot"}>{index === 0 ? "Local" : "Bot"}</Badge>
        </Card>)}
      </section>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-xl font-bold">Race preset</h2>
          <div className="mt-3 grid gap-2">
            <Button variant={preset === "classic" ? "primary" : "outline"} aria-pressed={preset === "classic"} onClick={() => setPreset("classic")}>Classic / 3 bots / 4 tokens</Button>
            <Button variant={preset === "quick" ? "primary" : "outline"} aria-pressed={preset === "quick"} onClick={() => setPreset("quick")}>Quick / 1 bot / 1 token</Button>
          </div>
          <h3 className="mt-5 font-bold">Bot presentation speed</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["fast", "normal", "relaxed"] as const).map((value) => <Button key={value} size="compact" variant={speed === value ? "secondary" : "outline"} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}</Button>)}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">Rules</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Roll six to deploy; six grants an extra turn</li>
            <li>Captures grant an extra turn</li>
            <li>Safe cells prevent capture</li>
            <li>Exact roll is required to finish</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Pause during play to save or resume this preset on the current device.</p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-button bg-primary px-4 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2" href={`/games/royal-race/play?preset=${preset}&speed=${speed}`}>Start offline race</Link>
        </Card>
      </aside>
    </div>
  </AppShell>;
}
