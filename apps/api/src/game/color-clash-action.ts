import type { UnoAction } from "@game-store/game-uno";

export function isColorClashAction(value: unknown): value is UnoAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (typeof action.playerId !== "string") return false;
  if (action.type === "DRAW_CARD" || action.type === "PASS_TURN") return true;
  return action.type === "PLAY_CARD" && typeof action.cardId === "string" && (action.chosenColor === undefined || ["RED", "YELLOW", "GREEN", "BLUE"].includes(String(action.chosenColor)));
}
