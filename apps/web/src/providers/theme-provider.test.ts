import { describe, expect, it } from "vitest";
import { gameplayStatusTokens, playerIdentities, semanticColorTokens } from "@game-store/ui";
import { applyTheme, resolveTheme } from "./theme-provider";

describe("theme foundation", () => {
  it("resolves system and explicit theme modes", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("high-contrast-light", true)).toBe("light");
    expect(resolveTheme("high-contrast-dark", false)).toBe("dark");
  });

  it("applies dark and high-contrast semantic state to the root", () => {
    const root = document.createElement("html");
    applyTheme("high-contrast-dark", root, false);
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.dataset).toMatchObject({ theme: "dark", contrast: "high" });
    applyTheme("light", root, true);
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.dataset).toMatchObject({ theme: "light", contrast: "normal" });
  });

  it("exports semantic, gameplay, and non-color player identity tokens", () => {
    expect(semanticColorTokens).toEqual(expect.arrayContaining(["primary", "danger", "focus-ring", "surface-elevated"]));
    expect(gameplayStatusTokens).toEqual(expect.arrayContaining(["active-turn", "valid-action", "reconnecting"]));
    expect(playerIdentities).toHaveLength(8);
    expect(playerIdentities.every((player) => player.symbol.length > 0 && player.pattern.length > 0)).toBe(true);
  });
});
