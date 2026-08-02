# Phase 10 — Production Hardening, Security, Observability and Deployment

Status: implementation specification; production readiness requires every acceptance item to have runtime evidence  
Date: 2026-08-02  
Scope: Phase 10 only. Phase 1–9 specifications, checkpoints, state boundaries, engine behavior, and protocol-v1 contracts remain approved by reference.

## 1. Repository and environment facts

- `apps/api` begins Phase 10 as a one-file TypeScript placeholder. Its package script names NestJS but no Nest dependency, application module, controller, gateway, database, Redis, auth, environment validation, Docker, or deployment runtime exists.
- `@game-store/backend-core` is framework-independent and supplies security primitives, authorization, persistence records/index requirements, idempotency interfaces, projection gating, rate-limit policy, log redaction, and snapshot migration. Nest/Prisma/Redis adapters must remain outside it.
- Phase 8’s authority is a development-only process-memory proof. It is not reused as storage or production identity.
- PostgreSQL/Prisma is the approved persistence direction. MongoDB/Mongoose remains unselected.
- This host has Node 20.17.0. NestJS 11 supports Node 20; Prisma 6.19.3 is selected because current Prisma 7 requires a newer Node 20 minor. Runtime upgrades must be deliberate and validated.
- Docker CLI/Compose are installed, but Docker Desktop cannot start its WSL engine. Two bounded attempts fail with `Wsl/Service/CreateInstance/CreateVm/HCS/0x80070032`; Docker logs show WSL bootstrap/isocache failure. Native `psql` and `redis-cli` are absent. Real PostgreSQL, Redis, container, backup/restore, multi-instance, and failover tests are blocked until the host is repaired or an approved external test environment is supplied.
- No Git metadata is present. File inventory, generated migration checksum, test output, and checkpoint evidence replace a Git diff in this workspace.

Production readiness is binary at the acceptance gate. Compiling adapters or supplying Compose files does not substitute for database, Redis, restore, failover, or two-instance evidence.

## 2. Runtime architecture

Deploy the Next.js frontend separately from horizontally scalable NestJS API/realtime containers. A TLS load balancer terminates TLS, supports WebSocket upgrade and sticky routing for polling fallback, and forwards only trusted proxy metadata. Nest instances are stateless apart from bounded in-flight work.

PostgreSQL is durable truth for identities, rooms, sessions, authoritative snapshots/events, idempotency, reconnect grants, results, rankings, achievements, and audit. Redis supplies Socket.IO pub/sub, presence, ownership leases, locks, counters, queue acceleration, and invalidation. Losing Redis must stop coordinated writes and matchmaking while preserving database truth. Background workers process timeouts, matchmaking, outbox, cleanup, and recovery under fenced ownership.

The request path is transport → correlation/schema/payload/rate checks → authentication → authorization → application service → transaction repository → projection-before-serialization → outbox/realtime emission. Game engines remain pure packages and are never imported into controllers for rule duplication.

## 3. NestJS module boundaries

`AppModule` composes:

| Module | Runtime responsibility |
| --- | --- |
| Config | strict startup environment parsing; no unsafe production defaults |
| Prisma | client lifecycle, transaction boundary, latency metrics, readiness |
| Redis | command/pub/sub clients, namespaced keys, leases, rate counters, readiness |
| Auth | registration/login/access/refresh/logout/revocation, cookie/CSRF integration |
| Authorization | HTTP/socket principal, room/seat/role guards |
| Profiles | safe user/profile persistence and projection |
| Rooms | create/join/ready/start, invitations, optimistic room version |
| GameSessions | durable Color Clash session/action/recovery/result orchestration |
| Projections | server-only recipient views; Moon Village privacy adapters/tests |
| Reconnect | rotating reconnect grants, seat/control epochs, resynchronization |
| Realtime | one `/platform` namespace, event validation, room joins, acknowledgements |
| RateLimit | Redis-backed identity/session/network-risk counters |
| Audit | append-only sanitized security/business audit records |
| Observability | structured logs, correlation/tracing boundary, Prometheus metrics |
| Health | liveness, readiness, protected detailed status |

Controllers/gateways translate transports. Services orchestrate. Repositories own Prisma calls. Engines own rules. Projection services own serialization boundaries. Runtime socket instances remain adapter-private and are never persisted or put in Zustand.

## 4. Persistence model

