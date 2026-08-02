export type CatalogGame = { slug: string; name: string; description: string; players: string; duration: string; modes: string[]; status: "playable" | "planned"; accent: string; };
export const catalogGames: CatalogGame[] = [
  { slug: "uno", name: "UNO", description: "A fast, colour-matching card game for a short offline match.", players: "2–4 players", duration: "10–20 min", modes: ["Offline", "Bots", "Local"], status: "playable", accent: "var(--game-highlight)" },
  { slug: "property-empire", name: "Property Empire", description: "Build an original city portfolio across a winding economic route.", players: "2–4 players", duration: "20–45 min", modes: ["Offline", "Bots", "Local"], status: "playable", accent: "var(--game-highlight)" },
  { slug: "royal-race", name: "Royal Race", description: "An original patterned-token race with deterministic offline bot play.", players: "2–4 players", duration: "20–35 min", modes: ["Offline", "Bots", "Local"], status: "playable", accent: "var(--player-4)" },
  { slug: "color-clash", name: "Color Clash", description: "An original colour-and-pattern shedding game with offline bot play.", players: "2–4 players", duration: "15–30 min", modes: ["Offline", "Bots", "Local"], status: "playable", accent: "#e3a728" },
  { slug: "moon-village", name: "Moon Village", description: "Read the lantern-lit village and protect its secrets in an original deduction game.", players: "5–8 players", duration: "20–45 min", modes: ["Offline", "Bots"], status: "playable", accent: "var(--player-4)" },
];
export const getCatalogGame = (slug: string) => catalogGames.find((game) => game.slug === slug);
