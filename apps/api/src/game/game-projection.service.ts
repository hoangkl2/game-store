import { ForbiddenException, Injectable } from "@nestjs/common";
import { SeededRandomProvider } from "@game-store/game-core";
import { MoonVillageEngine, MoonVillageSeededRandomProvider, projectMoonVillageForTrustedModerator, type MoonVillageDomainState } from "@game-store/game-moon-village";
import { UnoEngine, type UnoEvent, type UnoGameState } from "@game-store/game-uno";
import { MetricsService } from "../observability/metrics.service";

export type ServerRecipient = { mode: "PLAYER"; playerId: string } | { mode: "SPECTATOR" } | { mode: "MODERATOR"; granted: boolean };

@Injectable()
export class GameProjectionService {
  constructor(private readonly metrics: MetricsService) {}
  colorClash(state: UnoGameState, recipient: ServerRecipient) {
    try {
      const engine = new UnoEngine(new SeededRandomProvider(1)); const currentPlayerId = state.players[state.currentPlayerIndex]!.id;
      const publicState = { gameType: "COLOR_CLASH" as const, gameVersion: state.gameVersion, phase: state.phase, currentColor: state.currentColor, currentPlayerId, direction: state.direction, turnNumber: state.turnNumber, topDiscard: structuredClone(state.discardPile.at(-1)!), drawPileCount: state.drawPile.length, players: state.players.map((player, seatIndex) => ({ playerId: player.id, displayName: player.name, seatIndex, handCount: player.hand.length, control: player.kind })) , winnerId: state.winnerId };
      if (recipient.mode === "SPECTATOR") return { ...publicState, legalActions: [] };
      if (recipient.mode === "MODERATOR") { if (!recipient.granted) throw new ForbiddenException("Moderator projection grant required"); return { ...publicState, legalActions: [], moderation: { stateVersion: state.stateVersion } }; }
      const player = state.players.find((candidate) => candidate.id === recipient.playerId); if (!player) throw new ForbiddenException("Player projection denied");
      return { ...publicState, ownHand: structuredClone(player.hand), legalActions: structuredClone(engine.getValidActions(state, recipient.playerId)) };
    } catch (error) { this.metrics.projectionFailures.inc(); throw error; }
  }
  moonVillage(state: MoonVillageDomainState, recipient: ServerRecipient) {
    try {
      const engine = new MoonVillageEngine(new MoonVillageSeededRandomProvider(1));
      if (recipient.mode === "SPECTATOR") return engine.projectPublic(state);
      if (recipient.mode === "MODERATOR") { if (!recipient.granted) throw new ForbiddenException("Moderator projection grant required"); return projectMoonVillageForTrustedModerator(engine, state); }
      return engine.projectForPlayer(state, recipient.playerId);
    } catch (error) { this.metrics.projectionFailures.inc(); throw error; }
  }
  publicColorClashEvent(event: UnoEvent): Record<string, unknown> {
    if (event.type === "CARD_DRAWN") return { type: event.type, playerId: event.playerId, count: 1 };
    if (event.type === "PENALTY_DRAWN") return { type: event.type, playerId: event.playerId, count: event.amount };
    return structuredClone(event);
  }
}