All required models have opaque primary keys, explicit foreign keys, `schemaVersion`, `createdAt`, and `updatedAt` unless append-only semantics make `updatedAt` intentionally unnecessary. JSON columns are bounded/versioned; secret game state is encrypted before persistence.

| Model | Critical constraints/indexes | Cleanup/retention |
| --- | --- | --- |
| User | unique normalized email; status/auth epoch | anonymize/delete by policy; security hold respected |
| AuthSession | unique token hash; user/family/status/expiry index | expired/revoked cleanup after security window |
| Profile | unique user and normalized handle | account lifecycle |
| Room | unique active normalized code; status/expiry | closed room cleanup after dispute window |
| RoomMember | unique room+identity and room+seat | room lifecycle; participant reference retained |
| Invitation | unique token hash; room/status/expiry | short expiry plus abuse audit |
| MatchmakingTicket | one active identity/game/playlist; queue search index | short TTL and cancellation retention |
| GameSession | unique active room handoff; status/update index | result/dispute retention |
| GameSeat | unique session+player and session+seat | session/result lifecycle |
| GameSnapshot | unique session+state version; checksum | retain latest milestones and terminal snapshot |
| GameEvent | unique session+sequence and event ID | append-only, partition/archive by policy |
| GameCommand | unique session+state version and request ID; encrypted payload/checksum | session recovery/dispute lifecycle |
| IdempotencyRecord | unique session+identity+request; expiry index | match +24h; rated/dispute actions longer |
| ReconnectSession | unique token hash; session/identity/expiry | grace TTL plus forensic minimum |
| GameResult | unique session | durable server-confirmed history |
| ResultParticipant | unique result+player | result lifecycle/anonymization policy |
| Ranking | unique game/season/user | season/history policy |
| Achievement | unique code+definition version | versioned definition lifecycle |
| UserAchievement | unique user/achievement/version/source | durable grant ledger |
| AuditLog | actor/subject/time/action indexes | security/legal retention, access controlled |
| OutboxEvent | status/availability and aggregate/version | delete/archive after confirmed delivery |

PostgreSQL has no TTL index. Cleanup is a scheduled, observable worker operating on indexed expiry fields in bounded batches.

## 5. Authentication lifecycle

Registration normalizes email, rejects mass-assigned fields, hashes passwords through backend-core scrypt (Argon2id remains an approved future adapter), creates profile and verification boundary, and emits safe audit. Login uses account+network-risk limits, constant-time verification, and optional rehash. Access tokens are signed, issuer/audience-bound, carry subject/session/auth epoch, expire in 10 minutes, and never contain profile or room secrets.

Refresh credentials are 256-bit opaque values in `Secure`, `HttpOnly`, `SameSite=Strict` cookies for production. Only hashes are stored. Rotation locks the current session, marks it `ROTATED`, inserts the successor in one transaction, and detects old-token replay; replay revokes the family and increments the user auth epoch. Current-device logout revokes one family/session; all-device logout revokes all sessions and increments the auth epoch. Password reset does the same after success.

Cookie mutation requires exact allowed origin, double-submit CSRF token, and safe content type. Development may disable `Secure` only when `NODE_ENV=development` and explicit configuration validates a loopback origin. CORS is an exact allow-list with credentials; wildcard origins are invalid. WebSocket authentication accepts a short-lived access token in handshake auth, validates origin/issuer/audience/epoch, and binds `socket.data.principal`; later event payload identities never override it.

## 6. Authorization

HTTP guards and socket middleware derive identity only from verified credentials. Application authorization checks room membership, host role, session membership, seat ownership/control epoch, supplied player ID equality, recipient mode, account/restriction status, current lifecycle, and expected versions.

Host administration never grants rule authority. Spectators are read-only. Bot workers require service identity and bot-controlled seat. Moderator projection requires both global role and per-session grant with audit reason. Support diagnostics are redacted and cannot read hidden state. Denials use stable safe codes and do not enumerate users/rooms.

## 7. Durable action transaction

1. Authenticate transport and bind identity.
2. Validate command schema, protocol, payload size, session, request ID, and action shape.
3. Resolve durable session/seat; compare supplied player ID to bound seat.
4. Acquire/check Redis ownership lease with fencing epoch; reject coordinated writes when ownership is unavailable.
5. Atomically insert idempotency claim `(session, identity, request)` with canonical action hash and bounded claim expiry.
6. Same key/hash `COMPLETED|REJECTED` returns stored result. Same key/different hash rejects collision. Live `PROCESSING` waits boundedly for the original result; it never calls the reducer.
7. In a serializable PostgreSQL transaction, load session/latest snapshot, verify expected state version and lease epoch, decrypt/validate state, and call the registered game engine.
8. Persist ordered committed event(s), a new encrypted snapshot for the initial vertical slice, session state/event versions, optional terminal result, final idempotency result, audit fact, and outbox record atomically.
9. After commit, regenerate each authorized recipient projection, publish through outbox/Socket.IO, and acknowledge the origin with the stored result.

