"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { type ActionHistory } from "@game-store/game-core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  createRoyalRaceSavedGame,
  deserializeRoyalRaceSavedGame,
  FINISH_POSITION,
  IndexedDbRoyalRaceSaveStore,
  isSafeCell,
  ReplayableSeededRandomProvider,
  RoyalRaceBot,
  RoyalRaceEngine,
  TRACK_LENGTH,
  type RoyalRaceAction,
  type RoyalRaceEvent,
  type RoyalRaceState,
} from "@game-store/game-royal-race";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  RoyalRaceAnimationState,
  RoyalRaceAudioState,
  RoyalRaceConnectionState,
  RoyalRaceSessionState,
  RoyalRaceUIState,
} from "@/features/royal-race/types";

const identities = [
  { shape: "Circle", marker: "C", pattern: "rings" },
  { shape: "Triangle", marker: "T", pattern: "stripes" },
  { shape: "Square", marker: "S", pattern: "grid" },
  { shape: "Diamond", marker: "D", pattern: "dots" },
];

const boardPosition = (cell: number) => {
  if (cell <= 6) return { gridRow: 1, gridColumn: cell + 1 };
  if (cell <= 12) return { gridRow: cell - 5, gridColumn: 7 };
  if (cell <= 18) return { gridRow: 7, gridColumn: 20 - cell };
  return { gridRow: 25 - cell, gridColumn: 1 };
};

const initialPlayers = [
  { id: "human", name: "You" },
  { id: "bot-1", name: "Orion", kind: "BOT" as const },
  { id: "bot-2", name: "Lyra", kind: "BOT" as const },
  { id: "bot-3", name: "Nova", kind: "BOT" as const },
];

export default function RoyalRacePage() {
  return <Suspense fallback={<main className="p-[var(--page-padding)]"><p role="status">Preparing the Royal Race...</p></main>}><RoyalRaceGame /></Suspense>;
}

