import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimationProvider, useAnimationQueue } from "./provider";
import { MotionSafe, ReducedMotionFallback } from "./primitives";

function Harness() { const { queue, state, setOverride } = useAnimationQueue(); return <><button onClick={() => queue.enqueue({ id: "test", type: "TEST", sourceEventId: "event", payload: {}, priority: "CRITICAL", blocking: true, skippable: false, durationMs: 1000, createdAt: 1 })}>enqueue</button><button onClick={() => setOverride("REDUCED")}>reduce</button><p role="status">{state.status}:{state.current?.type ?? "none"}</p><MotionSafe><ReducedMotionFallback fallback={<span>fallback</span>}><span>motion</span></ReducedMotionFallback></MotionSafe></>; }

describe("AnimationProvider", () => {
  it("owns disposable queue state and applies a reduced-motion fallback", () => {
    render(<AnimationProvider><Harness /></AnimationProvider>);
    fireEvent.click(screen.getByRole("button", { name: "enqueue" })); expect(screen.getByRole("status").textContent).toContain("PLAYING:TEST");
    fireEvent.click(screen.getByRole("button", { name: "reduce" })); expect(screen.getByText("fallback")).toBeTruthy();
  });
});
