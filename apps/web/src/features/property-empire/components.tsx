"use client";

import type { KeyboardEvent } from "react";
import {
  PROPERTY_EMPIRE_BOARD,
  type PropertyEmpireDomainState,
  type PropertyEmpireTile,
  PropertyEmpireEngine,
} from "@game-store/game-property-empire";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const identities = [
  { name: "Venture", marker: "V", pattern: "waves" },
  { name: "Keystone", marker: "K", pattern: "stripes" },
  { name: "Arc", marker: "A", pattern: "hatch" },
  { name: "North", marker: "N", pattern: "dots" },
];

const tilePosition = (index: number) => {
  const row = Math.floor(index / 5);
  const offset = index % 5;
  return { gridRow: row + 1, gridColumn: row % 2 === 0 ? offset + 1 : 5 - offset };
};

const tileMeta = (tile: PropertyEmpireTile) => {
  if (tile.type === "PROPERTY") return `${tile.group.replaceAll("_", " ")} / ${tile.pattern.toLowerCase()} / ${tile.price} credits / rent ${tile.baseRent}`;
  if (tile.type === "TAX") return `${tile.amount} credit levy`;
  if (tile.type === "EVENT") return tile.deck.replaceAll("_", " ").toLowerCase();
  if (tile.type === "HOLD") return "transit status tile";
  if (tile.type === "ORIGIN") return "salary gate";
  return "rest space";
};

export function PlayerFinanceGrid({ state, engine }: { state: PropertyEmpireDomainState; engine: PropertyEmpireEngine }) {
  const active = state.players[state.currentPlayerIndex]!;
  return <section aria-label="Player finances" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
    {state.players.map((player, index) => {
      const finance = engine.getPlayerFinance(state, player.id);
      const rank = state.rankings.indexOf(player.id);
      return <Card key={player.id} style={{ borderInlineStartColor: `var(--player-${index + 1}-border)`, borderInlineStartWidth: 4 }} className={active.id === player.id ? "shadow-[var(--selected-item-glow)]" : ""}>
        <div className="flex items-center justify-between gap-2"><p className="font-semibold">P{index + 1} {identities[index]!.marker} / {player.name}</p><Badge variant={player.kind === "BOT" ? "bot" : "guest"}>{player.kind}</Badge></div>
        <p className="mt-2 font-data text-xl font-bold">{finance.cash} credits</p>
        <p className="text-sm text-muted-foreground">Estimated net worth {finance.netWorth} / Sites {finance.propertyCount}</p>
        <p className="mt-1 text-xs font-semibold">{player.bankrupt ? `Bankrupt${rank >= 0 ? ` / Rank ${rank + 1}` : ""}` : player.inTransitHold ? "In Transit Hold" : active.id === player.id ? "Active turn" : `${identities[index]!.pattern} identity`}</p>
      </Card>;
    })}
  </section>;
}

