import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

async function run(): Promise<void> {
const port = 4099;
const child = spawn(process.execPath, [resolve(__dirname, "../dist/main.js")], {
  cwd: resolve(__dirname, "../../.."),
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: "development", PORT: String(port), INSTANCE_ID: "api-smoke-1",
    DATABASE_URL: "postgresql://game_store:local_only@127.0.0.1:54329/game_store", DATABASE_REQUIRED: "false",
    REDIS_URL: "redis://127.0.0.1:6399", REDIS_REQUIRED: "false", REDIS_KEY_PREFIX: "gs:smoke:v1:",
    ACCESS_TOKEN_SECRET: "smoke-access-token-secret-at-least-32-bytes", ACCESS_TOKEN_ISSUER: "game-store-api", ACCESS_TOKEN_AUDIENCE: "game-store-web",
    ACCESS_TOKEN_TTL_SECONDS: "600", REFRESH_TOKEN_TTL_SECONDS: "86400", STATE_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    COOKIE_SECURE: "false", COOKIE_SAME_SITE: "lax", CORS_ORIGINS: "http://localhost:3000", CSRF_COOKIE_NAME: "gs_csrf", REFRESH_COOKIE_NAME: "gs_refresh",
    MAX_HTTP_BODY_BYTES: "16384", MAX_SOCKET_PAYLOAD_BYTES: "8192", TRUST_PROXY: "false"
  }
});
let diagnostics = "";
child.stdout.on("data", (chunk) => { diagnostics = `${diagnostics}${String(chunk)}`.slice(-4000); });
child.stderr.on("data", (chunk) => { diagnostics = `${diagnostics}${String(chunk)}`.slice(-4000); });

try {
  let payload: { status: string; instanceId: string } | undefined;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API exited with ${child.exitCode}: ${diagnostics}`);
    try {
      const live = await fetch(`http://127.0.0.1:${port}/api/v1/health/live`); const ready = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`); const metrics = await fetch(`http://127.0.0.1:${port}/api/v1/metrics`);
      if (live.ok && ready.ok && metrics.ok && (await metrics.text()).includes("game_store_process_")) { payload = await live.json() as { status: string; instanceId: string }; break; }
    } catch { /* startup retry */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
  }
  if (!payload) throw new Error(`Runtime readiness timed out: ${diagnostics}`);
  process.stdout.write(`Nest runtime smoke: PASS instance=${payload.instanceId} status=${payload.status}\n`);
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise((resolveDelay) => setTimeout(resolveDelay, 5000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
}

void run();
