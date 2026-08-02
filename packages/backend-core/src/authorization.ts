export type PlatformRole = "PLAYER" | "MODERATOR" | "ADMINISTRATOR" | "SUPPORT" | "SYSTEM_BOT";
export type AuthorizedOperation = "MANAGE_ROOM" | "SUBMIT_GAME_ACTION" | "SUBMIT_BOT_ACTION" | "VIEW_PLAYER_PROJECTION" | "VIEW_SPECTATOR_PROJECTION" | "VIEW_MODERATOR_PROJECTION" | "VIEW_SUPPORT_DIAGNOSTICS";

export interface AuthorizationContext {
  identityId: string;
  accountStatus: "ACTIVE" | "GUEST" | "SUSPENDED" | "DISABLED";
  roles: readonly PlatformRole[];
  room?: { membershipIdentityId: string; isHost: boolean; isSpectator: boolean };
  session?: { seatIdentityId: string; playerId: string; control: "HUMAN" | "BOT"; moderatorGrant?: boolean };
}

export interface AuthorizationRequest {
  operation: AuthorizedOperation;
  suppliedPlayerId?: string;
}

export type AuthorizationResult = { allowed: true } | { allowed: false; code: "IDENTITY_DISABLED" | "NOT_MEMBER" | "NOT_HOST" | "SEAT_MISMATCH" | "CONTROL_MISMATCH" | "MISSING_GRANT" };

export function authorize(context: AuthorizationContext, request: AuthorizationRequest): AuthorizationResult {
  if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DISABLED") return { allowed: false, code: "IDENTITY_DISABLED" };
  if (request.operation === "MANAGE_ROOM") {
    if (!context.room || context.room.membershipIdentityId !== context.identityId) return { allowed: false, code: "NOT_MEMBER" };
    return context.room.isHost ? { allowed: true } : { allowed: false, code: "NOT_HOST" };
  }
  if (request.operation === "VIEW_SPECTATOR_PROJECTION") return context.room?.membershipIdentityId === context.identityId && context.room.isSpectator ? { allowed: true } : { allowed: false, code: "NOT_MEMBER" };
  if (request.operation === "VIEW_MODERATOR_PROJECTION") return context.roles.includes("MODERATOR") && context.session?.moderatorGrant ? { allowed: true } : { allowed: false, code: "MISSING_GRANT" };
  if (request.operation === "VIEW_SUPPORT_DIAGNOSTICS") return context.roles.includes("SUPPORT") || context.roles.includes("ADMINISTRATOR") ? { allowed: true } : { allowed: false, code: "MISSING_GRANT" };
  if (!context.session || context.session.seatIdentityId !== context.identityId || request.suppliedPlayerId !== context.session.playerId) return { allowed: false, code: "SEAT_MISMATCH" };
  if (request.operation === "SUBMIT_BOT_ACTION") return context.roles.includes("SYSTEM_BOT") && context.session.control === "BOT" ? { allowed: true } : { allowed: false, code: "CONTROL_MISMATCH" };
  if (context.session.control !== "HUMAN") return { allowed: false, code: "CONTROL_MISMATCH" };
  return { allowed: true };
}
