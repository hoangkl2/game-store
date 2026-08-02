"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createMoonVillageSavedGame, IndexedDbMoonVillageSaveStore, MoonVillageEngine, MoonVillageOfflineSession, MoonVillageSeededRandomProvider, type MoonVillageAction, type MoonVillageBotDifficulty, type MoonVillagePlayerProjection } from "@game-store/game-moon-village";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PrivateActionPanel, PrivateRolePanel, PublicChronicle, VillageResidentGrid } from "@/features/moon-village/components";
import type { MoonVillageAnimationState, MoonVillageAudioState, MoonVillageConnectionState, MoonVillageRoomState, MoonVillageSessionUIState, MoonVillageUIState } from "@/features/moon-village/types";

const allResidents = [
  { id: "human", name: "You", kind: "HUMAN" as const },
  { id: "bot-mira", name: "Mira", kind: "BOT" as const }, { id: "bot-tao", name: "Tao", kind: "BOT" as const },
  { id: "bot-linh", name: "Linh", kind: "BOT" as const }, { id: "bot-niko", name: "Niko", kind: "BOT" as const },
  { id: "bot-sora", name: "Sora", kind: "BOT" as const },
];

export default function MoonVillagePage() { return <Suspense fallback={<main className="p-[var(--page-padding)]"><p role="status">Preparing a private village projection...</p></main>}><MoonVillageGame /></Suspense>; }

