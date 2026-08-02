"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ActionHistory } from "@game-store/game-core";
import {
  createPropertyEmpireSavedGame,
  deserializePropertyEmpireSavedGame,
  IndexedDbPropertyEmpireSaveStore,
  PROPERTY_EMPIRE_BOARD,
  PROPERTY_EMPIRE_EVENT_CARDS,
  PropertyEmpireBot,
  PropertyEmpireEngine,
  PropertyEmpireSeededRandomProvider,
  type PropertyEmpireAction,
  type PropertyEmpireBotDifficulty,
  type PropertyEmpireDomainState,
  type PropertyEmpireEvent,
} from "@game-store/game-property-empire";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerFinanceGrid, PropertyDetailPanel, PropertyEmpireBoard, TransactionHistory } from "@/features/property-empire/components";
import type { PropertyEmpireAnimationState, PropertyEmpireAudioState, PropertyEmpireConnectionState, PropertyEmpireSessionState, PropertyEmpireUIState } from "@/features/property-empire/types";

const standardPlayers = [
  { id: "human", name: "You" },
  { id: "bot-1", name: "Cora", kind: "BOT" as const },
  { id: "bot-2", name: "Milo", kind: "BOT" as const },
  { id: "bot-3", name: "Iris", kind: "BOT" as const },
];

export default function PropertyEmpirePage() {
  return <Suspense fallback={<main className="p-[var(--page-padding)]"><p role="status">Preparing Property Empire...</p></main>}><PropertyEmpireGame /></Suspense>;
}