Optimistic `stateVersion` update and unique event sequence prevent double commit. Stale commands return `STALE_VERSION` plus `snapshotRequired`; they do not execute. Orphan `PROCESSING` claims are reclaimed only after checking committed event/request IDs. The first vertical slice snapshots every action for simple deterministic restart proof; measured future games may use milestone snapshots plus replay.

## 8. Authoritative state and recovery

Color Clash uses the existing UNO engine under original platform naming. Server-generated cryptographic seed initializes the deterministic engine; serialized full state is encrypted with AES-256-GCM and an environment-provided 256-bit key. State rows include schema/game/state/projection versions and SHA-256 checksum.

Startup recovery scans `ACTIVE|STARTING` sessions, verifies latest snapshot/decryption/checksum/engine deserialization, compares session version/sequence, and marks recoverable ownership candidates. The first action on a new owner acquires a higher fencing epoch. Corrupt latest snapshots are quarantined through audit, and recovery tries the previous snapshot then ordered events where available. No usable chain moves the session to `PAUSED` and emits an incident; it never guesses.

Partial writes are prevented by the action transaction. Outbox publication is retryable and idempotent. Completed results remain database-readable without Redis. A process restart must not alter session/result state.

## 9. Recipient projections and privacy

Projection occurs on the server before JSON serialization or Socket.IO emission. Color Clash players receive own hand/legal actions; opponents and spectators receive counts/public state; spectators receive no action capability. Teammate mode rejects for games without teams. Moderator mode requires an audited grant.

Moon Village uses engine-generated public/player-private/team-private/moderator projections. Tests inspect raw serialized output for hidden roles, teammate identities, private night actions, investigation/protection results, unresolved/hidden votes, eliminated-player restrictions, and spectator access. CSS, hidden DOM, client selectors, and post-serialization deletion are prohibited security mechanisms. Projection errors increment metrics, audit a safe incident, and fail closed.

## 10. Redis coordination

Key prefix is `gs:{environment}:v1:`. Key families: `presence:user:{id}` (45s), `room:{id}:members` (room expiry), `game:{id}:owner` (15s renewable lease with monotonically increasing database epoch), `lock:{resource}` (5–15s), `reconnect:{hash}` (grace+30s), `ratelimit:{scope}:{identityHash}` (policy window), `matchmaking:{game}:{region}` (ticket expiry), `timer:{bucket}` (deadline+recovery), and Socket.IO adapter keys.

Locks use random owner tokens, compare-and-delete Lua, expiry, and database fencing for game writes. Redis command and duplicated pub/sub connections are separate. Startup rebuilds presence/ownership candidates from durable records. Redis outage makes readiness fail, rejects new sessions/matchmaking/coordinated actions with retryable safe errors, and preserves read-only result/profile access where safe. Reconnect storms use admission limits, jitter, and bounded snapshot requests.

## 11. Socket.IO gateway

Use one `/platform` namespace and one connection per browser session. Middleware enforces allowed origin, access token, auth epoch, protocol version, account status, 8 KiB event payload ceiling, and per-event rate policy. Transport rooms are `user:{id}`, `room:{id}`, `session:{id}:public`, and recipient `session:{id}:player:{playerId}`; moderator channels are separate.

Implemented event contracts reuse Phase 8 names: room join/snapshot, game action/action-result/snapshot, reconnect/resync, ping/pong, and safe system errors. Every handler validates a DTO, uses acknowledgement callbacks, and removes route/session membership on leave/disconnect. Gateway registration is singleton per application process. Redis adapter provides cross-instance fan-out. Heartbeat, bounded buffers, listener limits, shutdown drain, and reconnect backoff are configured. Rolling instances support protocol v1 until old sessions drain.

## 12. Reconnect

