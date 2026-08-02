export const themeModes = ["light", "dark", "system", "high-contrast-light", "high-contrast-dark"] as const;
export const semanticColorTokens = [
  "background", "foreground", "surface", "surface-elevated", "surface-overlay", "popover", "popover-foreground",
  "primary", "secondary", "accent", "success", "warning", "danger", "info", "muted", "border", "border-strong",
  "divider", "disabled", "input", "focus-ring", "scrim",
] as const;
export const gameplayStatusTokens = [
  "active-turn", "waiting", "ready", "not-ready", "bot-thinking", "valid-action", "invalid-action", "selected-action",
  "targeted-player", "protected-player", "eliminated-player", "disconnected-player", "spectator", "winner", "second",
  "third", "low-time", "critical-time", "unstable-connection", "reconnecting",
] as const;
export const gameThemes = ["property-empire", "royal-race", "color-clash", "moon-village"] as const;
export const playerIdentities = [
  { id: 1, symbol: "circle", pattern: "diagonal-stripes" }, { id: 2, symbol: "triangle", pattern: "dots" },
  { id: 3, symbol: "square", pattern: "grid" }, { id: 4, symbol: "diamond", pattern: "crosshatch" },
  { id: 5, symbol: "star", pattern: "waves" }, { id: 6, symbol: "hexagon", pattern: "chevron" },
  { id: 7, symbol: "plus", pattern: "vertical-stripes" }, { id: 8, symbol: "crescent", pattern: "checker" },
] as const;
export const radiusTokens = ["none", "control", "input", "button", "card", "elevated", "dialog", "gameplay", "pill", "circle"] as const;

export type ThemeMode = (typeof themeModes)[number];
export type SemanticColorToken = (typeof semanticColorTokens)[number];
export type GameplayStatusToken = (typeof gameplayStatusTokens)[number];
export type GameTheme = (typeof gameThemes)[number];
export type PlayerIdentity = (typeof playerIdentities)[number];
export type RadiusToken = (typeof radiusTokens)[number];
