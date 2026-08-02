# Phase 10 Checkpoint — Production Hardening, Security, Observability and Deployment

Status: **IMPLEMENTATION DELIVERED — ACCEPTANCE BLOCKED — NOT PRODUCTION-READY**  
Date: 2026-08-02  
Scope gate: Phase 10 only; no push, merge, deployment, or post-Phase-10 work.

## Deliverables

- Specification: `docs/backend/phase-10-production-hardening-specification.md`
- Security report: `docs/backend/phase-10-security-test-report.md`
- Load/resilience report: `docs/backend/phase-10-load-resilience-report.md`
- Checkpoint: `docs/checkpoints/phase-10-checkpoint.md`
- NestJS runtime, Prisma schema/migration, Redis coordination, Socket.IO gateway, auth/authorization, durable action/reconnect/projection adapters
- Compose development topology, production API image, Nginx gateway, environment templates, CI workflow
- Backup/restore, secret-scan, runtime-smoke, e2e, production-flow, and load harnesses

## Repository and environment findings

- The pre-Phase-10 API was a placeholder. It is now a real NestJS 11 application bundle composed from framework adapters while `backend-core` and game engines remain framework-independent.
- Node is 20.17.0 and pnpm is 9.15.0. Prisma 6.19.3 was selected for compatibility with this host; Nest is 11.1.28 and Socket.IO is 4.8.3.
- Docker CLI 24.0.7 and Compose 2.23.3 exist, but the daemon cannot start. Docker Desktop/WSL repeatedly fails VM creation with `Wsl/Service/CreateInstance/CreateVm/HCS/0x80070032`; `docker info` confirms no engine pipe. Native `psql` and `redis-cli` are absent.
- No Git metadata exists in the workspace, so this checkpoint uses explicit file inventory and command evidence. Migration SHA-256: `90434025F8276FFBFDB0015A41CF91E72AB3F27CCBBEB76E0FC92AB62755A010`.

## Implemented runtime

### NestJS and boundaries

- Real bootstrap with strict config, validation, bounded JSON/form bodies, Helmet, exact credentialed CORS, safe exception responses, correlation context, JSON logger, lifecycle drain guard, and graceful signal hooks.
- Modular auth, Prisma, Redis, audit, rate-limit, rooms, games, projections, reconnect, outbox, realtime, observability, and health boundaries.
- Production tsup bundle includes internal framework-neutral workspace code but keeps runtime dependencies external. A dependency-optional process smoke proves DI/bootstrap/routes/health/metrics initialize.

### Prisma/PostgreSQL

- Schema covers users, auth sessions, profiles, rooms/members, invitations, matchmaking tickets, sessions/seats, snapshots, events, encrypted command journal, idempotency, reconnect grants, results/participants, rankings, achievements/grants, audit, and outbox.
- Required keys, relations, indexes, unique constraints, schema versions, timestamps, and expiry indexes are defined. Partial unique PostgreSQL indexes enforce one active matchmaking ticket and one active game session per room.
- A checked-in forward migration exists and Prisma format/validate/generate pass. Migration execution and repository behavior against PostgreSQL are blocked.

### Authentication and authorization

- Scrypt password hashing, short JWT access tokens, issuer/audience/auth-epoch checks, opaque hashed rotating refresh tokens, family replay revocation, current/all-device logout, root-path secure cookie policy, exact-origin JSON mutations, double-submit CSRF, and safe WebSocket auth.
- Unknown-user login performs a dummy scrypt verification. Registration/session/audit, login/session/audit, refresh/audit, and logout/audit changes are transactional.
- HTTP derives identity from access tokens. Socket middleware authenticates before connection; every event revalidates the access session. Room and game actions bind durable identity to seat/player/control.

### Authoritative games and recovery

