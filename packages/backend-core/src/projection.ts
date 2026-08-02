export type ProjectionMode = "PLAYER" | "OPPONENT" | "TEAMMATE" | "SPECTATOR" | "MODERATOR";

export interface ProjectionRecipient {
  identityId: string;
  mode: ProjectionMode;
  playerId?: string;
  subjectPlayerId?: string;
}

export interface ProjectionGrant {
  identityId: string;
  playerId?: string;
  modes: readonly ProjectionMode[];
}

export interface GameProjectionAdapter<TState> {
  player(state: TState, playerId: string): unknown;
  opponent(state: TState, recipientPlayerId: string, subjectPlayerId: string): unknown;
  teammate(state: TState, playerId: string): unknown;
  spectator(state: TState): unknown;
  moderator(state: TState): unknown;
}

export class ProjectionService {
  project<TState>(state: TState, recipient: ProjectionRecipient, grant: ProjectionGrant, adapter: GameProjectionAdapter<TState>): unknown {
    if (recipient.identityId !== grant.identityId || !grant.modes.includes(recipient.mode)) throw new Error("PROJECTION_ACCESS_DENIED");
    if (recipient.mode === "SPECTATOR") return structuredClone(adapter.spectator(state));
    if (recipient.mode === "MODERATOR") return structuredClone(adapter.moderator(state));
    if (!recipient.playerId || recipient.playerId !== grant.playerId) throw new Error("PROJECTION_ACCESS_DENIED");
    if (recipient.mode === "OPPONENT") {
      if (!recipient.subjectPlayerId || recipient.subjectPlayerId === recipient.playerId) throw new Error("PROJECTION_ACCESS_DENIED");
      return structuredClone(adapter.opponent(state, recipient.playerId, recipient.subjectPlayerId));
    }
    return structuredClone(recipient.mode === "TEAMMATE" ? adapter.teammate(state, recipient.playerId) : adapter.player(state, recipient.playerId));
  }
}
