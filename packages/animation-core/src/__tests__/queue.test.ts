import { describe, expect, it, vi } from "vitest";
import { AnimationQueue, effectiveDuration, type AnimationCommand } from "..";

const command = (id: string, overrides: Partial<AnimationCommand> = {}): AnimationCommand => ({ id, type: "TOKEN_MOVED", sourceEventId: `event-${id}`, sourceEventSequence: 1, payload: { targetId: id }, priority: "NORMAL", blocking: false, skippable: true, durationMs: 200, createdAt: 1, ...overrides });

describe("AnimationQueue", () => {
  it("plays commands in deterministic order and supports grouped parallel commands", () => {
    const queue = new AnimationQueue(); queue.enqueueMany([command("one"), command("two", { groupId: "move" }), command("three", { groupId: "move" }), command("four")]);
    expect(queue.snapshot().current?.id).toBe("one"); queue.complete();
    expect(queue.snapshot().current?.id).toBe("two"); expect(queue.snapshot().parallel.map((item) => item.id)).toEqual(["three"]);
    queue.complete("two"); expect(queue.snapshot().current?.id).toBe("three"); queue.complete("three"); expect(queue.snapshot().current?.id).toBe("four");
  });
  it("rejects invalid/duplicate commands and coerces decorative work nonblocking", () => {
    const queue = new AnimationQueue(); queue.enqueue(command("same")); queue.enqueue(command("same")); expect(queue.snapshot().queue).toHaveLength(0);
    queue.enqueue(command("decor", { priority: "DECORATIVE", blocking: true })); queue.complete("same"); expect(queue.snapshot().current).toMatchObject({ id: "decor", blocking: false });
    expect(() => queue.enqueue(command("bad", { durationMs: -1 }))).toThrow("Invalid");
  });
  it("pauses, skips, fast-forwards, and only blocks for critical commands", () => {
    const queue = new AnimationQueue(); queue.enqueue(command("critical", { priority: "CRITICAL", blocking: true, skippable: false })); expect(queue.isInputBlocked()).toBe(true); queue.skipCurrent(); expect(queue.snapshot().current?.id).toBe("critical"); queue.pause(); expect(queue.snapshot().status).toBe("PAUSED"); queue.resume(); queue.complete();
    queue.enqueueMany([command("normal"), command("dec", { priority: "DECORATIVE" }), command("kept", { skippable: false })]); queue.fastForward(); expect(queue.snapshot().current?.id).toBe("kept"); expect(queue.snapshot().queue).toHaveLength(0);
  });
  it("cancels groups, clears obsolete work, and resets safely for reconnect", () => {
    const queue = new AnimationQueue(); const listener = vi.fn(); queue.subscribe(listener);
    queue.enqueueMany([command("active", { groupId: "old", sourceEventSequence: 2 }), command("old-next", { groupId: "old", sourceEventSequence: 2 }), command("fresh", { sourceEventSequence: 4 })]); queue.cancelGroup("old"); expect(queue.snapshot().current?.id).toBe("fresh");
    queue.enqueue(command("obsolete", { sourceEventSequence: 1 })); queue.clearObsolete(3); expect(queue.snapshot().queue.map((item) => item.id)).not.toContain("obsolete"); queue.resetForReconnect(); expect(queue.snapshot()).toMatchObject({ status: "IDLE", queue: [], parallel: [] }); expect(listener).toHaveBeenCalled();
  });
  it("handles reduced motion, speed, hidden tabs, and does not mutate input", () => {
    const input = command("input", { payload: { nested: "safe" } }); const original = JSON.stringify(input); const queue = new AnimationQueue(); queue.enqueue(input); expect(JSON.stringify(input)).toBe(original);
    queue.setDocumentHidden(true); expect(queue.snapshot().status).toBe("PAUSED"); queue.setDocumentHidden(false); expect(queue.snapshot().status).toBe("PLAYING"); queue.setReducedMotion(true); expect(queue.snapshot().current).toBeUndefined();
    const hiddenQueue = new AnimationQueue(); hiddenQueue.setDocumentHidden(true); hiddenQueue.enqueue(command("hidden")); expect(hiddenQueue.snapshot().current).toBeUndefined(); hiddenQueue.setDocumentHidden(false); expect(hiddenQueue.snapshot().current?.id).toBe("hidden");
    expect(effectiveDuration(300, "OFF", false, "NORMAL")).toBe(0); expect(effectiveDuration(300, "NORMAL", true, "CRITICAL")).toBe(80); expect(effectiveDuration(300, "FAST", false, "NORMAL")).toBe(165); expect(effectiveDuration(1600, "SLOW", false, "NORMAL")).toBe(1800);
  });
});