function PropertyEmpireGame() {
  const searchParams = useSearchParams();
  const quick = searchParams.get("preset") === "quick";
  const requestedDifficulty = searchParams.get("difficulty")?.toUpperCase();
  const difficulty: PropertyEmpireBotDifficulty = requestedDifficulty === "EASY" || requestedDifficulty === "HARD" ? requestedDifficulty : "NORMAL";
  const requestedSpeed = searchParams.get("speed")?.toUpperCase();
  const botSpeed = requestedSpeed === "FAST" || requestedSpeed === "RELAXED" ? requestedSpeed : "NORMAL";
  const botDelay = botSpeed === "FAST" ? 80 : botSpeed === "RELAXED" ? 650 : 260;
  const gameRandom = useMemo(() => new PropertyEmpireSeededRandomProvider(1505), []);
  const botRandom = useMemo(() => new PropertyEmpireSeededRandomProvider(91), []);
  const engine = useMemo(() => new PropertyEmpireEngine(gameRandom), [gameRandom]);
  const bot = useMemo(() => new PropertyEmpireBot(engine, botRandom), [botRandom, engine]);
  const saveStore = useMemo(() => new IndexedDbPropertyEmpireSaveStore(), []);
  const configuredPlayers = useMemo(() => (quick ? standardPlayers.slice(0, 2) : standardPlayers).map((player) => player.kind === "BOT" ? { ...player, difficulty } : player), [difficulty, quick]);
  const [domain, setDomain] = useState<PropertyEmpireDomainState>(() => engine.createInitialState({ players: configuredPlayers, maxTurns: quick ? 10 : 60 }));
  const [history, setHistory] = useState<ActionHistory<PropertyEmpireAction>>([]);
  const [ui, setUI] = useState<PropertyEmpireUIState>({ focusedTileIndex: 0, isPropertyPanelOpen: true, isTransactionsOpen: false, isPauseOpen: false });
  const [animation, setAnimation] = useState<PropertyEmpireAnimationState>({ queue: [], speed: "NORMAL" });
  const [audio] = useState<PropertyEmpireAudioState>({ muted: true, captionsEnabled: true });
  const [session, setSession] = useState<PropertyEmpireSessionState>({ saveId: quick ? "property-empire-quick" : "property-empire-standard", saveStatus: "IDLE", autoSaveAfterNextCommit: false });
  const connection: PropertyEmpireConnectionState = { status: "OFFLINE" };
  const [announcement, setAnnouncement] = useState("Property Empire is ready. Roll the dice.");
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const pausePanelRef = useRef<HTMLElement>(null);
  const active = domain.players[domain.currentPlayerIndex]!;
  const human = domain.players[0]!;
  const legalActions = engine.getValidActions(domain, human.id);

  const persist = useCallback(async (state: PropertyEmpireDomainState, actionHistory: ActionHistory<PropertyEmpireAction>) => {
    await saveStore.save(createPropertyEmpireSavedGame(engine, session.saveId, state, actionHistory, undefined, {
      randomState: { game: gameRandom.snapshot(), bot: botRandom.snapshot() },
      preferences: { botSpeed },
    }));
  }, [botRandom, botSpeed, engine, gameRandom, saveStore, session.saveId]);

  const submit = useCallback((action: PropertyEmpireAction) => {
    try {
      const result = engine.reduce(domain, action);
      const nextHistory = [...history, { sequence: history.length, action, timestamp: new Date().toISOString() }];
      setDomain(result.state);
      setHistory(nextHistory);
      setAnimation((value) => ({ ...value, current: result.events[0] ? { event: result.events[0], startedAt: Date.now() } : undefined, queue: result.events.slice(1) }));
      const moved = result.events.find((event): event is Extract<PropertyEmpireEvent, { type: "TOKEN_MOVED" }> => event.type === "TOKEN_MOVED");
      setUI((value) => ({ ...value, selectedTileId: moved?.toTileId ?? value.selectedTileId, isPropertyPanelOpen: true }));
      setAnnouncement(describeEvents(result.events, result.state));
      if (session.autoSaveAfterNextCommit) {
        setSession((value) => ({ ...value, autoSaveAfterNextCommit: false, saveStatus: "SAVING" }));
        void persist(result.state, nextHistory).then(() => setSession((value) => ({ ...value, saveStatus: "SAVED" }))).catch(() => setSession((value) => ({ ...value, saveStatus: "ERROR" })));
      }
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "That economic action is unavailable.");
    }
  }, [domain, engine, history, persist, session.autoSaveAfterNextCommit]);

  const closePause = useCallback(() => {
    setUI((value) => ({ ...value, isPauseOpen: false }));
    window.setTimeout(() => pauseButtonRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (ui.isPauseOpen) return undefined;
    if (animation.current) {
      setUI((value) => ({ ...value, interactionLockReason: "ANIMATING" }));
      return undefined;
    }
    if (domain.phase !== "FINISHED" && active.kind === "BOT") {
      setUI((value) => ({ ...value, interactionLockReason: "BOT_TURN" }));
      const timer = window.setTimeout(() => submit(bot.chooseAction(domain, active.id)), botDelay);
      return () => window.clearTimeout(timer);
    }
    setUI((value) => ({ ...value, interactionLockReason: domain.phase === "FINISHED" ? "GAME_OVER" : undefined }));
    return undefined;
  }, [active.id, active.kind, animation.current, bot, botDelay, domain, submit, ui.isPauseOpen]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Escape" && ui.isPauseOpen) closePause();
      if (event.key.toLowerCase() === "p") ui.isPauseOpen ? closePause() : setUI((value) => ({ ...value, isPauseOpen: true }));
      if (event.key.toLowerCase() === "l") setUI((value) => ({ ...value, isTransactionsOpen: !value.isTransactionsOpen }));
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [closePause, ui.isPauseOpen]);

  useEffect(() => {
    if (!animation.current || ui.isPauseOpen) return undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced || animation.speed === "OFF" ? 0 : animation.speed === "FAST" ? 100 : animation.speed === "SLOW" ? 420 : 220;
    const timer = window.setTimeout(() => setAnimation((value) => ({ ...value, current: value.queue[0] ? { event: value.queue[0], startedAt: Date.now() } : undefined, queue: value.queue.slice(1) })), delay);
    return () => window.clearTimeout(timer);
  }, [animation.current, animation.speed, ui.isPauseOpen]);

  const save = async () => {
    setSession((value) => ({ ...value, saveStatus: "SAVING" }));
    try { await persist(domain, history); setSession((value) => ({ ...value, saveStatus: "SAVED" })); setAnnouncement("Property Empire saved on this device."); return true; }
    catch { setSession((value) => ({ ...value, saveStatus: "ERROR" })); setAnnouncement("Property Empire could not be saved."); return false; }
  };

  const resume = async () => {
    try {
      const saved = await saveStore.get(session.saveId);
      if (!saved) { setAnnouncement("No Property Empire save was found."); return; }
      if (saved.randomState) { gameRandom.restore(saved.randomState.game); botRandom.restore(saved.randomState.bot); }
      const restored = deserializePropertyEmpireSavedGame(engine, saved);
      setDomain(restored);
      setHistory(saved.actionHistory);
      setAnimation((value) => ({ ...value, current: undefined, queue: [] }));
      setUI((value) => ({ ...value, selectedTileId: PROPERTY_EMPIRE_BOARD[restored.players[restored.currentPlayerIndex]!.position]!.id }));
      setSession((value) => ({ ...value, autoSaveAfterNextCommit: true, saveStatus: "SAVED" }));
      closePause();
      setAnnouncement("Saved Property Empire game resumed.");
    } catch { setAnnouncement("This Property Empire save is incompatible or could not be read."); }
  };

  const can = (type: PropertyEmpireAction["type"]) => !animation.current && legalActions.some((action) => action.type === type);
  const pendingTile = domain.pendingDecision ? PROPERTY_EMPIRE_BOARD.find((tile) => tile.id === domain.pendingDecision?.propertyId) : undefined;
  const animatedPlayerId = animation.current?.event.type === "TOKEN_MOVED" ? animation.current.event.playerId : undefined;
  const lastCard = PROPERTY_EMPIRE_EVENT_CARDS.find((card) => card.id === domain.lastEventCardId);

  return <main className="mx-auto max-w-[var(--content-max)] space-y-5 p-[var(--page-padding)] pb-32 md:pb-8" data-game-theme="property-empire">
    <div className="sr-only" aria-live="polite">{announcement}</div>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-primary">Offline economy / {connection.status.toLowerCase()}</p><h1 className="font-display text-3xl font-semibold">Property Empire</h1><p className="text-sm text-muted-foreground">Turn {domain.turnNumber} of {domain.rules.maxTurns} / {active.name} / {domain.phase.replaceAll("_", " ").toLowerCase()}</p></div><div className="flex gap-2"><Badge variant={active.kind === "BOT" ? "bot" : "ready"}>{active.kind === "BOT" ? "Bot thinking" : "Your action"}</Badge><Button ref={pauseButtonRef} size="compact" variant="outline" onClick={() => setUI((value) => ({ ...value, isPauseOpen: true }))}>Pause</Button></div></header>

    {ui.isPauseOpen && <section ref={pausePanelRef} role="dialog" aria-modal="true" aria-labelledby="property-pause-title" className="rounded-card border bg-surface p-5 shadow-[var(--shadow-4)]" onKeyDown={(event) => { if (event.key !== "Tab") return; const controls = Array.from(pausePanelRef.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? []); if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); } }}>
      <h2 id="property-pause-title" className="text-xl font-bold">Economic round paused</h2><p className="mt-1 text-muted-foreground">Animations: {animation.speed}. Audio: {audio.muted ? "muted" : "on"}. Offline bots are suspended.</p><div className="mt-4 flex flex-wrap gap-2"><Button autoFocus onClick={closePause}>Resume</Button><Button variant="outline" loading={session.saveStatus === "SAVING"} onClick={() => void save()}>Save game</Button><Button variant="outline" onClick={() => void resume()}>Resume saved</Button><Button variant="outline" onClick={() => void save().then((saved) => { if (saved) window.location.assign("/games/property-empire"); })}>Save and exit</Button><Link className="inline-flex min-h-11 items-center rounded-button border border-border-strong px-4 font-semibold" href="/games/property-empire">Exit without saving</Link></div>
    </section>}

    <PlayerFinanceGrid state={domain} engine={engine} />

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <PropertyEmpireBoard state={domain} engine={engine} selectedTileId={ui.selectedTileId} animatedPlayerId={animatedPlayerId} onSelect={(tileId, index) => setUI((value) => ({ ...value, selectedTileId: tileId, focusedTileIndex: index, isPropertyPanelOpen: true }))} />
      <aside className="space-y-4">{ui.isPropertyPanelOpen && <PropertyDetailPanel state={domain} engine={engine} tileId={ui.selectedTileId} />}
        <Card><h2 className="text-xl font-bold">Committed dice</h2><p className="mt-2 font-data text-4xl font-bold">{domain.dice ? `${domain.dice[0]} + ${domain.dice[1]}` : "- + -"}</p><p className="text-sm text-muted-foreground">{domain.dice ? `Total ${domain.dice[0] + domain.dice[1]}` : "Roll to move on the city route"}</p></Card>
        {pendingTile && domain.pendingDecision && <Card className="border-warning"><h2 className="text-xl font-bold">Purchase decision</h2><p className="mt-2">{pendingTile.name} for <strong>{domain.pendingDecision.price} credits</strong>.</p><p className="text-sm text-muted-foreground">Current {domain.pendingDecision.currentCash} / Projected {domain.pendingDecision.projectedCash}</p></Card>}
        {lastCard && <Card role="status"><p className="text-xs font-semibold text-primary">PUBLIC DISPATCH</p><h2 className="mt-1 text-xl font-bold">{lastCard.title}</h2><p className="mt-2 text-sm text-muted-foreground">{lastCard.summary}</p></Card>}
        <TransactionHistory state={domain} open={ui.isTransactionsOpen} onToggle={() => setUI((value) => ({ ...value, isTransactionsOpen: !value.isTransactionsOpen }))} />
      </aside>
    </section>

    <section aria-label="Economic actions" className="fixed inset-x-0 bottom-0 z-20 flex min-h-16 flex-wrap items-center justify-center gap-2 border-t bg-surface p-2 md:static md:rounded-card md:border">
      <Button disabled={!can("ROLL_DICE") || ui.isPauseOpen} onClick={() => submit({ type: "ROLL_DICE", playerId: human.id })}>Roll dice</Button>
      <Button variant="success" disabled={!can("BUY_PROPERTY") || ui.isPauseOpen || !domain.pendingDecision} onClick={() => domain.pendingDecision && submit({ type: "BUY_PROPERTY", playerId: human.id, propertyId: domain.pendingDecision.propertyId })}>Buy site</Button>
      <Button variant="outline" disabled={!can("DECLINE_PROPERTY") || ui.isPauseOpen || !domain.pendingDecision} onClick={() => domain.pendingDecision && submit({ type: "DECLINE_PROPERTY", playerId: human.id, propertyId: domain.pendingDecision.propertyId })}>Decline</Button>
      <Button variant="secondary" disabled={!can("END_TURN") || ui.isPauseOpen} onClick={() => submit({ type: "END_TURN", playerId: human.id })}>End turn</Button>
    </section>

    {domain.phase === "FINISHED" && <section role="status" className="rounded-card border bg-success-subtle p-6"><h2 className="text-2xl font-bold text-success">Empire results</h2><ol className="mt-3 space-y-1">{domain.rankings.map((playerId, index) => { const player = domain.players.find((candidate) => candidate.id === playerId)!; const finance = engine.getPlayerFinance(domain, playerId); return <li key={playerId}>{index + 1}. {player.name} / Cash {finance.cash} / Estimated net worth {finance.netWorth} / Sites {finance.propertyCount}</li>; })}</ol><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => window.location.reload()}>Play again</Button><Link className="inline-flex min-h-11 items-center rounded-button border border-border-strong px-4 font-semibold" href="/games/property-empire/setup">Change setup</Link></div></section>}
    <p className="text-sm text-muted-foreground">{announcement}</p>
  </main>;
}

