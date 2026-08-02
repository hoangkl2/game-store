import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MoonVillagePlayerProjection } from "@game-store/game-moon-village";
import { PrivateActionPanel, PrivateRolePanel, PublicChronicle, VillageResidentGrid } from "./components";

const projection: MoonVillagePlayerProjection = {
  public: {
    projectionVersion: 1, phase: "DAY_VOTING", round: 2, maxRounds: 6, sequence: 9,
    players: [
      { id: "human", name: "You", kind: "HUMAN", alive: true, seat: 0 },
      { id: "mira", name: "Mira", kind: "BOT", alive: true, seat: 1 },
      { id: "tao", name: "Tao", kind: "BOT", alive: false, seat: 2 },
    ],
    publicLog: ["Dawn 2: Tao left the village."], discussionMessages: ["Mira: The vote trail matters."], draw: false,
  },
  private: {
    playerId: "human", role: "STAR_READER", roleName: "Star Reader", team: "DAWN", alive: true,
    legalActions: [{ type: "CAST_VOTE", playerId: "human", targetPlayerId: "mira" }],
    knowledge: [{ targetPlayerId: "mira", team: "DUSK", learnedRound: 1 }], privateLog: ["Mira is aligned with Dusk."], restoreAvailable: true, markAvailable: true,
  },
};

describe("Moon Village projected components", () => {
  it("renders public residents and chronology without private roles or knowledge", () => {
    const { container } = render(<><VillageResidentGrid projection={projection} /><PublicChronicle projection={projection} /></>);
    expect(screen.getByText("Mira")).toBeTruthy(); expect(screen.getByText("Departed")).toBeTruthy();
    expect(container.textContent).not.toContain("Star Reader"); expect(container.textContent).not.toContain("aligned with Dusk");
  });

  it("keeps the authorized role covered until an explicit reveal", () => {
    function Harness() { const [covered, setCovered] = useState(true); return <PrivateRolePanel projection={projection} covered={covered} onReveal={() => setCovered(false)} />; }
    const { container } = render(<Harness />);
    expect(container.textContent).not.toContain("Star Reader"); fireEvent.click(screen.getByRole("button", { name: "Reveal my role" }));
    expect(screen.getByText("Star Reader")).toBeTruthy(); expect(screen.getByText("Mira is aligned with Dusk.")).toBeTruthy();
  });

  it("submits only projected actions and supports arrow-key target navigation", () => {
    const onAction = vi.fn(); const withTargets: MoonVillagePlayerProjection = { ...projection, private: { ...projection.private, legalActions: [{ type: "CAST_VOTE", playerId: "human", targetPlayerId: "mira" }, { type: "CAST_VOTE", playerId: "human", targetPlayerId: "tao" }] } };
    render(<PrivateActionPanel projection={withTargets} disabled={false} onAction={onAction} />);
    const first = screen.getByRole("button", { name: "Vote for Mira" }); const second = screen.getByRole("button", { name: "Vote for Tao" });
    first.focus(); fireEvent.keyDown(first.parentElement!, { key: "ArrowRight" }); expect(document.activeElement).toBe(second);
    fireEvent.click(second); expect(onAction).toHaveBeenCalledWith({ type: "CAST_VOTE", playerId: "human", targetPlayerId: "tao" });
  });
});
