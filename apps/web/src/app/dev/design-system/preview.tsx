"use client";

import { gameThemes, playerIdentities, semanticColorTokens, type ThemeMode } from "@game-store/ui";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/providers/theme-provider";

const themes: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
  { value: "high-contrast-light", label: "HC light" },
  { value: "high-contrast-dark", label: "HC dark" },
];

export function DesignSystemPreview() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return <main className="mx-auto max-w-[var(--content-max)] space-y-10 px-[var(--page-padding)] py-10">
    <header className="max-w-[var(--readable-max)] space-y-3">
      <p className="text-sm font-semibold text-primary">Development only</p>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Game Store design system</h1>
      <p className="text-muted-foreground">Semantic token and accessible primitive preview. Current resolved theme: <strong>{resolvedTheme}</strong>.</p>
      <div className="flex flex-wrap gap-2">{themes.map((item) => <Button key={item.value} variant={theme === item.value ? "primary" : "outline"} size="compact" selected={theme === item.value} onClick={() => setTheme(item.value)}>{item.label}</Button>)}</div>
    </header>

    <section aria-labelledby="colors" className="space-y-4">
      <h2 id="colors" className="text-2xl font-bold">Semantic colors</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{semanticColorTokens.map((token) => <Card key={token} className="space-y-3"><div className="h-14 rounded-control border" style={{ background: `var(--${token})` }} /><code className="text-xs text-muted-foreground">--{token}</code></Card>)}</div>
    </section>

    <section aria-labelledby="type" className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle id="type">Typography</CardTitle></CardHeader><CardContent className="space-y-3"><p className="font-display text-3xl text-foreground">Game night, made clear.</p><p className="text-base text-foreground">Be Vietnam Pro supports English and <span lang="vi">tiếng Việt</span>.</p><p className="font-data text-xl text-foreground tabular-nums">03:42 · 12,450 · ROOM 7KQ9</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Spacing, depth, and glass</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-end gap-2">{[1, 2, 4, 6, 8].map((space) => <div key={space} className="bg-primary" style={{ width: `${space * 8}px`, height: `${space * 8}px` }} />)}</div><div className="ds-glass-elevated rounded-elevated p-4 text-foreground">Elevated glass specimen</div><div className="rounded-card border bg-surface p-4 shadow-[var(--shadow-3)] text-foreground">Popover elevation specimen</div></CardContent></Card>
    </section>

    <section aria-labelledby="controls" className="space-y-4">
      <h2 id="controls" className="text-2xl font-bold">Controls and feedback</h2>
      <Card className="space-y-5"><div className="flex flex-wrap gap-3"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="accent">Accent</Button><Button variant="success">Success</Button><Button variant="warning">Warning</Button><Button variant="danger">Danger</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button disabled>Disabled</Button><Button loading>Loading</Button></div><div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm font-semibold text-foreground">Room code<Input placeholder="ABCD-1234" aria-label="Room code example" /></label><label className="space-y-2 text-sm font-semibold text-foreground">Invalid example<Input aria-invalid="true" defaultValue="Wrong code" /></label></div><div className="flex flex-wrap gap-2"><Badge variant="online">Online</Badge><Badge variant="host">Host</Badge><Badge variant="ready">Ready</Badge><Badge variant="bot">Bot · Normal</Badge><Badge variant="warning">Unstable connection</Badge><Badge variant="danger">Disconnected</Badge></div><Progress value={64} label="Matchmaking progress" /></Card>
    </section>

    <section aria-labelledby="players" className="space-y-4"><h2 id="players" className="text-2xl font-bold">Player identity</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{playerIdentities.map((player) => <Card key={player.id} className="flex items-center gap-3"><Avatar name={`Player ${player.id}`} player={player.id} /><CardContent className="space-y-1"><p className="font-semibold text-foreground">Player {player.id}</p><p className="text-xs">{player.symbol} · {player.pattern}</p></CardContent></Card>)}</div></section>

    <section aria-labelledby="game-themes" className="space-y-4"><h2 id="game-themes" className="text-2xl font-bold">Game theme extensions</h2><div className="grid gap-3 md:grid-cols-2">{gameThemes.map((gameTheme) => <Card key={gameTheme} data-game-theme={gameTheme} className="space-y-3" style={{ background: "var(--game-surface)", color: "var(--foreground)" }}><div className="h-16 rounded-gameplay border" style={{ background: "var(--game-board)", borderColor: "var(--game-highlight)" }} /><p className="font-semibold capitalize">{gameTheme.replace("-", " ")}</p><p className="text-xs text-muted-foreground">Global semantic fallbacks remain active.</p></Card>)}</div></section>

    <section aria-labelledby="states" className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle id="states">Loading and empty states</CardTitle></CardHeader><CardContent className="space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><p className="pt-2 text-foreground">No saved games yet.</p><p>Start an offline match and it will appear here.</p><Button variant="outline" size="sm">Start a match</Button></CardContent></Card><Card><CardHeader><CardTitle>Dialog and toast surfaces</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-dialog border border-border-strong bg-surface-elevated p-4 shadow-[var(--shadow-4)]"><p className="font-semibold text-foreground">Reconnect to match?</p><p className="mt-1">This is a visual specimen; the accessible dialog primitive is intentionally deferred.</p></div><div role="status" className="rounded-card border border-info bg-info-subtle p-3 text-info">Connection restored. Your state is synced.</div></CardContent></Card></section>
  </main>;
}
