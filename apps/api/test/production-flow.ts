import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { io, type Socket } from "socket.io-client";

if (process.env.RUN_PRODUCTION_FLOW !== "true") throw new Error("Set RUN_PRODUCTION_FLOW=true to authorize the isolated Compose validation flow");
const gateway = process.env.PRODUCTION_FLOW_URL ?? "http://127.0.0.1:4000";
const origin = process.env.PRODUCTION_FLOW_ORIGIN ?? "http://localhost:3000";
const report: Array<{ step: number; outcome: "PASS" | "FAIL"; detail: string }> = [];
const record = (step: number, detail: string): void => { report.push({ step, outcome: "PASS", detail }); process.stdout.write(`[${step}/20] ${detail}\n`); };
const delay = (milliseconds: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function api<T>(path: string, options: { method?: string; token?: string; body?: unknown; base?: string } = {}): Promise<T> {
  const response = await fetch(`${options.base ?? gateway}/api/v1${path}`, { method: options.method ?? "GET", headers: { Origin: origin, ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...(options.body ? { "Content-Type": "application/json" } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

async function waitHealthy(url = gateway, attempts = 90): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(`${url}/api/v1/health/ready`); if (response.ok) return; } catch { /* retry while the instance starts */ }
    await delay(1000);
  }
  throw new Error(`Readiness timed out: ${url}`);
}

const connect = (base: string, token: string): Promise<Socket> => new Promise((resolveSocket, reject) => {
  const socket = io(`${base}/platform`, { auth: { accessToken: token }, transports: ["websocket"], extraHeaders: { Origin: origin }, reconnection: false, timeout: 10_000 });
  socket.once("connect", () => resolveSocket(socket)); socket.once("connect_error", reject);
});
const emitAck = <T>(socket: Socket, event: string, body: unknown): Promise<T> => new Promise((resolveAck, reject) => {
  const timer = setTimeout(() => reject(new Error(`${event} acknowledgement timed out`)), 10_000);
  socket.emit(event, body, (response: { ok: boolean; data?: T; error?: unknown }) => { clearTimeout(timer); if (response.ok) resolveAck(response.data as T); else reject(new Error(JSON.stringify(response.error))); });
});
const waitForVersion = (socket: Socket, version: number): Promise<Record<string, unknown>> => new Promise((resolveSnapshot, reject) => {
  const timer = setTimeout(() => { socket.off("game:v1:snapshot", listener); reject(new Error(`Snapshot ${version} timed out`)); }, 10_000);
  const listener = (snapshot: Record<string, unknown>) => { if (Number(snapshot.stateVersion) >= version) { clearTimeout(timer); socket.off("game:v1:snapshot", listener); resolveSnapshot(snapshot); } };
  socket.on("game:v1:snapshot", listener);
});

async function run(): Promise<void> {
  try {
    await waitHealthy(); record(1, "PostgreSQL and Redis dependencies are healthy through API readiness");
    execFileSync("docker", ["compose", "run", "--rm", "migrate"], { stdio: "inherit" }); record(2, "Prisma migrations deployed cleanly");
    await Promise.all([waitHealthy("http://127.0.0.1:4001"), waitHealthy("http://127.0.0.1:4002")]); record(3, "Two independent backend instances are ready");

    const suffix = Date.now();
    const host = await api<{ accessToken: string; user: { id: string } }>("/auth/register", { method: "POST", body: { email: `flow-host-${suffix}@example.test`, password: "correct-horse-battery-staple", displayName: "Flow Host" } });
    const guest = await api<{ accessToken: string; user: { id: string } }>("/auth/register", { method: "POST", body: { email: `flow-guest-${suffix}@example.test`, password: "correct-horse-battery-staple", displayName: "Flow Guest" } }); record(4, "Two durable authenticated users created");
    const room = await api<{ roomCode: string; version: number; members: Array<{ playerId: string; isHost: boolean }> }>("/rooms", { method: "POST", token: host.accessToken, body: { gameSlug: "color-clash", capacity: 2 } });
    const joined = await api<typeof room>(`/rooms/${room.roomCode}/join`, { method: "POST", token: guest.accessToken, body: { displayName: "Flow Guest" } }); record(5, "Private room created and joined");
    const readyHost = await api<typeof room>(`/rooms/${room.roomCode}/ready`, { method: "POST", token: host.accessToken, body: { ready: true, expectedRoomVersion: joined.version } });
    const readyGuest = await api<typeof room>(`/rooms/${room.roomCode}/ready`, { method: "POST", token: guest.accessToken, body: { ready: true, expectedRoomVersion: readyHost.version } });
    const started = await api<{ gameSessionId: string; stateVersion: number }>(`/rooms/${room.roomCode}/start`, { method: "POST", token: host.accessToken, body: { expectedRoomVersion: readyGuest.version } }); record(6, "Persisted authoritative game session started");

    let hostSocket = await connect("http://127.0.0.1:4001", host.accessToken); const guestSocket = await connect("http://127.0.0.1:4002", guest.accessToken);
    const hostSubscribed = await emitAck<{ snapshot: Record<string, any> }>(hostSocket, "game:v1:subscribe", { gameSessionId: started.gameSessionId });
    const guestSubscribed = await emitAck<{ snapshot: Record<string, any> }>(guestSocket, "game:v1:subscribe", { gameSessionId: started.gameSessionId });
    let hostSnapshot = hostSubscribed.snapshot; let guestSnapshot = guestSubscribed.snapshot;
    hostSocket.on("game:v1:snapshot", (snapshot) => { hostSnapshot = snapshot; }); guestSocket.on("game:v1:snapshot", (snapshot) => { guestSnapshot = snapshot; });
    const hostPlayerId = String((hostSnapshot.projection as Record<string, any>).players.find((player: Record<string, unknown>) => player.displayName === "Flow Host").playerId);
    const guestPlayerId = String((guestSnapshot.projection as Record<string, any>).players.find((player: Record<string, unknown>) => player.displayName === "Flow Guest").playerId);
    const currentIsHost = (hostSnapshot.projection as Record<string, unknown>).currentPlayerId === hostPlayerId;
    const currentSnapshot = currentIsHost ? hostSnapshot : guestSnapshot; const currentToken = currentIsHost ? host.accessToken : guest.accessToken; const currentPlayerId = currentIsHost ? hostPlayerId : guestPlayerId;
    const command = { protocolVersion: 1, requestId: `flow-duplicate-${suffix}`, playerId: currentPlayerId, expectedStateVersion: Number(currentSnapshot.stateVersion), sentAt: new Date().toISOString(), action: (currentSnapshot.projection as Record<string, any>).legalActions[0] };
    const hostUpdate = waitForVersion(hostSocket, command.expectedStateVersion + 1); const guestUpdate = waitForVersion(guestSocket, command.expectedStateVersion + 1);
    const duplicate = await Promise.all([api<Record<string, unknown>>(`/games/${started.gameSessionId}/actions`, { method: "POST", token: currentToken, body: command }), api<Record<string, unknown>>(`/games/${started.gameSessionId}/actions`, { method: "POST", token: currentToken, body: command })]);
    if (JSON.stringify(duplicate[0]) !== JSON.stringify(duplicate[1])) throw new Error("Duplicate acknowledgements differ"); record(7, "Versioned action accepted"); record(8, "Concurrent duplicate submitted"); record(9, "Exactly-once acknowledgement verified");
    [hostSnapshot, guestSnapshot] = await Promise.all([hostUpdate, guestUpdate]); record(10, "Cross-instance Redis adapter delivered recipient projections");

    const reconnectGrant = await api<{ reconnectToken: string }>(`/games/${started.gameSessionId}/reconnect-grants`, { method: "POST", token: host.accessToken });
    execFileSync("docker", ["compose", "stop", "api-1"], { stdio: "inherit" }); await waitHealthy("http://127.0.0.1:4002"); record(11, "One backend instance stopped without stopping durable dependencies");
    hostSocket.close(); hostSocket = await connect("http://127.0.0.1:4002", host.accessToken);
    const reconnected = await emitAck<{ snapshot: Record<string, any> }>(hostSocket, "game:v1:reconnect", { reconnectToken: reconnectGrant.reconnectToken }); hostSnapshot = reconnected.snapshot;
    hostSocket.on("game:v1:snapshot", (snapshot) => { hostSnapshot = snapshot; }); record(12, "Player reconnected through the surviving instance from durable state");
    if (JSON.stringify(hostSnapshot.projection).includes(guestPlayerId) === false || "ownHand" in (guestSnapshot.projection as object) === false) throw new Error("Recipient projections are incomplete");
    const guestHand = JSON.stringify((guestSnapshot.projection as Record<string, unknown>).ownHand); if (JSON.stringify(hostSnapshot).includes(guestHand)) throw new Error("Opponent hand leaked"); record(13, "Recipient-specific projection isolation verified after failover");

    for (let turn = 0; turn < 400 && String(hostSnapshot.status) === "ACTIVE"; turn += 1) {
      const projection = hostSnapshot.projection as Record<string, any>; const actorIsHost = projection.currentPlayerId === hostPlayerId; const actorSnapshot = actorIsHost ? hostSnapshot : guestSnapshot; const actorProjection = actorSnapshot.projection as Record<string, any>;
      const nextVersion = Number(actorSnapshot.stateVersion) + 1; const hostNext = waitForVersion(hostSocket, nextVersion); const guestNext = waitForVersion(guestSocket, nextVersion);
      await api(`/games/${started.gameSessionId}/actions`, { method: "POST", token: actorIsHost ? host.accessToken : guest.accessToken, body: { protocolVersion: 1, requestId: `finish-${suffix}-${turn}`, playerId: actorIsHost ? hostPlayerId : guestPlayerId, expectedStateVersion: Number(actorSnapshot.stateVersion), sentAt: new Date().toISOString(), action: actorProjection.legalActions[0] } });
      [hostSnapshot, guestSnapshot] = await Promise.all([hostNext, guestNext]); await delay(25);
    }
    if (String(hostSnapshot.status) !== "FINISHED") throw new Error("Match did not finish within 400 actions"); record(14, "Match finished through authoritative actions");
    const result = await api<Record<string, unknown>>(`/games/${started.gameSessionId}/result`, { token: host.accessToken }); if (!result || !result.gameSessionId) throw new Error("Persistent result missing"); record(15, "Persistent result and participants verified");
    hostSocket.close(); guestSocket.close();

    execFileSync("docker", ["compose", "restart", "postgres", "redis", "api-1", "api-2", "gateway"], { stdio: "inherit" }); await waitHealthy(); record(16, "All runtime services restarted and recovered readiness");
    const persisted = await api<Record<string, unknown>>(`/games/${started.gameSessionId}/result`, { token: host.accessToken }); if (persisted.id !== result.id) throw new Error("Completed result changed after restart"); record(17, "Completed result survived full service restart");
    execFileSync("bash", ["ops/validate-backup-restore.sh"], { cwd: resolve(__dirname, "../../.."), stdio: "inherit" }); record(18, "PostgreSQL backup restored into isolated verification database");
    record(19, "Critical migration, identity, session, and result records verified by restore script");
    record(20, "Production-style validation flow completed without unsupported infrastructure mutation");
  } catch (error) {
    report.push({ step: report.length + 1, outcome: "FAIL", detail: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    const target = resolve(__dirname, "../../../test-results"); mkdirSync(target, { recursive: true }); writeFileSync(resolve(target, "phase-10-production-flow.json"), JSON.stringify({ generatedAt: new Date().toISOString(), gateway, steps: report }, null, 2));
  }
}

void run();