function describeEvents(events: PropertyEmpireEvent[], state: PropertyEmpireDomainState) {
  return events.map((event) => {
    const playerName = "playerId" in event ? state.players.find((player) => player.id === event.playerId)?.name ?? event.playerId : undefined;
    switch (event.type) {
      case "DICE_ROLLED": return `${playerName} rolled ${event.values[0]} and ${event.values[1]}`;
      case "TOKEN_MOVED": return `${playerName} arrived at ${PROPERTY_EMPIRE_BOARD.find((tile) => tile.id === event.toTileId)?.name}`;
      case "PASSED_FOUNDERS_GATE": return `${playerName} received ${event.amount} credits at Founders' Gate`;
      case "PROPERTY_OFFERED": return `${playerName} may purchase ${PROPERTY_EMPIRE_BOARD.find((tile) => tile.id === event.propertyId)?.name}`;
      case "PROPERTY_PURCHASED": return `${playerName} purchased ${PROPERTY_EMPIRE_BOARD.find((tile) => tile.id === event.propertyId)?.name}`;
      case "PROPERTY_DECLINED": return `${playerName} declined the site`;
      case "PROPERTY_UNAFFORDABLE": return `${playerName} cannot afford this site`;
      case "RENT_PAID": return `${event.fromPlayerId} paid ${event.amountPaid} credits rent to ${event.toPlayerId}`;
      case "TAX_PAID": return `${playerName} paid ${event.amountPaid} credits civic levy`;
      case "EVENT_CARD_DRAWN": return `${playerName} drew ${event.title}: ${event.summary}`;
      case "CASH_CHANGED": return `${playerName}'s cash changed by ${event.amount}`;
      case "PLAYER_SENT_TO_TRANSIT_HOLD": return `${playerName} entered Transit Hold`;
      case "PLAYER_RELEASED_FROM_TRANSIT_HOLD": return `${playerName} left Transit Hold after ${event.reason.toLowerCase()}`;
      case "PLAYER_BANKRUPT": return `${playerName} could not cover the required payment and left the round`;
      case "TURN_CHANGED": return `Turn changed to ${state.players.find((player) => player.id === event.currentPlayerId)?.name}`;
      case "GAME_FINISHED": return `Property Empire finished by ${event.reason === "TURN_LIMIT" ? "turn limit" : "last solvent player"}`;
    }
  }).join(". ");
}
