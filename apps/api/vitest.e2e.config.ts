import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/e2e/**/*.test.ts"], setupFiles: ["test/e2e/setup-env.ts"], testTimeout: 120_000, hookTimeout: 60_000, fileParallelism: false }
});