export function PropertyEmpireBoard({ state, engine, selectedTileId, animatedPlayerId, onSelect }: { state: PropertyEmpireDomainState; engine: PropertyEmpireEngine; selectedTileId?: string; animatedPlayerId?: string; onSelect: (tileId: string, index: number) => void }) {
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-property-tile='true']"));
    const current = tiles.indexOf(event.currentTarget);
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    tiles[(current + direction + tiles.length) % tiles.length]?.focus();
  };

  return <div role="grid" aria-label="Property Empire 20-tile serpentine city route" className="grid grid-cols-5 grid-rows-4 gap-1 rounded-gameplay border-2 border-border-strong bg-[var(--game-board)] p-2 sm:gap-2 sm:p-3">
    {PROPERTY_EMPIRE_BOARD.map((tile) => {
      const ownerId = tile.type === "PROPERTY" ? engine.getPropertyOwner(state, tile.id) : undefined;
      const ownerIndex = ownerId ? state.players.findIndex((player) => player.id === ownerId) : -1;
      const tokens = state.players.filter((player) => player.position === tile.index && !player.bankrupt);
      const selected = selectedTileId === tile.id;
      return <div key={tile.id} role="gridcell" style={tilePosition(tile.index)} className="min-w-0">
        <button data-property-tile="true" aria-pressed={selected} aria-label={`Tile ${tile.index + 1}, ${tile.name}, ${tileMeta(tile)}${ownerId ? `, owned by ${state.players[ownerIndex]!.name}` : ""}${tokens.length ? `, tokens ${tokens.map((token) => token.marker).join(", ")}` : ""}`} onKeyDown={moveFocus} onClick={() => onSelect(tile.id, tile.index)} className={`relative flex min-h-20 w-full flex-col items-start overflow-hidden rounded-control border p-1.5 text-left text-[11px] transition-colors sm:min-h-28 sm:p-2 sm:text-xs ${selected ? "ring-2 ring-primary" : ""} ${tile.type === "PROPERTY" ? "bg-surface" : "bg-primary-subtle"}`} style={ownerIndex >= 0 ? { borderColor: `var(--player-${ownerIndex + 1}-border)`, borderWidth: 3 } : undefined}>
          <span className="font-data text-[9px] text-muted-foreground">{tile.index + 1}</span>
          <span className="line-clamp-2 font-bold">{tile.name}</span>
          <span className="mt-auto line-clamp-2 text-muted-foreground">{tileMeta(tile)}</span>
          {ownerId && <span className="mt-1 font-bold">Owner P{ownerIndex + 1} / {identities[ownerIndex]!.marker}</span>}
          <span className="absolute right-1 top-1 flex flex-wrap justify-end gap-0.5">{tokens.map((token) => {
            const playerIndex = state.players.findIndex((player) => player.id === token.id);
            return <span key={token.id} data-committed={animatedPlayerId === token.id || undefined} title={`${token.name}, ${identities[playerIndex]!.name} token`} style={{ backgroundColor: `var(--player-${playerIndex + 1}-subtle)`, borderColor: `var(--player-${playerIndex + 1}-border)` }} className="property-empire-token inline-flex size-5 items-center justify-center rounded-circle border font-bold">{token.marker}</span>;
          })}</span>
        </button>
      </div>;
    })}
  </div>;
}

export function PropertyDetailPanel({ state, engine, tileId }: { state: PropertyEmpireDomainState; engine: PropertyEmpireEngine; tileId?: string }) {
  const tile = PROPERTY_EMPIRE_BOARD.find((candidate) => candidate.id === tileId) ?? PROPERTY_EMPIRE_BOARD[state.players[state.currentPlayerIndex]!.position]!;
  const ownerId = tile.type === "PROPERTY" ? engine.getPropertyOwner(state, tile.id) : undefined;
  const owner = state.players.find((player) => player.id === ownerId);
  return <Card aria-live="polite">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected tile</p>
    <h2 className="mt-1 text-xl font-bold">{tile.name}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{tileMeta(tile)}</p>
    {tile.type === "PROPERTY" && <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">Owner</dt><dd className="font-semibold">{owner?.name ?? "City inventory"}</dd></div><div><dt className="text-muted-foreground">Status</dt><dd className="font-semibold">{state.pendingDecision?.propertyId === tile.id ? "Purchase decision" : owner ? "Owned" : "Available on landing"}</dd></div></dl>}
    {tile.type === "PROPERTY" && <p className="mt-3 rounded-control bg-muted p-2 text-xs text-muted-foreground">Auction, trade, mortgage, and structures are documented for later phases and are not active in this MVP.</p>}
  </Card>;
}

export function TransactionHistory({ state, open, onToggle }: { state: PropertyEmpireDomainState; open: boolean; onToggle: () => void }) {
  return <Card>
    <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold">Transactions</h2><Button size="compact" variant="ghost" aria-expanded={open} onClick={onToggle}>{open ? "Hide" : "Show"}</Button></div>
    {open && <ol className="mt-3 max-h-56 space-y-2 overflow-auto text-sm text-muted-foreground">{state.transactions.map((entry) => <li key={entry.id}><span className="font-data">T{entry.turnNumber}</span> / {entry.summary} Balance {entry.balanceAfter}.</li>)}{state.transactions.length === 0 && <li>No committed transactions yet.</li>}</ol>}
  </Card>;
}
