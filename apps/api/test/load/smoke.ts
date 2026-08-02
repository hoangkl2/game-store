import autocannon from "autocannon";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function run(): Promise<void> {
const baseUrl = process.env.LOAD_BASE_URL;
if (!baseUrl) throw new Error("LOAD_BASE_URL is required; point it at an isolated Phase 10 environment");
const duration = Number(process.env.LOAD_DURATION_SECONDS ?? 15);
const connections = Number(process.env.LOAD_CONNECTIONS ?? 25);
const result = await autocannon({ url: `${baseUrl}/api/v1/health/live`, connections, duration, pipelining: 1, headers: { "x-load-profile": "phase-10-health-smoke" } });
const output = { generatedAt: new Date().toISOString(), profile: { duration, connections }, latency: result.latency, requests: result.requests, errors: result.errors, timeouts: result.timeouts, non2xx: result.non2xx };
const target = resolve(__dirname, "../../../test-results"); mkdirSync(target, { recursive: true }); writeFileSync(resolve(target, "phase-10-load-smoke.json"), JSON.stringify(output, null, 2));
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (result.errors > 0 || result.timeouts > 0 || result.non2xx > 0) process.exitCode = 1;
}

void run();