- Existing Color Clash/UNO engine behavior is reused; controllers contain no game rules.
- Redis compare-and-delete locks plus monotonically increasing PostgreSQL owner epochs fence stale writers.
- Durable idempotency stores canonical action hash, in-flight ownership, accepted/rejected result, collision result, expiry, and bounded recovery.
- Accepted actions atomically persist session/event versions, encrypted snapshot, encrypted checksummed command, domain events, idempotency result, outbox, audit, and terminal result/ranks.
- Corrupt latest snapshots are quarantined; earlier snapshots plus contiguous command journals are replayed. Broken recovery fails closed.
- Current player/opponent/spectator/moderator projections are generated before serialization. Moon Village tests cover role/team/night/investigation/protection/vote/elimination privacy.
- One-use hashed reconnect grants bind identity, session, seat, and control epoch and rotate on consume.

### Redis and Socket.IO

- Redis service supplies namespaced presence, reconnect grace, locks/renewal, rate counters, matchmaking sorted sets, timeout queues, invalidation, and readiness.
- Redis is never durable truth. Required Redis outage makes readiness fail and coordinated mutations fail closed.
- Socket.IO `/platform` uses Redis adapter pub/sub clients, pre-connection auth middleware, bounded payloads, heartbeat settings, room/game subscriptions, action acks, snapshot/reconnect, per-event shared rate buckets, and recipient-specific outbox fan-out.
- Runtime Redis behavior and multi-instance delivery remain blocked without the daemon.

### Observability and operations

- Prometheus HTTP/action/database/reconnect/projection/dependency/room/session/socket/outbox metrics plus default process/event-loop metrics.
- Liveness is dependency-free; readiness performs dependency pings when required; detailed health/metrics are token-hidden in production.
- Two API instances, PostgreSQL 16, Redis 7 AOF, migration job, and Nginx WebSocket gateway are defined in Compose.
- Multi-stage non-root API image, frontend/backend boundary, exact production environment template, TLS expectations, rolling-drain rules, CI gates, custom-format PostgreSQL backup, checksum, isolated restore, and critical-count verification are present.

## Files created

- `.dockerignore`, `.env.example`, `compose.yaml`
- `.github/workflows/ci.yml`
- `deploy/.env.production.example`, `deploy/nginx.conf`
- `ops/{postgres-backup,postgres-restore,validate-backup-restore}.sh`, `ops/secret-scan.mjs`
- `apps/api/Dockerfile`, `apps/api/tsup.config.ts`, `apps/api/tsconfig.test.json`, API Vitest configs
- `apps/api/prisma/schema.prisma`, migration SQL, migration lock
- `apps/api/src/{app.module,main}.ts` and config/common/lifecycle/Prisma/Redis/auth/audit/rate-limit/room/game/realtime/health/observability modules
- API unit tests for environment, encryption, action shape, projections/privacy, and snapshot recovery
- `apps/api/test/e2e/*`, `test/production-flow.ts`, `test/runtime-smoke.ts`, `test/load/smoke.ts`
- Phase 10 specification, security report, load/resilience report, and this checkpoint

## Files modified

- `apps/api/package.json`, `apps/api/tsconfig.json` — actual runtime/dependency/build/test configuration replaces the placeholder.
- `package.json`, `pnpm-lock.yaml` — scripts, exact runtime graph, and patched `postcss`/`sharp` overrides.
- `playwright.config.ts` — cross-platform command and one bounded worker to prevent dev-server saturation.
- `packages/game-moon-village/src/engine.ts` — exports the existing trusted-moderator projection through the server-only trusted symbol; no role/rule/transition behavior changed.
- `docs/backend/phase-10-production-hardening-specification.md` — implementation conformance addendum.

Generated ignored `dist`, coverage, `.next`, Turbo, and Playwright outputs are not deliverables.

## Validation results

