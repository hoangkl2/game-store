import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node20",
  sourcemap: true,
  outDir: "dist",
  clean: true,
  splitting: false,
  noExternal: [/^@game-store\//]
});
