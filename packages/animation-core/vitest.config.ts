import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", coverage: { provider: "v8", include: ["src/queue.ts", "src/tokens.ts"], thresholds: { lines: 90, statements: 90, functions: 85, branches: 75 } } } });
