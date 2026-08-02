import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", coverage: { provider: "v8", include: ["src/**/*.ts"], exclude: ["src/types.ts", "src/__tests__/**"], thresholds: { lines: 90, statements: 90, functions: 85, branches: 75 } } } });
