import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCatalogGame } from "@/features/game-catalog/catalog-data";

export default async function GameDetail({ params }: { params: Promise<{ slug: string }> }) {
  const game = getCatalogGame((await params).slug);
  if (!game) notFound();
  const offlineHref = game.slug === "color-clash" ? "/games/color-clash/play" : game.slug === "royal-race" ? "/games/royal-race/setup" : game.slug === "property-empire" ? "/games/property-empire/setup" : game.slug === "moon-village" ? "/games/moon-village/setup" : "/play/uno";
  return <AppShell><Link className="font-semibold text-primary hover:underline" href="/games">← All games</Link><section className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div><div className="h-44 rounded-gameplay" style={{ background: game.accent }} /><p className="mt-6 font-semibold text-primary">{game.status === "playable" ? "Available now" : "Planned game"}</p><h1 className="mt-2 font-display text-4xl font-semibold">{game.name}</h1><p className="mt-3 max-w-[var(--readable-max)] text-lg text-muted-foreground">{game.description}</p></div><Card className="space-y-4"><h2 className="text-xl font-bold">Choose how to play</h2><p className="text-muted-foreground">{game.players} · {game.duration}</p><div className="flex flex-wrap gap-2">{game.modes.map((mode) => <Badge key={mode} variant="neutral">{mode}</Badge>)}</div>{game.status === "playable" ? <Link className="inline-flex min-h-11 items-center rounded-button bg-primary px-4 font-semibold text-primary-foreground" href={offlineHref}>Play offline</Link> : <p className="rounded-control bg-muted p-3 text-sm text-muted-foreground">This game is planned. Offline and online modes are not available yet.</p>}</Card></section></AppShell>;
}
