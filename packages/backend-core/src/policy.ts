export type RateLimitScope = "LOGIN" | "REGISTRATION" | "PASSWORD_RESET" | "ROOM_CREATE" | "ROOM_JOIN" | "INVITATION" | "MATCHMAKING" | "GAME_ACTION_BURST" | "GAME_ACTION_SUSTAINED" | "CHAT" | "RECONNECT" | "SNAPSHOT" | "SPECTATOR_JOIN" | "MODERATION";
export interface RateLimitPolicy { limit: number; windowSeconds: number; keyParts: readonly ("IDENTITY" | "SESSION" | "NETWORK_RISK")[] }

export const RATE_LIMIT_POLICIES: Readonly<Record<RateLimitScope, RateLimitPolicy>> = {
  LOGIN: { limit: 5, windowSeconds: 900, keyParts: ["IDENTITY", "NETWORK_RISK"] },
  REGISTRATION: { limit: 3, windowSeconds: 3600, keyParts: ["NETWORK_RISK"] },
  PASSWORD_RESET: { limit: 3, windowSeconds: 3600, keyParts: ["IDENTITY", "NETWORK_RISK"] },
  ROOM_CREATE: { limit: 10, windowSeconds: 3600, keyParts: ["IDENTITY", "NETWORK_RISK"] },
  ROOM_JOIN: { limit: 30, windowSeconds: 600, keyParts: ["IDENTITY", "NETWORK_RISK"] },
  INVITATION: { limit: 20, windowSeconds: 3600, keyParts: ["IDENTITY"] },
  MATCHMAKING: { limit: 10, windowSeconds: 60, keyParts: ["IDENTITY"] },
  GAME_ACTION_BURST: { limit: 10, windowSeconds: 1, keyParts: ["IDENTITY", "SESSION"] },
  GAME_ACTION_SUSTAINED: { limit: 60, windowSeconds: 60, keyParts: ["IDENTITY", "SESSION"] },
  CHAT: { limit: 10, windowSeconds: 10, keyParts: ["IDENTITY", "SESSION"] },
  RECONNECT: { limit: 12, windowSeconds: 60, keyParts: ["IDENTITY", "NETWORK_RISK"] },
  SNAPSHOT: { limit: 6, windowSeconds: 60, keyParts: ["IDENTITY", "SESSION"] },
  SPECTATOR_JOIN: { limit: 20, windowSeconds: 3600, keyParts: ["IDENTITY", "NETWORK_RISK"] },
  MODERATION: { limit: 20, windowSeconds: 60, keyParts: ["IDENTITY", "SESSION"] }
};

const forbiddenLogKeys = /password|secret|token|cookie|authorization|private|role|hand|deck/i;

export function redactStructuredMetadata(input: Readonly<Record<string, unknown>>, maximumStringLength = 256): Record<string, unknown> {
  if (!Number.isInteger(maximumStringLength) || maximumStringLength < 16) throw new Error("Invalid log string limit");
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (forbiddenLogKeys.test(key)) output[key] = "[REDACTED]";
    else if (typeof value === "string") output[key] = value.replace(/[\r\n\t]/g, " ").slice(0, maximumStringLength);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) output[key] = value;
  }
  return output;
}
