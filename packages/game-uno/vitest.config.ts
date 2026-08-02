import { defineConfig } from "vitest/config";

export default defineConfig({ test: { coverage: { provider: "v8", include: ["src/engine.ts", "src/bot.ts"], thresholds: { lines: 90, statements: 90, functions: 85, branches: 70 } } } });
