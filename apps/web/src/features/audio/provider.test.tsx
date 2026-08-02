import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AudioCaption, EnableSoundControl } from "./primitives";
import { AudioProvider, useAudio } from "./provider";

function Harness() { const { submit, setPreferences } = useAudio(); return <><EnableSoundControl /><AudioCaption /><button onClick={() => submit([{ id: "caption", category: "GAMEPLAY", priority: "NORMAL", assetId: "color-card-played", sourceEventId: "event", authorizedAudience: "PUBLIC", caption: "Committed cue.", createdAt: 1 }])}>cue</button><button onClick={() => setPreferences({ masterEnabled: false })}>mute</button></>; }
describe("AudioProvider", () => {
  it("keeps captions available when master sound is muted and reports unavailable browser audio", async () => {
    render(<AudioProvider><Harness /></AudioProvider>);
    fireEvent.click(screen.getByRole("button", { name: "cue" })); expect(screen.getByRole("status").textContent).toContain("Committed cue.");
    fireEvent.click(screen.getByRole("button", { name: "mute" })); expect(screen.getByRole("status").textContent).toContain("Committed cue.");
    fireEvent.click(screen.getByRole("button", { name: "Enable sound" })); await waitFor(() => expect(screen.getByText("Sound is unavailable in this browser.")).toBeTruthy());
  });
});