| Command | Result |
| --- | --- |
| `pnpm.cmd install` | PASS — lockfile synchronized across 14 workspace projects. |
| `prisma format` | PASS. |
| `pnpm.cmd --filter @game-store/api prisma:validate` | PASS — schema valid. |
| `pnpm.cmd --filter @game-store/api prisma:generate` | PASS — Prisma Client 6.19.3 generated. |
| `pnpm.cmd --filter @game-store/api typecheck` | PASS — production and test/harness TypeScript. |
| `pnpm.cmd --filter @game-store/api test` | PASS — 5 files / 20 tests; scoped coverage 100% statements/functions/lines, 99.04% branches. |
| `pnpm.cmd --filter @game-store/api build` | PASS — CJS production bundle and source map. |
| `pnpm.cmd --filter @game-store/api smoke:runtime` | PASS — real Nest process, liveness, readiness, metrics. |
| `docker compose config --quiet` | PASS. |
| `pnpm.cmd typecheck` | PASS — 13/13 workspace tasks. |
| `pnpm.cmd lint` | PASS — 13/13; repository lint scripts are TypeScript validation. |
| `pnpm.cmd test` | PASS — 13/13 workspace tasks; all reported suites pass. |
| `pnpm.cmd build` | PASS — API bundle and Next.js 15.5.22 production build; 19 routes. |
| `pnpm.cmd exec playwright test` | PASS on final run — 13/13 with one worker. Dev-only previews and the mock realtime API ran in the intended development harness; a production-server audit confirmed those routes return 404. Earlier timing failures were diagnosed as dev-server saturation/transient-state races, and the harness was made deterministic. |
| `pnpm.cmd audit --prod --audit-level high` | PASS final — no known vulnerabilities. Initial run found three high transitive findings, all fixed by patched overrides. |
| `pnpm.cmd security:secrets` | PASS — no signature findings. |
| `pnpm.cmd --filter @game-store/api test:e2e` | BLOCKED/SKIPPED — 2 infrastructure tests intentionally skipped because `RUN_INTEGRATION` was not authorized and dependencies are unavailable. |
| `docker info` | BLOCKED — Docker daemon unavailable. |
| Prisma migration deploy/repository integration | BLOCKED — no PostgreSQL runtime. |
| Redis integration/Socket.IO multi-instance | BLOCKED — no Redis runtime. |
| 20-step production flow/process restart/failover | BLOCKED — two dependency-backed instances cannot start. |
| Backup/restore verification | BLOCKED — PostgreSQL unavailable. |
| Autocannon load/resilience profile | BLOCKED — no valid production-style target. |
| Docker build/container health | BLOCKED — Docker daemon unavailable. |

## Acceptance matrix

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Specification exists | PASS |
| 2 | Checkpoint exists | PASS |
| 3 | NestJS runtime functional | PASS — dependency-optional process smoke |
| 4 | Prisma/PostgreSQL persistence functional | BLOCKED |
| 5 | Migrations pass against PostgreSQL | BLOCKED |
| 6 | Redis coordination functional | BLOCKED |
| 7 | Socket.IO gateway functional | BLOCKED — compiled/bootstrapped, no Redis runtime connection proof |
| 8 | Authentication and authorization integrated | BLOCKED — implemented; database lifecycle proof unavailable |
| 9 | Durable idempotency survives restart | BLOCKED |
| 10 | Reconnect survives instance failure | BLOCKED |
| 11 | Recipient privacy projections pass | PASS — raw serialization tests |
| 12 | Multi-instance delivery works | BLOCKED |
| 13 | Rate limiting works | BLOCKED — logic present, no Redis-backed proof |
| 14 | Observability operational | PASS locally — logs/health/metrics bootstrap; production backend selection open |
| 15 | Health checks pass | PASS locally; required-dependency readiness proof blocked |
| 16 | Deployment configuration exists | PASS — Compose syntax validated |
| 17 | Backup restore tested | BLOCKED |
| 18 | Failover tested | BLOCKED |
| 19 | Security tests pass | BLOCKED overall — local subset passes; infrastructure matrix remains |
| 20 | Load/resilience documented and tested | BLOCKED — report/harness exists, no valid run |
| 21 | No unsupported readiness claims | PASS |
| 22 | No game rules changed | PASS — full engine suites pass; only trusted projection export added |
| 23 | Remaining risks recorded | PASS |
| 24 | Final readiness explicit | PASS — **NO** |

## Risks and unresolved decisions