Reconnect grants are random one-use tokens stored hashed with identity/session/seat/control epoch, last sequence, expiry, and consumed/replaced timestamps. A reconnect request authenticates account/access state, rotates the grant transactionally, rejects stale control epoch, acquires current session ownership if needed, recovers authoritative state, and returns one fresh recipient projection. Old pending client commands and presentation queues are discarded. Human reclaim from a bot is a separate policy/transaction and is not inferred by reconnect.

## 13. Rate limiting

Redis-backed counters combine authenticated identity/session with a keyed network-risk hash; IP alone is insufficient. Apply the Phase 9 policy matrix independently to registration, login, reset, room create/join, invitation, matchmaking, game burst/sustained actions, chat, reconnect, snapshot, spectator, and moderation. Limits return safe `Retry-After`, never reset all network counters on successful login, and fail closed for high-risk mutations when Redis cannot coordinate. Internal workers use scoped service credentials and separate quotas.

## 14. Audit logging

Append sanitized audit records for auth lifecycle/replay, room/session lifecycle, host/control transfer, idempotency collision, authorization denial patterns, moderator/admin access, result creation/correction, snapshot corruption, and recovery/failover. Metadata passes backend-core redaction and a strict allow-list. No passwords, raw/hashed tokens, cookies, authorization headers, full request bodies, hidden roles/cards/deck, or private chat are stored. Control characters and oversized fields are normalized before persistence/log output.

## 15. Observability

Nest uses a JSON logger with timestamp, level, service/version/instance/environment, correlation/trace/request IDs, safe user/room/session/state/connection IDs, message, outcome, and error class. A middleware accepts only bounded valid correlation IDs or generates one. Trace context extraction/injection is an OpenTelemetry-compatible boundary; actual exporter is environment-configured and disabled safely when absent.

Prometheus metrics include HTTP latency/status, active Socket.IO connections, active rooms/sessions, action latency, accepted/rejected/stale/duplicate/collision counts, reconnect success/failure, projection failures, Redis availability/errors, Prisma query/transaction latency, outbox lag, event-loop lag, and process metrics. High-cardinality IDs are not labels. `/metrics` is protected by network policy/token outside local development.

## 16. Health, readiness, and liveness

- `/health/live`: process/event-loop viability only; no dependency check that would cause restart storms.
- `/health/ready`: configuration valid, migrations compatible, Prisma query succeeds, Redis ping succeeds when required, engine registry loaded, shutdown not started.
- `/health`: protected detailed component status, versions, latency, and instance ID without secrets.

Graceful shutdown marks unready, stops accepting new socket/HTTP mutations, drains bounded in-flight actions/outbox claims, releases ownership leases with compare-and-delete, disconnects Socket.IO, closes Redis clients, disconnects Prisma, then exits before orchestrator grace expiry.

## 17. Environment and secret policy

Startup validation requires explicit `NODE_ENV`, `PORT`, `INSTANCE_ID`, `DATABASE_URL`, `REDIS_URL`, `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_ISSUER`, `ACCESS_TOKEN_AUDIENCE`, `STATE_ENCRYPTION_KEY`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `CORS_ORIGINS`, and protocol/payload settings. Production requires secrets at least 32 bytes, TLS database/Redis policy, secure cookies, non-loopback origins, no default passwords, and no wildcard CORS. `.env.example` contains placeholders only; Compose development secrets are isolated and labeled non-production.

Secrets come from a managed store in production, are mounted/injected at runtime, rotated with current/previous key support where needed, and never baked into images or client bundles. Logs and diagnostics report only presence/version/key ID.

## 18. Docker development and deployment

Provide a multi-stage non-root API Dockerfile with pinned Node base digest/version policy, deterministic `pnpm --frozen-lockfile`, generated Prisma client, healthcheck, dumb-init or equivalent signal handling, and minimal runtime files. Compose supplies PostgreSQL 16, Redis 7, migration job, and two API instances on separate ports with health/readiness dependencies and named volumes.

Production deployment uses managed PostgreSQL/Redis, TLS load balancer, immutable images, least-privilege service account, resource requests/limits, pod disruption budget, topology spread, readiness/liveness/startup probes, rolling `maxUnavailable=0`, and pre-deploy migration job. Static assets use the frontend/CDN boundary. No deployment is performed in this phase.

## 19. Prisma migrations

Schema changes use checked-in forward migrations. CI validates format/generate, diff against migration history, applies to empty PostgreSQL, and upgrades a prior fixture database. Production migration runs once as a gated job before compatible app rollout; replicas never auto-migrate. Expand/backfill/contract spans releases for destructive changes. Migration checksum and application compatibility are exposed in readiness.