function RoyalRaceGame() {
  const searchParams = useSearchParams();
  const quickRace = searchParams.get("preset") === "quick";
  const requestedSpeed = searchParams.get("speed")?.toUpperCase();
  const botSpeed = requestedSpeed === "FAST" || requestedSpeed === "RELAXED" ? requestedSpeed : "NORMAL";
  const botDelay = botSpeed === "FAST" ? 100 : botSpeed === "RELAXED" ? 700 : 300;
  const gameRandom = useMemo(() => new ReplayableSeededRandomProvider(2026), []);
  const botRandom = useMemo(() => new ReplayableSeededRandomProvider(73), []);
  const engine = useMemo(() => new RoyalRaceEngine(gameRandom), [gameRandom]);
  const bot = useMemo(() => new RoyalRaceBot(engine, botRandom), [botRandom, engine]);
  const saveStore = useMemo(() => new IndexedDbRoyalRaceSaveStore(), []);
  const [domain, setDomain] = useState<RoyalRaceState>(() => engine.createInitialState({ players: quickRace ? initialPlayers.slice(0, 2) : initialPlayers, piecesPerPlayer: quickRace ? 1 : 4 }));
  const [history, setHistory] = useState<ActionHistory<RoyalRaceAction>>([]);
  const [ui, setUI] = useState<RoyalRaceUIState>({ focusedPieceIndex: 0, isPauseOpen: false, isLogOpen: false, boardZoom: 1 });
  const [animation, setAnimation] = useState<RoyalRaceAnimationState>({ queue: [], speed: "NORMAL" });
  const [eventLog, setEventLog] = useState<RoyalRaceEvent[]>([]);
  const [audio] = useState<RoyalRaceAudioState>({ muted: true, captionsEnabled: true });
  const [session, setSession] = useState<RoyalRaceSessionState>({ saveId: quickRace ? "royal-race-quick" : "royal-race-classic", saveStatus: "IDLE" });
  const [sessionNotice, setSessionNotice] = useState("");
  const connection: RoyalRaceConnectionState = { status: "OFFLINE" };
  const [announcement, setAnnouncement] = useState("Royal Race is ready. Roll the dice.");
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const pausePanelRef = useRef<HTMLElement>(null);
  const active = domain.players[domain.currentPlayerIndex]!;
  const human = domain.players[0]!;
  const legalIds = engine.getLegalPieceIds(domain, active.id);

  const submit = useCallback((action: RoyalRaceAction) => {
    try {
      const result = engine.reduce(domain, action);
      setDomain(result.state);
      setHistory((items) => [...items, { sequence: items.length, action, timestamp: new Date().toISOString() }]);
      setAnimation((value) => ({
        ...value,
        current: result.events[0] ? { event: result.events[0], startedAt: Date.now() } : undefined,
        queue: result.events.slice(1),
      }));
      setEventLog((events) => [...events, ...result.events]);
      setUI((value) => ({ ...value, selectedPieceId: undefined }));
      setAnnouncement(describeEvents(result.events));
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "That action is unavailable.");
    }
  }, [domain, engine]);

  const closePause = useCallback(() => {
    setUI((value) => ({ ...value, isPauseOpen: false }));
    window.setTimeout(() => pauseButtonRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (ui.isPauseOpen) return undefined;
    if (domain.phase !== "FINISHED" && active.kind === "BOT") {
      setUI((value) => ({ ...value, interactionLockReason: "BOT_TURN" }));
      const timer = window.setTimeout(() => submit(bot.chooseAction(domain, active.id)), botDelay);
      return () => window.clearTimeout(timer);
    }
    setUI((value) => ({ ...value, interactionLockReason: domain.phase === "FINISHED" ? "GAME_OVER" : undefined }));
    return undefined;
  }, [active.id, active.kind, active.name, bot, botDelay, domain, submit, ui.isPauseOpen]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Escape") {
        setUI((value) => ({ ...value, selectedPieceId: undefined }));
        if (ui.isPauseOpen) closePause();
      }
      if (event.key.toLowerCase() === "p") {
        if (ui.isPauseOpen) closePause();
        else setUI((value) => ({ ...value, isPauseOpen: true }));
      }
      if (event.key.toLowerCase() === "l") setUI((value) => ({ ...value, isLogOpen: !value.isLogOpen }));
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [closePause, ui.isPauseOpen]);

  useEffect(() => {
    if (!animation.current) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reducedMotion || animation.speed === "OFF" ? 0 : animation.speed === "FAST" ? 120 : animation.speed === "SLOW" ? 450 : 240;
    const timer = window.setTimeout(() => setAnimation((value) => ({
      ...value,
      current: value.queue[0] ? { event: value.queue[0], startedAt: Date.now() } : undefined,
      queue: value.queue.slice(1),
    })), delay);
    return () => window.clearTimeout(timer);
  }, [animation.current, animation.speed]);

  const save = async () => {
    setSession((value) => ({ ...value, saveStatus: "SAVING" }));
    try {
      await saveStore.save(createRoyalRaceSavedGame(engine, session.saveId, domain, history, undefined, {
        randomState: { game: gameRandom.snapshot(), bot: botRandom.snapshot() },
        preferences: { botSpeed },
      }));
      setSession((value) => ({ ...value, saveStatus: "SAVED" }));
      setAnnouncement("Royal Race saved on this device.");
      setSessionNotice("Royal Race saved on this device.");
      return true;
    } catch {
      setSession((value) => ({ ...value, saveStatus: "ERROR" }));
      setAnnouncement("The game could not be saved.");
      return false;
    }
  };

  const resume = async () => {
    try {
      const saved = await saveStore.get(session.saveId);
      if (!saved) {
        setAnnouncement("No Royal Race save was found.");
        return;
      }
      if (saved.randomState) {
        gameRandom.restore(saved.randomState.game);
        botRandom.restore(saved.randomState.bot);
      }
      setDomain(deserializeRoyalRaceSavedGame(engine, saved));
      setHistory(saved.actionHistory);
      setAnimation((value) => ({ ...value, current: undefined, queue: [] }));
      setEventLog([]);
      setUI((value) => ({ ...value, selectedPieceId: undefined }));
      closePause();
      setAnnouncement("Saved Royal Race resumed.");
      setSessionNotice("Saved Royal Race resumed.");
    } catch {
      setAnnouncement("This save is incompatible or could not be read.");
    }
  };

  const moveTokenFocus = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const tokens = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-royal-token='true']:not(:disabled)"));
    const current = tokens.indexOf(event.currentTarget);
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    tokens[(current + direction + tokens.length) % tokens.length]?.focus();
  };

  return <main className="mx-auto max-w-[var(--content-max)] space-y-5 p-[var(--page-padding)] pb-28 md:pb-8" data-game-theme="royal-race">
    <div className="sr-only" aria-live="polite">{announcement}</div>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-semibold text-primary">Offline race / {connection.status.toLowerCase()}</p>
        <h1 className="font-display text-3xl font-semibold">Royal Race</h1>
        <p className="text-sm text-muted-foreground">Turn {domain.turnNumber}: {active.name} / {domain.phase === "MOVE" ? `rolled ${domain.dice}` : "ready to roll"}</p>
      </div>
      <div className="flex gap-2">
        <Badge variant={active.kind === "BOT" ? "bot" : "ready"}>{active.kind === "BOT" ? "Bot thinking" : "Your turn"}</Badge>
        <Button ref={pauseButtonRef} size="compact" variant="outline" onClick={() => setUI((value) => ({ ...value, isPauseOpen: true }))}>Pause</Button>
      </div>
    </header>

    {ui.isPauseOpen && <section ref={pausePanelRef} role="dialog" aria-modal="true" aria-labelledby="pause-title" className="rounded-card border bg-surface p-5 shadow-[var(--shadow-4)]" onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(pausePanelRef.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? []);
      if (controls.length === 0) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }}>
      <h2 id="pause-title" className="text-xl font-bold">Paused</h2>
      <p className="mt-1 text-muted-foreground">Animations: {animation.speed}. Audio: {audio.muted ? "muted" : "on"}.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button autoFocus onClick={closePause}>Resume</Button>
        <Button variant="outline" loading={session.saveStatus === "SAVING"} onClick={() => void save()}>Save game</Button>
        <Button variant="outline" onClick={() => void resume()}>Resume saved</Button>
        <Button variant="outline" onClick={() => void save().then((saved) => { if (saved) window.location.assign("/games/royal-race"); })}>Save and exit</Button>
        <Link className="inline-flex min-h-11 items-center rounded-button border border-border-strong px-4 font-semibold" href="/games/royal-race">Exit without saving</Link>
      </div>
    </section>}

    <section aria-label="Players" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {domain.players.map((player, index) => {
        const pieces = domain.pieces.filter((piece) => piece.playerId === player.id);
        return <Card key={player.id} style={{ borderInlineStartColor: `var(--player-${index + 1}-border)`, borderInlineStartWidth: 4 }} className={active.id === player.id ? "border-primary shadow-[var(--selected-item-glow)]" : ""}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">P{index + 1} {identities[index]!.shape} / {player.name}</p>
            <Badge variant={player.kind === "BOT" ? "bot" : "guest"}>{player.kind}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{identities[index]!.pattern} / Home {pieces.filter((piece) => piece.position === -1).length} / Track {pieces.filter((piece) => piece.position >= 0 && piece.position < FINISH_POSITION).length} / Finished {pieces.filter((piece) => piece.position === FINISH_POSITION).length}</p>
        </Card>;
      })}
    </section>

    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div role="grid" aria-label="Royal Race board, 24-cell compass loop" className="grid aspect-square max-h-[70vh] w-full grid-cols-7 grid-rows-7 gap-1 rounded-gameplay border-2 border-border-strong bg-[var(--game-board)] p-2">
        {Array.from({ length: 24 }, (_, cell) => {
          const pieces = domain.pieces.filter((piece) => engine.getGlobalTrackCell(domain, piece) === cell);
          return <div role="gridcell" aria-label={`Track cell ${cell + 1}${isSafeCell(cell) ? ", safe zone" : ""}`} key={cell} style={boardPosition(cell)} className={`relative flex min-h-10 items-center justify-center rounded-control border text-xs ${isSafeCell(cell) ? "border-primary border-dashed bg-primary-subtle" : "bg-surface"}`}>
            <span aria-hidden="true">{isSafeCell(cell) ? "SAFE" : cell + 1}</span>
            <div className="absolute inset-0 flex flex-wrap items-center justify-center">
              {pieces.map((piece) => {
                const playerIndex = domain.players.findIndex((player) => player.id === piece.playerId);
                return <span key={piece.id} data-committed={animatedPieceId(animation.current?.event) === piece.id || undefined} title={`${domain.players[playerIndex]!.name}, token ${piece.number}`} style={{ backgroundColor: `var(--player-${playerIndex + 1}-subtle)`, borderColor: `var(--player-${playerIndex + 1}-border)` }} className="royal-race-token inline-flex size-5 items-center justify-center rounded-circle border text-[10px] font-bold">{identities[playerIndex]!.marker}{piece.number}</span>;
              })}
            </div>
          </div>;
        })}
        <div className="col-span-5 col-start-2 row-span-5 row-start-2 flex flex-col items-center justify-center rounded-card border bg-surface p-2 text-center sm:p-4">
          <p className="text-sm font-semibold text-muted-foreground">Committed die</p>
          <p className="font-data text-6xl font-bold">{domain.dice ?? "-"}</p>
          <p className="mt-2 text-sm">{domain.phase === "MOVE" ? `${legalIds.length} legal token${legalIds.length === 1 ? "" : "s"}` : "Roll to reveal legal moves"}</p>
          <div className="mt-3 grid w-full grid-cols-2 gap-2" aria-label="Four player home paths">
            {domain.players.map((player, playerIndex) => <div key={player.id} aria-label={`${player.name} four-cell home path`} className="rounded-control border p-1">
              <span className="text-[10px] font-bold">{identities[playerIndex]!.marker} PATH</span>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {Array.from({ length: FINISH_POSITION - TRACK_LENGTH }, (_, pathIndex) => {
                  const occupants = domain.pieces.filter((piece) => piece.playerId === player.id && piece.position === TRACK_LENGTH + pathIndex);
                  return <span key={pathIndex} aria-label={`Home path cell ${pathIndex + 1}, ${occupants.length} tokens`} style={{ backgroundColor: `var(--player-${playerIndex + 1}-subtle)`, borderColor: `var(--player-${playerIndex + 1}-border)` }} className="flex aspect-square min-w-4 items-center justify-center rounded-control border text-[9px] font-bold">{occupants.length || pathIndex + 1}</span>;
                })}
              </div>
              <span className="mt-1 block text-[10px]">Finish {domain.pieces.filter((piece) => piece.playerId === player.id && piece.position === FINISH_POSITION).length}</span>
            </div>)}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <h2 className="text-xl font-bold">Your tokens</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {domain.pieces.filter((piece) => piece.playerId === human.id).map((piece, index) => {
              const legal = legalIds.includes(piece.id);
              const selected = ui.selectedPieceId === piece.id;
              const location = piece.position === -1 ? "home" : piece.position === FINISH_POSITION ? "finished" : engine.getCellId(domain, piece).replaceAll("-", " ");
              return <button key={piece.id} data-royal-token="true" disabled={!legal || active.id !== human.id} aria-pressed={selected} aria-label={`Player one, circle token ${piece.number}, ${location}, ${legal ? "selectable" : "not selectable"}`} className={`min-h-16 rounded-button border p-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${selected ? "ring-2 ring-primary" : ""} ${legal ? "border-primary bg-primary-subtle" : "bg-muted text-muted-foreground"}`} onKeyDown={moveTokenFocus} onFocus={() => setUI((value) => ({ ...value, focusedPieceIndex: index }))} onClick={() => setUI((value) => ({ ...value, selectedPieceId: piece.id }))}>
                Circle token {piece.number}<br /><span className="text-xs">{location}</span>
              </button>;
            })}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Public game log</h2>
            <Button size="compact" variant="ghost" aria-expanded={ui.isLogOpen} onClick={() => setUI((value) => ({ ...value, isLogOpen: !value.isLogOpen }))}>{ui.isLogOpen ? "Hide" : "Show"}</Button>
          </div>
          {ui.isLogOpen && <ol className="mt-2 max-h-40 space-y-1 overflow-auto text-sm text-muted-foreground">
            {eventLog.map((event, index) => <li key={`${event.type}-${index}`}>{describeEvents([event])}</li>)}
            {eventLog.length === 0 && <li>No committed events yet.</li>}
          </ol>}
        </Card>
      </aside>
    </section>

    <section aria-label="Game actions" className="fixed inset-x-0 bottom-0 z-20 flex min-h-16 items-center justify-center gap-2 border-t bg-surface p-2 md:static md:rounded-card md:border">
      <Button disabled={active.id !== human.id || domain.phase !== "ROLL" || ui.isPauseOpen} onClick={() => submit({ type: "ROLL_DICE", playerId: human.id })}>Roll dice</Button>
      <Button variant="secondary" disabled={active.id !== human.id || domain.phase !== "MOVE" || !ui.selectedPieceId || ui.isPauseOpen} onClick={() => ui.selectedPieceId && submit({ type: "MOVE_PIECE", playerId: human.id, pieceId: ui.selectedPieceId })}>Move selected</Button>
      <Button variant="outline" disabled={ui.isPauseOpen} onClick={() => setUI((value) => ({ ...value, selectedPieceId: undefined }))}>Cancel</Button>
    </section>

    {domain.phase === "FINISHED" && <section role="status" className="rounded-card border bg-success-subtle p-6">
      <h2 className="text-2xl font-bold text-success">Race complete</h2>
      <p className="mt-2">Ranking: {domain.rankings.map((id, index) => `${index + 1}. ${domain.players.find((player) => player.id === id)?.name}`).join(" / ")}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => window.location.reload()}>Race again</Button><Link className="inline-flex min-h-11 items-center rounded-button border border-border-strong px-4 font-semibold" href="/games/royal-race/setup">Change setup</Link></div>
    </section>}
    <p className="text-sm text-muted-foreground">{announcement}</p>
    {sessionNotice && <p role="status" className="text-sm font-semibold text-success">{sessionNotice}</p>}
  </main>;
}

function describeEvents(events: RoyalRaceEvent[]) {
  return events.map((event) => {
    switch (event.type) {
      case "DICE_ROLLED": return `${event.playerId} rolled ${event.value}`;
      case "NO_LEGAL_MOVE": return `${event.playerId} has no legal move`;
      case "PIECE_CAPTURED": return `${event.capturedPlayerId}'s token was captured`;
      case "EXTRA_TURN_GRANTED": return `${event.playerId} earned an extra turn: ${event.reason.toLowerCase()}`;
      case "TURN_CHANGED": return `Turn changed to ${event.currentPlayerId}`;
      case "PIECE_FINISHED": return `${event.playerId} finished a token`;
      case "GAME_FINISHED": return "The race is complete";
      default: return event.type.replaceAll("_", " ").toLowerCase();
    }
  }).join(". ");
}

function animatedPieceId(event?: RoyalRaceEvent) {
  if (!event) return undefined;
  if (event.type === "PIECE_CAPTURED") return event.attackerPieceId;
  return "pieceId" in event ? event.pieceId : undefined;
}
