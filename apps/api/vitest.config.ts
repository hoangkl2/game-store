import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/config/environment.ts",
        "src/game/color-clash-action.ts",
        "src/game/game-projection.service.ts",
        "src/game/state-cipher.service.ts"
      ],
      exclude: ["src/**/*.test.ts", "src/main.ts"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 }
    }
  }
});