Snapshot/event migrations remain pure engine-versioned functions. Unknown/corrupt versions quarantine and pause rather than silently rewriting. Redis keys carry `v1` and are rebuilt/dual-read for future key migrations.

## 20. Backup, restore, and disaster recovery

Development scripts wrap `pg_dump --format=custom`, SHA-256 manifest, metadata, and `pg_restore --clean --if-exists` into a separate target database. Validation compares critical table counts, latest migrations, snapshot checksums, and completed-result identifiers. Production policy is continuous WAL/PITR plus daily full backup, 35-day retention, encrypted cross-zone/account copy, and quarterly isolated restore drill.

Redis persistence is optional availability optimization, not permanent truth. After loss, rebuild presence/leases/rate windows/queues from durable sessions/tickets and conservative defaults. Failover fences old owners, validates PostgreSQL primary and migration level, restores Redis coordination, recovers active sessions, rotates reconnect grants as needed, and resumes or pauses safely.

Targets remain RPO 0 committed game actions and ≤5 minutes other durable data; RTO ≤15 minutes active-match recovery and ≤60 minutes account/results. They are objectives until an observed restore/failover test proves them.

## 21. Security hardening and tests

Required tests cover password hashing/rehash, access expiry/signature/audience, refresh rotation/replay/family revocation, current/all logout, CSRF origin/double-submit, exact CORS, XSS-sensitive strings, parameterized database access/SQL-injection payloads, DTO allow-list/mass assignment, room/seat/moderator authorization bypass, socket identity spoofing, request replay/collision/concurrency, stale versions, payload depth/size, rate-limit identity/network combinations, raw projection privacy, audit-log injection, dependency audit, secret scanning, and unsafe production environment rejection.

Use Helmet, body limits, disabled framework disclosure, strict validation (`whitelist`, `forbidNonWhitelisted`, transform limits), trusted proxy allow-list, safe errors, secure cookies, least-privilege DB/Redis credentials, encryption at rest, dependency lock, image scanning, and admin MFA boundary. Security report distinguishes automated evidence from manual/cloud controls.

## 22. Load and resilience

Executable load profiles cover health/read endpoints, login throttling, action acknowledgement under valid sequential versions, duplicate action bursts, snapshot/reconnect storms, and Socket.IO connection/fan-out. Initial non-binding local targets: p95 health <100 ms, accepted action <250 ms excluding client network, error <1%, no duplicate reducer commits, bounded heap/event-loop lag, and stable recovery after dependency restoration.

Resilience tests stop one of two API instances, interrupt Redis, restart PostgreSQL, inject stale owners, retry outbox events, corrupt latest snapshot fixture, and restart all services. Results record environment, concurrency, duration, throughput, percentile latency, errors, memory/CPU, and correctness invariants. No result is extrapolated to production capacity without representative infrastructure.

## 23. CI validation

CI jobs: dependency install with frozen lock; Prisma format/validate/generate; typecheck/lint/unit; PostgreSQL+Redis service integration; migration from empty/prior fixture; API e2e/auth/repository/action/privacy/reconnect; two API instances plus Socket.IO/Redis; backup/restore; load smoke; production build; Docker build/health; dependency audit and secret scan; Playwright. Artifacts include reports, migration diff, coverage, image metadata, and sanitized logs. Required jobs gate merge; deployment remains a separate approved workflow.

## 24. Required production-style validation flow

The executable harness must start PostgreSQL/Redis, migrate, start two API instances, register/login two users, create/join/ready/start a Color Clash room, submit and concurrently duplicate one versioned action, prove one event/version increment and identical acknowledgement, stop the owning instance, reconnect through the other, restore a recipient-safe snapshot, finish deterministically, persist result, restart all services, verify result, take a backup, restore into a clean database, and verify users/session/result/checksums. Commands and outcomes belong in the checkpoint and reports.

If any infrastructure step cannot run, the flow is `BLOCKED`, not `PASS`, and production readiness is `NO`.

## 25. Graceful rolling behavior

Readiness turns false before shutdown. New actions receive retryable draining errors; in-flight transactions finish within a bound. Socket clients receive reconnect hints and reauthenticate against another instance. Database state/outbox ensure no committed action is lost; Redis adapter delivers across mixed instances. Protocol v1 and current/previous state readers remain supported for the drain window. Ownership leases expire/fence stale writers. No process-memory session is needed for recovery.