Open infrastructure/product decisions remain: cloud/regions/load balancer, managed PostgreSQL/Redis and TLS/ACL policy, secret manager/KMS/key rotation, OpenTelemetry/log/metrics vendors, mail verification/reset, final domains/origins, guest online policy, moderator grants/retention, ranking, timeouts/reclaim/spectator delay, legal backup retention, approved RPO/RTO, and capacity targets.

Remaining technical risks are unmeasured split-brain/failover behavior, Redis outage/reconnect storms, real transaction contention, outbox lag, migration/restore drift, production image behavior, and cloud security controls. The harnesses test these but have not produced evidence.

## Required unblock run

### Unblock validation attempt — 2026-08-03

The Windows-host remediation was retried before starting any production-style validation:

- `docker version` and `docker info` remain blocked because the Linux engine cannot expose a working daemon pipe.
- `wsl -d docker-desktop -u root -- echo WSL_BOOT_OK` fails with `Wsl/Service/CreateInstance/CreateVm/HCS/ERROR_NOT_SUPPORTED` (the same underlying `0x80070032` condition recorded above).
- `wsl --update --web-download` successfully upgraded WSL from 2.0.14/kernel 5.15 to WSL 2.7.11/kernel 6.18. The distro still fails after `wsl --shutdown`, proving that the obsolete WSL package was not the remaining cause.
- Read-only system inspection reports firmware virtualization enabled, but `HypervisorPresent=False`. `Win32_OptionalFeature` reports Windows Subsystem for Linux enabled while `VirtualMachinePlatform` and `Microsoft-Hyper-V-All` are disabled.
- `DISM /Online /Get-FeatureInfo ...` returns error 740 because this Codex session is not elevated. Enabling the required Windows feature and rebooting therefore requires an administrator-controlled host action.
- Native `psql` and `redis-cli` remain unavailable. No approved remote Linux/Docker host is connected to this workspace.
- No Docker data distro was unregistered or reset; existing images/volumes were not destroyed.

An administrator must enable the WSL2 virtualization platform and reboot before this runbook can continue. From an elevated PowerShell:

```powershell
dism.exe /Online /Enable-Feature /FeatureName:VirtualMachinePlatform /All /NoRestart
dism.exe /Online /Enable-Feature /FeatureName:Microsoft-Windows-Subsystem-Linux /All /NoRestart
bcdedit /set hypervisorlaunchtype auto
Restart-Computer
```

After reboot, first require `wsl -d docker-desktop -u root -- echo WSL_BOOT_OK` and `docker info` to succeed. If organizational policy does not permit these host changes, run the unchanged validation commands below on an approved Linux Docker host instead.

**Result of this attempt:** environment remediation remains blocked by administrator/reboot authority. PostgreSQL, migration, Redis, multi-instance Socket.IO, durable recovery, backup/restore, failover, security-integration, container-health, and load/resilience validation were not started and remain blocked. The final production-readiness conclusion is unchanged.

After repairing Docker/WSL or moving to an approved Linux runner:

1. `docker compose up --detach --build postgres redis migrate api-1 api-2 gateway`
2. `RUN_INTEGRATION=true pnpm --filter @game-store/api test:e2e`
3. `RUN_PRODUCTION_FLOW=true pnpm --filter @game-store/api test:production-flow`
4. `LOAD_BASE_URL=http://127.0.0.1:4000 pnpm --filter @game-store/api load:smoke`
5. `docker compose ps`, container health/image scan, then rerun all repository checks.

Archive the generated flow/load JSON, backup checksum/restore output, metrics, and sanitized logs. Only a clean run may change blocked acceptance items to pass.

## Final production-readiness assessment

**NO — BLOCKED, NOT PRODUCTION-READY.** The implementation foundation and local validation are delivered, but Phase 10 acceptance is not complete because mandatory PostgreSQL, Redis, multi-instance, backup/restore, failover, container, security-integration, and load evidence could not be produced on this host.

## Approval gate

Work stops at this Phase 10 checkpoint. Review/approval is required; no next phase may begin automatically.
