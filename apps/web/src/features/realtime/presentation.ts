import type { AnimationQueue } from "@game-store/animation-core";
import type { AudioCommand } from "@game-store/audio-core";
import { RealtimeEventCursor, type ColorClashRealtimeEvent, type GameSnapshot } from "@game-store/realtime-core";
import { adaptColorClashEvent } from "@/features/animation/adapters";
import { adaptColorClashAudio } from "@/features/audio/adapters";

export type PresentationDelivery = { status: "DELIVERED" | "IGNORED" | "SNAPSHOT_REQUIRED"; animationCount: number; audioCount: number };
export function deliverColorClashCommittedEvent(event: ColorClashRealtimeEvent, cursor: RealtimeEventCursor, animation: AnimationQueue, submitAudio: (commands: readonly AudioCommand[]) => void): PresentationDelivery {
  const accepted = cursor.accept(event);
  if (accepted === "GAP") return { status: "SNAPSHOT_REQUIRED", animationCount: 0, audioCount: 0 };
  if (accepted !== "ACCEPTED") return { status: "IGNORED", animationCount: 0, audioCount: 0 };
  const domainEvent = event.payload.type === "CARD_PLAYED" || event.payload.type === "GAME_WON" ? event.payload : undefined;
  const animations = domainEvent ? adaptColorClashEvent(domainEvent, event.eventId, event.sequenceNumber) : []; const audio = domainEvent ? adaptColorClashAudio(domainEvent, event.eventId, event.sequenceNumber) : [];
  animation.enqueueMany(animations); submitAudio(audio);
  return { status: "DELIVERED", animationCount: animations.length, audioCount: audio.length };
}
export function resynchronizePresentation(snapshot: GameSnapshot<unknown>, cursor: RealtimeEventCursor, animation: AnimationQueue, resetAudio: () => void) { cursor.applySnapshot(snapshot); animation.resetForReconnect(); resetAudio(); }