function MoonVillageGame() {
  const search = useSearchParams();
  const quick = search.get("preset") === "quick";
  const requestedDifficulty = search.get("difficulty")?.toUpperCase();
  const difficulty: MoonVillageBotDifficulty = requestedDifficulty === "EASY" || requestedDifficulty === "HARD" ? requestedDifficulty : "NORMAL";
  const requestedSpeed = search.get("speed")?.toUpperCase();
  const speed = requestedSpeed === "FAST" || requestedSpeed === "RELAXED" ? requestedSpeed : "NORMAL";
  const botDelay = speed === "FAST" ? 55 : speed === "RELAXED" ? 600 : 220;
  const authority = useMemo(() => {
    const gameRandom = new MoonVillageSeededRandomProvider(2507);
    const botRandom = new MoonVillageSeededRandomProvider(184);
    const engine = new MoonVillageEngine(gameRandom);
    const players = (quick ? allResidents.slice(0, 5) : allResidents).map((player) => player.kind === "BOT" ? { ...player, difficulty } : player);
    return { session: MoonVillageOfflineSession.create(engine, gameRandom, botRandom, { players, localPlayerId: "human", maxRounds: quick ? 2 : 6 }) };
  }, [difficulty, quick]);
  const saveStore = useMemo(() => new IndexedDbMoonVillageSaveStore(), []);
  const [projection, setProjection] = useState<MoonVillagePlayerProjection>(() => authority.session.projection());
  const [ui, setUI] = useState<MoonVillageUIState>({ roleVisible: false, pauseOpen: false, privatePanelOpen: true, logOpen: true, interactionLocked: false });
  const [animation, setAnimation] = useState<MoonVillageAnimationState>({ phase: "IDLE", reduced: false });
  const [audio] = useState<MoonVillageAudioState>({ muted: true, captionsEnabled: true });
  const [sessionUI, setSessionUI] = useState<MoonVillageSessionUIState>({ saveId: quick ? "moon-village-quick" : "moon-village-standard", saveStatus: "IDLE", resumed: false });
  const room: MoonVillageRoomState = { mode: "OFFLINE" };
  const connection: MoonVillageConnectionState = { status: "OFFLINE" };
  const [announcement, setAnnouncement] = useState("Moon Village is ready. Your role remains covered.");
  const pauseButton = useRef<HTMLButtonElement>(null);
  const pauseDialog = useRef<HTMLElement>(null);

  useEffect(() => { setAnimation((value) => ({ ...value, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches })); }, []);

  const updateProjection = useCallback((next: MoonVillagePlayerProjection, ownAction = false) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAnimation({ eventSequence: next.public.sequence, phase: reduced ? "IDLE" : "MIST", reduced });
    window.setTimeout(() => setAnimation((value) => ({ ...value, phase: "IDLE" })), reduced ? 0 : 160);
    setProjection(next);
    setAnnouncement(describeProjection(next, ownAction));
  }, []);

  const submit = useCallback((action: MoonVillageAction) => {
    try { setUI((value) => ({ ...value, interactionLocked: true })); updateProjection(authority.session.submitLocal(action), true); }
    catch (error) { setAnnouncement(error instanceof Error ? error.message : "That private action is no longer available."); }
    finally { setUI((value) => ({ ...value, interactionLocked: false, selectedTargetId: undefined })); }
  }, [authority.session, updateProjection]);

  useEffect(() => {
    if (ui.pauseOpen || animation.phase !== "IDLE" || !authority.session.hasPendingBotAction()) return undefined;
    setUI((value) => ({ ...value, interactionLocked: true }));
    const timer = window.setTimeout(() => { updateProjection(authority.session.advanceOneBot(difficulty)); setUI((value) => ({ ...value, interactionLocked: false })); }, botDelay);
    return () => window.clearTimeout(timer);
  }, [animation.phase, authority.session, botDelay, difficulty, projection.public.sequence, ui.pauseOpen, updateProjection]);

  const closePause = useCallback(() => { setUI((value) => ({ ...value, pauseOpen: false })); window.setTimeout(() => pauseButton.current?.focus(), 0); }, []);
  useEffect(() => { const shortcut = (event: KeyboardEvent) => { if (event.key === "Escape" && ui.pauseOpen) closePause(); if (event.key.toLowerCase() === "p") ui.pauseOpen ? closePause() : setUI((value) => ({ ...value, pauseOpen: true })); }; window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut); }, [closePause, ui.pauseOpen]);

  const save = async () => {
    setSessionUI((value) => ({ ...value, saveStatus: "SAVING" }));
    try { const existing = await saveStore.get(sessionUI.saveId); await saveStore.save(createMoonVillageSavedGame(sessionUI.saveId, authority.session.exportSnapshot(), { botDifficulty: difficulty, botSpeed: speed }, existing?.createdAt)); setSessionUI((value) => ({ ...value, saveStatus: "SAVED" })); setAnnouncement("Moon Village saved privately on this device."); return true; }
    catch { setSessionUI((value) => ({ ...value, saveStatus: "ERROR" })); setAnnouncement("Moon Village could not be saved. The current round remains open."); return false; }
  };

  const resume = async () => {
    try { const saved = await saveStore.get(sessionUI.saveId); if (!saved) { setAnnouncement("No Moon Village save was found."); return; } const restored = authority.session.restore(saved.snapshot); setProjection(restored); setUI((value) => ({ ...value, roleVisible: true, pauseOpen: false, interactionLocked: false })); setAnimation({ phase: "IDLE", reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches }); setSessionUI((value) => ({ ...value, saveStatus: "SAVED", resumed: true })); setAnnouncement("Saved Moon Village game resumed with your private projection."); }
    catch { setAnnouncement("This Moon Village save is incompatible or could not be read."); }
  };

  const result = projection.public.phase === "FINISHED";
  return <main className="mx-auto max-w-[var(--content-max)] space-y-5 p-[var(--page-padding)] pb-24" data-game-theme="moon-village" data-motion={animation.reduced ? "reduced" : "standard"}>
    <div className="sr-only" aria-live="polite">{announcement}</div>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[var(--moon-accent)]">{room.mode.toLowerCase()} village / {connection.status.toLowerCase()}</p><h1 className="font-display text-3xl font-semibold">Moon Village</h1><p className="text-sm text-muted-foreground">Round {projection.public.round} of {projection.public.maxRounds} / {projection.public.phase.replaceAll("_", " ").toLowerCase()}</p></div><div className="flex gap-2"><Badge variant={authority.session.hasPendingBotAction() ? "bot" : "ready"}>{authority.session.hasPendingBotAction() ? "Village thinking" : "Projection ready"}</Badge><Button ref={pauseButton} size="compact" variant="outline" onClick={() => setUI((value) => ({ ...value, pauseOpen: true }))}>Pause</Button></div></header>

    {ui.pauseOpen && <section ref={pauseDialog} role="dialog" aria-modal="true" aria-labelledby="moon-pause-title" className="rounded-card border bg-surface p-5 shadow-[var(--shadow-4)]" onKeyDown={(event) => { if (event.key !== "Tab") return; const controls = Array.from(pauseDialog.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? []); if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); } }}><h2 id="moon-pause-title" className="text-xl font-bold">Village paused</h2><p className="mt-2 text-sm text-muted-foreground">Bot decisions are suspended. Audio is {audio.muted ? "muted" : "on"}; captions are {audio.captionsEnabled ? "on" : "off"}.</p><div className="mt-4 flex flex-wrap gap-2"><Button autoFocus onClick={closePause}>Resume round</Button><Button variant="outline" loading={sessionUI.saveStatus === "SAVING"} onClick={() => void save()}>Save game</Button><Button variant="outline" onClick={() => void resume()}>Resume saved</Button><Button variant="outline" onClick={() => void save().then((saved) => { if (saved) window.location.assign("/games/moon-village"); })}>Save and exit</Button><Link className="inline-flex min-h-11 items-center rounded-button border border-border-strong px-4 font-semibold" href="/games/moon-village">Exit without saving</Link></div></section>}

    {projection.public.phase === "ROLE_REVEAL" && <PrivateRolePanel projection={projection} covered={!ui.roleVisible} onReveal={() => { setUI((value) => ({ ...value, roleVisible: true })); setAnnouncement(`Your private role is ${projection.private.roleName}, team ${projection.private.team === "DAWN" ? "Dawn" : "Dusk"}.`); }} />}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]"><VillageResidentGrid projection={projection} /><aside className="space-y-4">{ui.roleVisible && projection.public.phase !== "ROLE_REVEAL" && <PrivateRolePanel projection={projection} covered={false} onReveal={() => undefined} />}<PublicChronicle projection={projection} /></aside></div>
    {!result && (projection.public.phase !== "ROLE_REVEAL" || ui.roleVisible) && <PrivateActionPanel projection={projection} disabled={ui.interactionLocked || ui.pauseOpen || animation.phase !== "IDLE"} onAction={submit} />}

    {result && <Card role="status" className="border-[var(--moon-accent)] bg-[var(--moon-private)]"><h2 className="font-display text-3xl font-bold">{projection.public.draw ? "The village rests in balance" : `Team ${projection.public.winnerTeam === "DAWN" ? "Dawn" : "Dusk"} prevails`}</h2><p className="mt-2 text-sm text-muted-foreground">The complete role ledger is revealed only because the match is finished.</p><ul className="mt-4 grid gap-2 sm:grid-cols-2">{projection.public.revealedRoles?.map((item) => <li key={item.playerId} className="rounded-control border p-3"><strong>{projection.public.players.find((player) => player.id === item.playerId)?.name}</strong><br />{item.role.replaceAll("_", " ").toLowerCase()} / Team {item.team === "DAWN" ? "Dawn" : "Dusk"}</li>)}</ul><div className="mt-4 flex gap-2"><Button onClick={() => window.location.reload()}>Play again</Button><Link className="inline-flex min-h-11 items-center rounded-button border border-border-strong px-4 font-semibold" href="/games/moon-village/setup">Change setup</Link></div></Card>}
    {sessionUI.resumed && <p className="text-sm font-semibold text-success">Saved Moon Village game resumed with your private projection.</p>}
    <p role="status" className="text-sm text-muted-foreground">{announcement}</p>
  </main>;
}

function describeProjection(projection: MoonVillagePlayerProjection, ownAction: boolean) {
  if (projection.public.phase === "FINISHED") return projection.public.draw ? "Moon Village finished in a draw." : `Moon Village finished. Team ${projection.public.winnerTeam === "DAWN" ? "Dawn" : "Dusk"} wins.`;
  const lastPublic = projection.public.publicLog.at(-1);
  if (projection.private.legalActions.length) return `${ownAction ? "Action committed. " : ""}Your authorized action is ready for ${projection.public.phase.replaceAll("_", " ").toLowerCase()}.`;
  return `${lastPublic ?? "The village waits."} No action is currently required from you.`;
}