## 26. Implementation compatibility changes

- Replace the Phase 0 API string export with a real Nest bootstrap and modules.
- Change only `apps/api` compilation settings needed by decorators/Nest CommonJS runtime; workspace/game packages remain ESM/pure TypeScript.
- Add `apps/api/prisma` schema/migration and generated-client workflow; no Prisma import enters game packages/backend-core.
- Add API dependencies on approved engine, backend-core, and realtime contracts; do not copy rule logic.
- Add root operational scripts only when backed by real files/commands. Existing web and offline behavior remains unchanged.
- Add Docker/environment/CI/operations files. No production deployment or secret is performed.

## 27. Acceptance and readiness matrix

Each Phase 10 acceptance criterion is tracked as `PASS`, `FAIL`, or `BLOCKED` in the checkpoint. Compile-time existence never upgrades a runtime criterion. Particularly, Prisma is functional only after migration and repository tests against PostgreSQL; Redis/Socket.IO multi-instance is functional only after two processes and adapter delivery; backup is complete only after restore verification; failover is complete only after observed recovery; production readiness is `YES` only when no blocker remains.

## 28. Known risks and unresolved decisions

Current blocker: Docker/WSL cannot create the Linux VM and no native PostgreSQL/Redis tooling exists. External infrastructure or host repair/elevation/reboot is required for mandatory evidence.

Remaining decisions: cloud/region/load balancer, managed PostgreSQL/Redis vendors and TLS/ACLs, secret manager/KMS, OTEL/log/metrics backends, mail/verification provider, domain/CORS origins, guest online policy, moderator grants/retention, rating algorithm, timeout/reclaim/spectator delay, backup retention/legal requirements, approved RPO/RTO, and production capacity targets.

Risks: split-brain ownership, refresh theft/replay, hidden-state/log leakage, idempotency orphan claims, migration/runtime incompatibility, reconnect storms, outbox lag, Redis failover, snapshot corruption, restore drift, dependency vulnerabilities, and false readiness claims. The architecture mitigates them; only runtime tests close them.

## 29. Scope exclusions

No game-rule redesign, client authority, payment processing, voice service, final moderation dashboard, unrelated frontend redesign, push, merge, deployment, or post-Phase-10 roadmap work. The implementation may expose only API/testing surfaces needed for the approved production-style flow.

## 30. Implementation result and conformance boundary

The Phase 10 implementation now provides a real NestJS 11 bootstrap, strict environment validation, Prisma 6 PostgreSQL schema and forward migration, transactional auth/session/audit paths, Redis coordination primitives, a Redis Socket.IO adapter and authenticated gateway, durable idempotency, encrypted action/snapshot persistence, database fencing, command-journal recovery, recipient projections, reconnect grants, Prometheus/default-process metrics, JSON correlation logs, health endpoints, a two-instance Compose topology, a non-root production bundle, CI, backup/restore scripts, database e2e tests, a 20-step production-flow harness, and a load-smoke harness.

Implementation clarifications supersede any aspirational wording above: `SameSite` is explicitly configurable as `Strict` or `Lax`; recovery is performed on authoritative load rather than by a completed startup worker; the current Redis owner is an action-scoped lock backed by a monotonically increasing database fence; implemented socket channels are identity/room/player-projection channels; moderator/public spectator transport channels and proactive pause/incident recovery remain closed until their grant/worker flows exist.

Locally verified evidence is limited to schema format/validation/client generation, full typecheck/lint/unit/browser/build checks, 20 API security/recovery unit tests, projection privacy, dependency/secret scans, Compose syntax, and a dependency-optional Nest process smoke. The database e2e suite deliberately skips unless `RUN_INTEGRATION=true`; the production harness refuses to run unless `RUN_PRODUCTION_FLOW=true`; load requires `LOAD_BASE_URL`.

This host's Docker/WSL failure prevents PostgreSQL migration execution, repository integration, Redis behavior, Socket.IO multi-instance delivery, durable restart/reconnect, backup restore, failover, container health, and load measurements. Those criteria are `BLOCKED`, not passed. Production readiness is **NO**. No CI run, deployment, push, merge, or external mutation occurred here.

## 31. Completion gate

Phase 10 is complete only after all 24 user acceptance criteria pass with evidence. If environment-backed criteria remain blocked, the checkpoint status must be **BLOCKED — NOT PRODUCTION-READY**, with exact remediation. No next phase begins without explicit approval after that assessment.
