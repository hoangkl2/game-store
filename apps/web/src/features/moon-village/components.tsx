"use client";

import { useRef } from "react";
import type { MoonVillageAction, MoonVillagePlayerProjection, MoonVillagePublicPlayer } from "@game-store/game-moon-village";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const residentMark = ["Lantern", "Comet", "Oak", "River", "Bell", "Cloud", "Star", "Gate"];

export function VillageResidentGrid({ projection }: { projection: MoonVillagePlayerProjection }) {
  return <section aria-labelledby="village-residents"><h2 id="village-residents" className="text-xl font-bold">Village circle</h2><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">{projection.public.players.map((player) => <ResidentCard key={player.id} player={player} local={player.id === projection.private.playerId} />)}</div></section>;
}

function ResidentCard({ player, local }: { player: MoonVillagePublicPlayer; local: boolean }) {
  return <Card className={`min-h-28 border-2 ${player.alive ? "border-border-strong" : "border-muted opacity-70"}`}><div className="flex items-start justify-between gap-2"><span aria-hidden="true" className="grid size-9 place-items-center rounded-full border bg-muted font-data font-bold">{player.seat + 1}</span><Badge variant={player.alive ? "ready" : "neutral"}>{player.alive ? "In village" : "Departed"}</Badge></div><h3 className="mt-3 font-bold">{player.name}{local ? " (You)" : ""}</h3><p className="text-xs text-muted-foreground">{residentMark[player.seat] ?? "Moon"} mark / Resident {player.seat + 1}</p></Card>;
}

export function PrivateRolePanel({ projection, covered, onReveal }: { projection: MoonVillagePlayerProjection; covered: boolean; onReveal: () => void }) {
  if (covered) return <Card className="border-[var(--moon-accent)] bg-[var(--moon-private)]"><p className="text-xs font-bold uppercase tracking-wide">Private - only for {projection.public.players.find((player) => player.id === projection.private.playerId)?.name}</p><h2 className="mt-2 text-xl font-bold">Your moon seal is covered</h2><p className="mt-2 text-sm text-muted-foreground">Check that nobody else can see this display.</p><Button className="mt-4" onClick={onReveal}>Reveal my role</Button></Card>;
  return <Card className="border-[var(--moon-accent)] bg-[var(--moon-private)]" data-private-projection><p className="text-xs font-bold uppercase tracking-wide">Your private role</p><h2 className="mt-2 font-display text-2xl font-bold">{projection.private.roleName}</h2><p className="mt-1">Team {projection.private.team === "DAWN" ? "Dawn" : "Dusk"}</p>{projection.private.teamState && <p className="mt-2 text-sm">Dusk allies: {projection.private.teamState.teammateIds.map((id) => projection.public.players.find((player) => player.id === id)?.name).join(", ")}</p>}<ul className="mt-3 space-y-1 text-sm text-muted-foreground">{projection.private.privateLog.slice(-3).map((entry) => <li key={entry}>{entry}</li>)}</ul></Card>;
}

export function PrivateActionPanel({ projection, disabled, onAction }: { projection: MoonVillagePlayerProjection; disabled: boolean; onAction: (action: MoonVillageAction) => void }) {
  const targetRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const actions = projection.private.legalActions;
  const targetActions = actions.filter((action) => "targetPlayerId" in action);
  const directActions = actions.filter((action) => !("targetPlayerId" in action));
  const label = (action: MoonVillageAction) => {
    if ("targetPlayerId" in action) { const target = projection.public.players.find((player) => player.id === action.targetPlayerId)?.name ?? "resident"; return action.type === "SELECT_READER_TARGET" ? `Read ${target}` : action.type === "SELECT_WARDEN_TARGET" ? `Guard ${target}` : action.type === "BREWER_RESTORE" ? `Restore ${target}` : action.type === "BREWER_MARK" ? `Mark ${target}` : action.type === "CAST_VOTE" ? `Vote for ${target}` : action.type === "SELECT_RANGER_TARGET" ? `Ring for ${target}` : `Choose ${target}`; }
    return action.type === "ACKNOWLEDGE_ROLE" ? "I understand - begin" : action.type === "ACKNOWLEDGE_DAWN" ? "Continue to discussion" : action.type === "CONTINUE_DISCUSSION" ? "Begin village vote" : action.type === "ACKNOWLEDGE_VOTE" ? "Continue to night" : "Pass this night";
  };
  if (!actions.length) return <Card role="status"><h2 className="font-bold">The village is deciding</h2><p className="mt-1 text-sm text-muted-foreground">Only engine-authorized actions appear here. Bot decisions contain no information from roles they cannot see.</p></Card>;
  return <Card aria-labelledby="private-action-title"><h2 id="private-action-title" className="text-xl font-bold">Your authorized action</h2><p className="mt-1 text-sm text-muted-foreground">Phase: {projection.public.phase.replaceAll("_", " ").toLowerCase()}</p><div className="mt-4 flex flex-wrap gap-2" onKeyDown={(event) => { if (!targetActions.length || (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp")) return; event.preventDefault(); const current = targetRefs.current.indexOf(document.activeElement as HTMLButtonElement); const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1; targetRefs.current[(current + delta + targetActions.length) % targetActions.length]?.focus(); }}>{targetActions.map((action, index) => <Button ref={(element) => { targetRefs.current[index] = element; }} key={JSON.stringify(action)} variant="outline" disabled={disabled} onClick={() => onAction(action)}>{label(action)}</Button>)}{directActions.map((action) => <Button key={JSON.stringify(action)} disabled={disabled} onClick={() => onAction(action)}>{label(action)}</Button>)}</div></Card>;
}

export function PublicChronicle({ projection }: { projection: MoonVillagePlayerProjection }) {
  return <Card><h2 className="text-xl font-bold">Public chronicle</h2>{projection.public.discussionMessages.length > 0 && <div className="mt-3 space-y-2" aria-label="Village discussion">{projection.public.discussionMessages.map((message) => <p key={message} className="rounded-control bg-muted p-2 text-sm">{message}</p>)}</div>}<ol className="mt-3 space-y-1 text-sm text-muted-foreground">{projection.public.publicLog.slice(-6).map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ol>{projection.public.lastVoteResult && <p className="mt-3 text-sm font-semibold">Last vote: {projection.public.lastVoteResult.tied ? "No decision" : `${projection.public.players.find((player) => player.id === projection.public.lastVoteResult?.eliminatedPlayerId)?.name} departed`}</p>}</Card>;
}
