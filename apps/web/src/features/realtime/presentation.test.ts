import { describe, expect, it, vi } from "vitest";
import { AnimationQueue } from "@game-store/animation-core";
import { RealtimeEventCursor, type ColorClashRealtimeEvent } from "@game-store/realtime-core";
import { deliverColorClashCommittedEvent, resynchronizePresentation } from "./presentation";

const committed: ColorClashRealtimeEvent = { eventId: "event-1", sequenceNumber: 1, gameSessionId: "game-1", stateVersion: 2, type: "CARD_PLAYED", occurredAt: "2026-08-02T00:00:00.000Z", payload: { type: "CARD_PLAYED", playerId: "p1", card: { id: "red-4", color: "RED", type: "NUMBER", number: 4 } } };
describe("realtime presentation delivery", () => {
  it("enqueues animation and audio exactly once for a committed event", () => { const cursor = new RealtimeEventCursor(); const queue = new AnimationQueue(); const audio = vi.fn(); expect(deliverColorClashCommittedEvent(committed, cursor, queue, audio)).toMatchObject({ status: "DELIVERED", animationCount: 1, audioCount: 1 }); expect(deliverColorClashCommittedEvent(committed, cursor, queue, audio)).toMatchObject({ status: "IGNORED" }); expect(queue.snapshot().current?.sourceEventId).toBe("event-1"); expect(audio).toHaveBeenCalledTimes(1); });
  it("requests a snapshot on a gap and clears historical presentation on resync", () => { const cursor = new RealtimeEventCursor(); const queue = new AnimationQueue(); const audio = vi.fn(); const gap = { ...committed, eventId: "event-2", sequenceNumber: 2 }; expect(deliverColorClashCommittedEvent(gap, cursor, queue, audio).status).toBe("SNAPSHOT_REQUIRED"); const resetAudio = vi.fn(); resynchronizePresentation({ protocolVersion: 1, gameSessionId: "game-1", stateVersion: 4, serverTime: "now", recipient: { type: "PLAYER", playerId: "p1" }, projection: {}, status: "ACTIVE", lastEventSequence: 3 }, cursor, queue, resetAudio); expect(cursor.currentSequence()).toBe(3); expect(queue.snapshot().queue).toEqual([]); expect(resetAudio).toHaveBeenCalledOnce(); });
});
