# Phase 9 — Production Backend and Data Persistence Specification

Status: implementation specification with a bounded foundation; **not production-ready**  
Date: 2026-08-02  
Scope: Phase 9 only. Phase 1–8 specifications and checkpoints remain authoritative by reference.

## Repository facts, conflicts, assumptions, and decisions

### Confirmed repository facts

- The monorepo uses pnpm 9.15 and Turborepo. `apps/web` is Next.js 15 App Router; game engines are framework-free TypeScript packages.
- `apps/api` is a one-file Phase 0 placeholder. It has a `nest start` script but no NestJS dependency, module, controller, gateway, configuration validation, or runtime bootstrap.
- There is no authentication, user store, Prisma schema, database client, Mongo/Mongoose model, Redis client, Socket.IO gateway, Docker/deployment configuration, migration, seed, rate limiter, or audit sink.
- Phase 8 supplies transport-neutral protocol-v1 commands, results, snapshots, events, reconnect state, and a development-only in-memory Color Clash authority. Its identity, room, idempotency, event, and session data do not survive restart and cannot coordinate instances.
- Existing online contracts bind actions to a verified identity conceptually, carry request/state versions, and require recipient-specific projections. The development endpoint is disabled in production and explicitly is not authentication or realtime infrastructure.
- Moon Village already provides public, player-private, team-private, and trusted-moderator engine projections. Other engines expose authoritative state and legal-action APIs but do not all expose a common projection interface.
- Offline IndexedDB saves are browser-local and versioned. They are not trusted online snapshots and must not be promoted to authoritative server state.
- No Git metadata is available in this workspace, so change review relies on explicit file inventory and validation rather than `git diff`.

### Conflicts and compatibility decisions

1. Phase 0 approved PostgreSQL/Prisma, while the Phase 9 brief conditionally lists Mongo/Mongoose collections. No later repository implementation selected MongoDB. PostgreSQL remains the proposed durable source of truth; equivalent relational tables replace the conditional collection list. Prisma is an adapter choice to validate when the runtime is installed.
2. `apps/api` claims a Nest development command without Nest. Phase 9 does not make that command truthful by installing a partial runtime. A complete Nest bootstrap, configuration validation, Prisma adapter, and deployment topology must be introduced together before production claims.
3. Phase 8 memory-only idempotency is retained only for development diagnostics. Production commands must use the durable transaction described below.
4. Existing engine rules and offline saves remain unchanged. Backend adapters invoke the engines; they do not recreate rules or trust client state.
5. Shared envelopes are reused. Database rows use internal timestamps/identifiers and convert to the approved ISO-string transport contracts at the API boundary.

### Assumptions

- Initial deployment uses one region, PostgreSQL 16-compatible storage, and a Redis-compatible highly available cache/coordination service.
- Access tokens are short-lived signed tokens; refresh credentials use opaque random secrets in secure, HTTP-only cookies for the web client.
- Public matchmaking is authenticated-account-only until the guest abuse/rating policy is approved.
- Color Clash is the first production-style persisted flow. No persisted vertical slice is claimed complete in this phase.
- Server clocks, database transactions, and server-side engine versions are authoritative.

### Unresolved decisions

Cloud provider/region, Prisma versus another PostgreSQL adapter, token signing/key service, email provider, social login, guest online eligibility, moderation vendor, rating algorithm, Redis vendor/persistence mode, spectator delay, chat retention, per-game timeout defaults, and RPO/RTO funding remain open. Defaults below are recommendations, not silently approved product policy.

## 1. Backend architecture

Deploy a stateless NestJS API/realtime application behind a TLS load balancer, with PostgreSQL as durable truth, Redis for shared ephemeral coordination, and background workers for timeout/matchmaking/outbox work. Engine packages execute only on trusted workers/API instances. Clients send intents and receive projections.

The write path is: authenticated transport → schema/size/rate checks → authorization → durable idempotency claim → session ownership/version check → engine validation/reduction → transactional event/snapshot/session update → outbox commit → recipient projection → Socket.IO fan-out. The database commit precedes acknowledgement. Redis loss may reduce availability but cannot redefine permanent state/results.

## 2. Service and module boundaries

| Module | Owns | Must not own |
| --- | --- | --- |
| Auth | credentials, access-token verification, refresh families, reset/verification | profiles, room permissions |
| Users / Profiles | account lifecycle and public profile/preferences | credentials, game state |
| Rooms / Invitations | lobby, membership, host, ready/settings, invites | domain cards/roles/rules execution |
| Matchmaking | tickets, search expansion, acceptance | game-session state |
| GameSessions | seats, lifecycle, versions, timers, recovery pointers | transport sockets, UI state |
| GameRuntime | engine registry, trusted randomness, action orchestration | persistence implementation, rendering |
| GameProjection | recipient authorization and game-specific projections | full-state broadcast, client filtering |
| Idempotency | atomic claims and stored results | engine behavior |
| Realtime / Presence | gateway, connection binding, rooms, fan-out, presence lease | durable results, authority in socket memory |
| Spectator / Bots | policy and seat-control orchestration | bypassing normal action validation |
| Results / Ranking / Achievements | confirmed outcomes and idempotent derived writes | deciding winners |
| Audit / Moderation | append-only security/admin facts and case workflow | secrets/full hidden state |
| RateLimit / Observability / Health | cross-cutting policy, telemetry, probes | business decisions |

Controllers/gateways translate transport only. Application services coordinate use cases. Domain adapters call game engines. Repositories isolate storage. Projection occurs before serialization. An outbox worker performs post-commit emissions and derived jobs.

## 3. Authentication

- Registration normalizes email, checks uniqueness without account enumeration, hashes passwords with Argon2id where available (scrypt is the approved standard-library fallback), creates an unverified user/profile, and sends a single-use expiring verification token.
- Login applies identity-plus-network rate limits, verifies with constant-time comparison, records a device session, and returns a 5–15 minute access token plus a 7–30 day rotating refresh token.
- Refresh tokens are at least 256 bits of entropy, stored only as hashes, grouped by family, rotated atomically, and invalidated on replay. The old token becomes `ROTATED`; reuse revokes the family and raises a security audit event.
- Browser refresh credentials use `Secure`, `HttpOnly`, `SameSite=Lax/Strict` cookies with an explicit path. State-changing cookie endpoints require origin and CSRF-token checks. Native clients may use a secure OS store and bearer refresh flow.
- Logout revokes one session; “logout all” and password change revoke all families. Compromise handling revokes families, increments user auth epoch, closes sockets, and requires reauthentication.
- Reset/verification tokens are hashed, purpose-bound, one-time, short-lived, and invalidate relevant sessions after successful password reset.
- Guest identities use signed, short-lived, room-scoped sessions and separate abuse limits. They do not automatically gain durable progression. Upgrade/merge policy remains open.
- Optional OAuth/OIDC providers map to an external-identity table and never replace the internal authorization/session model.

No plaintext password, refresh token, reset token, verification token, signing key, or OAuth secret may be logged or persisted.

## 4. Authorization

Identity comes from the verified HTTP/socket session. A client `playerId` is only correlation and must equal the seat bound to that identity. Each operation checks account status, global grants, room membership, session membership, seat control, room/session status, expected version, and recipient projection permission.

| Role | Representative permissions |
| --- | --- |
| Room owner | lobby settings, invitations, eligible kick/host transfer/start; never game-rule override |
| Room member/player | ready/leave and own-seat legal action |
| Spectator | authorized public projection and permitted chat only; no game action |
| Bot controller | server worker may act for an assigned bot seat through the same validator |
| Moderator | scoped case actions and explicitly granted moderator projection |
| Administrator | operational configuration through audited, least-privilege endpoints |
| Support operator | redacted account/session diagnostics; no hidden state by default |

Denials are safe and non-enumerating. Authorization is repeated at command execution, not only at room join or socket handshake.

## 5. User and profile persistence

`users`: ID, normalized email, password hash, status, auth epoch, verification timestamp, schema version, timestamps. Email/password hash are PII/secrets with restricted access. Soft-disable precedes deletion; legal retention is policy-driven.

`profiles`: user ID, unique normalized handle, display name, locale, avatar/cosmetic references, accessibility/preferences JSON, progression summary version, timestamps. Public DTOs expose an allow-list only. User settings carry their own schema version. Account deletion anonymizes result participants where retention requires statistics.

`auth_sessions`: session/family/user IDs, hashed refresh token, rotation counter/status, device metadata, last-used/expiry/revocation timestamps, schema version. Network/device values are minimized and retention-limited.

## 6. Room persistence

`rooms` stores code hash/normalized code, game slug, type/visibility/status, host membership ID, settings and settings version, capacity/spectator policy, optimistic version, expiry, and timestamps. `room_members` stores room/user-or-guest identity, player ID, seat, role/control, ready/connection status, join order, and reclaim metadata. `room_invitations` stores issuer, safe recipient reference, token hash, role, status, use/expiry.

Room state never contains engine state. Material setting/member changes increment `rooms.version` and revoke affected readiness in one transaction. Closed/expired private rooms are retained briefly for audit/reconnect diagnostics, then minimized or deleted according to policy.

## 7. Game-session persistence

`game_sessions` stores ID, optional room ID, game type, status (`CREATED|STARTING|ACTIVE|PAUSED|FINISHED|CANCELLED|CLOSED`), engine/rule/schema versions, rule config, state version, event sequence, random-provider metadata/opaque encrypted state where required, current turn/deadline, latest snapshot ID, runtime owner epoch, and timestamps. `game_seats` stores stable player ID, user/guest reference, seat/order, control state, replacement/reclaim status, and final rank.

No UI, hover, selected card/piece, modal, animation, audio, room-chat, or socket object is persisted in game state.

## 8. Authoritative game-state persistence

Use a hybrid model: active instances keep a validated in-memory state for latency; every accepted/rejected command result and accepted domain event is durable; create a full snapshot at session start, every 10 accepted actions or 30 seconds (whichever first), every phase/turn milestone where recovery cost is high, before ownership transfer, and at finish. Tune per game using measured replay cost.

The runtime owns a renewable Redis lease keyed by session and epoch. Before mutation it verifies lease and database version. It commits with `WHERE state_version = expected`, increments once, appends ordered events, updates snapshot pointer when applicable, and writes outbox rows in one PostgreSQL transaction. Losing the lease halts action acceptance.

Recovery loads the latest valid snapshot, verifies checksum/schema/game version, replays later ordered events through the matching engine, checks final version/sequence/checksum, then acquires a new ownership epoch. Corrupt snapshots are quarantined and recovery tries the previous snapshot. Irreconcilable state pauses the match and opens an incident; it never guesses state.

## 9. Snapshot and event persistence

`game_snapshots`: session, state version, event sequence, schema/engine/game versions, codec/compression, encrypted authoritative payload, checksum, created reason/time. Hidden state is encrypted at rest and inaccessible to general analytics/support roles.

`game_events`: session, sequence, resulting state version, event ID/type/version, encrypted authoritative payload or explicitly public payload, actor seat, request ID, timestamp. `(session_id, sequence)` and event ID are unique. Events are append-only; corrections are new events/audit records.

`outbox_events`: aggregate ID/type, aggregate version, recipient/fan-out descriptor, safe payload reference, attempts, availability/processed time. Workers claim with `SKIP LOCKED`. Projection payloads should normally be regenerated from committed state; private payload caches have short retention and recipient keys.

## 10. Durable idempotency

`idempotency_records` key is `(game_session_id, authenticated_identity_id, request_id)`. It stores canonical action hash, `PROCESSING|COMPLETED|REJECTED|EXPIRED`, claimed owner/expiry, accepted flag/rejection code, resulting version, encrypted or safe response payload/reference, creation/completion/expiry.

Claim uses `INSERT ... ON CONFLICT` in the same database used for the session write. A new row owns execution. Same key/hash returns stored completion; same key with another hash rejects `REQUEST_ID_COLLISION`; a live `PROCESSING` row returns retry-after/pending; an expired orphan is reclaimed only after verifying no committed event/result exists. Action transition, events, session version, final idempotency result, and outbox are one transaction. Normal records live through the match plus at least 24 hours; rated/result-affecting actions retain seven days or the result dispute window.

## 11. Reconnect-session storage

Database membership/seat records are durable truth. Redis stores hashed reconnect nonce, identity/session/seat binding, connection epoch, last acknowledged sequence, grace deadline, and one-use rotation state. TTL equals grace plus a small recovery margin. Reconnect authenticates, atomically consumes/rotates nonce, verifies seat/control status, invalidates older connection epochs, loads a recipient projection from durable recovered state, and then enables actions. Stale Redis data is rejected against database session/seat versions.

## 12. Player-specific projections

The projection service accepts full trusted state, verified recipient context, and explicit mode: `PLAYER`, `OPPONENT` (another player’s public representation), `TEAMMATE`, `SPECTATOR`, or separately granted `MODERATOR`. It verifies membership/grant before calling a game adapter and serializes only the returned projection. A projection error fails closed, with no fallback to full state.

- Color Clash: own hand/legal actions only; opponents expose hand count; deck order never leaves authority.
- Royal Race: public board plus own decisions; dice/legal moves remain server-generated.
- Property Empire: public board/economy plus authorized pending choices; future private trade data is participant-only.
- Moon Village: use engine public/player-private/team-private APIs; never construct a full projection then filter it. Live spectators get delayed public-only data, eliminated access follows explicit policy, and moderator projection requires a trusted server capability plus audited grant.

Raw serialized-response tests scan for known secrets. Client Zustand/DOM/CSS never participates in access control.

## 13. Database schemas

Proposed PostgreSQL tables and ownership:

| Group | Tables | Lifecycle / sensitive data / versioning |
| --- | --- | --- |
| Identity | `users`, `profiles`, `external_identities`, `auth_sessions`, `verification_tokens`, `password_reset_tokens` | account lifecycle; PII/secret hashes; `schema_version` |
| Rooms | `rooms`, `room_members`, `room_invitations` | waiting through retention expiry; invite hashes; settings version |
| Queue | `matchmaking_tickets`, `match_acceptances` | short-lived; rating/region; policy version |
| Runtime | `game_sessions`, `game_seats`, `game_snapshots`, `game_events`, `idempotency_records`, `reconnect_sessions`, `outbox_events` | match plus recovery/dispute retention; hidden encrypted payloads; schema/game/event versions |
| Results | `game_results`, `result_participants`, `rankings`, `rating_ledger` | durable server-confirmed history; algorithm version |
| Progression | `achievements`, `user_achievements`, `progression_ledger`, `bot_profiles` | durable/versioned definitions and grants |
| Safety | `audit_logs`, `moderation_cases`, `moderation_actions`, `restrictions` | append-only/minimized; no secret payloads |

Every row has opaque ID, timestamps where applicable, and a schema version for mutable JSON/envelopes. Foreign keys and deletion behavior are explicit; polymorphic identity references use validated separate user/guest columns or a stable identity table, not unchecked strings.

## 14. Database indexes

Required indexes include: unique normalized email and handle; auth session by user/status/expiry and unique token hash; unique active room code plus room status/expiry; unique room identity and `(room_id, seat)`; invitation token hash and expiry; one active matchmaking ticket per identity/game/playlist; queue search on status/game/region/rating/entered time; game session by room and status/updated time; unique game seat identity/seat; unique event sequence and event ID; snapshot by session/state version descending; idempotency composite key and expiry; reconnect token hash/expiry; unique result per session; ranking by game/season/rating descending; unique achievement grant; audit/case indexes by actor/subject/time and case/status.

Partial indexes cover active sessions/tickets/rooms. Time-partition high-volume events/audit/outbox after measurement. TTL cleanup uses scheduled SQL jobs on indexed expiry columns; PostgreSQL has no Mongo-style TTL index.

## 15. Transaction boundaries

- Room start: lock room/version → validate seats/readiness → mark starting → create session/seats/initial snapshot/outbox → mark in-game.
- Action: idempotency claim → lock/optimistic session update → engine result → event(s)/optional snapshot → session pointer/version → completion/result if terminal → idempotency completion → outbox.
- Match completion: terminal session/event, exactly one result, participants, rating/progression ledger intents, and outbox. Expensive derived grants may consume outbox idempotently.
- Refresh rotation: lock session/family, mark old rotated, create successor, detect/revoke replay.
- Bot replacement/reclaim and host transfer: lock seat/room, increment epoch/version, invalidate pending commands, audit/outbox.

External email/telemetry/socket calls never occur inside the database transaction. Failures retry from outbox. If a future store lacks transactions, it must implement a tested saga with compensating records; that is not the current recommendation.

## 16. Redis and pub/sub topology

Use separate logical key prefixes and ACL credentials: `gs:{env}:presence:{user}`, `room:{id}:members`, `game:{id}:owner`, `game:{id}:lock`, `reconnect:{hash}`, `mm:{game}:{region}`, `timer:{bucket}`, `rl:{scope}:{identity}`, and Socket.IO adapter keys. Values carry schema version and ownership epoch. All non-static keys have TTL; locks use unique fencing tokens and compare-and-delete renewal.

Two Redis connections support Socket.IO publish/subscribe; command connections handle leases, queues, counters, and presence. Matchmaking and timeout jobs use durable database records plus Redis acceleration. Redis failover disables new ownership/matchmaking and may temporarily reject actions; current committed database state remains valid. Startup scans active database sessions/timers, clears stale epochs through leases, and rebuilds cache. Cache invalidation uses versioned events; stale values lose to database versions.

## 17. Socket.IO production topology

Use one authenticated `/platform` namespace and one browser connection unless load testing proves isolation is needed. Join transport rooms such as `user:{id}`, `room:{id}`, `session:{id}:public`, and recipient-specific `session:{id}:player:{playerId}`; moderator channels require a separate grant. Keep the approved versioned event names.

The load balancer supports WebSocket upgrade, TLS, idle timeout above heartbeat, and sticky sessions for connection recovery/long-poll fallback; the Redis adapter fans out between instances. Namespace middleware validates origin, access/reconnect token, auth epoch, protocol version, account status, and payload ceilings. Gateways register once per process, remove listeners on shutdown, stop accepting commands, drain in-flight transactions/outbox claims, release leases, and close sockets with a retry hint.

Use bounded send buffers, acknowledgement deadlines, per-event schema/size checks, 8 KiB commands, 64 KiB snapshots initially, heartbeat around 25/20 seconds (measure mobile behavior), jittered reconnect, and admission/rate controls for storms. Rolling deployments support current and previous protocol/engine readers until old sessions drain or migrate.

## 18. Matchmaking architecture

Tickets contain identity, game/preset/version, party ID, region, rating/uncertainty, latency preferences, entered time, expansion policy version, status, acceptance deadline, and cancellation version. A unique partial index prevents duplicate active tickets. A worker claims ordered candidates, starts with a narrow region/rating range, expands at configured intervals, preserves party atomicity, and creates a proposed match transactionally.

All participants receive a short acceptance window. Decline/timeout returns eligible peers according to policy and penalizes abuse separately. Cancel is idempotent until match commit. Disconnect retains ticket briefly only if identity can reconnect. Bot fallback is opt-in and does not create rated human results by default. No complex rating matcher is implemented until population and fairness requirements exist.

## 19. Timeout and disconnect policies

Per-game server-owned configuration versions define reconnect grace, turn deadline, permitted auto-action, bot replacement, reclaim, forfeit, cancellation, and spectator conversion. Initial recommendations: 30-second reconnect grace; Color Clash auto-draw/pass only when engine says legal; Royal Race server roll/move policy requires approval; Property Empire unresolved decisions may pause until a bounded decision timer; Moon Village phase deadlines use private engine legal defaults without revealing actors.

Database stores deadlines. Workers claim due timers using leases/fencing and compare session version before action. Duplicate timer delivery is an idempotent system command. Client timers are display-only. Instance loss causes another worker to claim overdue timers from durable records.

## 20. Spectator policies

Room policy controls account eligibility, invite/public visibility, capacity, chat, reconnect, and delay. Spectators have explicit read-only membership and separate rate limits. They cannot join player recipient rooms or submit game actions. Delay streams reference committed public sequence, not delayed hidden state in client memory.

Moon Village defaults to no live roles, public-only delayed projection, no team/private chat, and optional post-game reveal. Moderator access is a separate audited grant, never implied by spectator role. Private rooms default to host-approved/invite-only spectating.

## 21. Bot replacement and reclaim

Triggers are grace expiry, explicit player opt-in, or server policy—not client self-assignment. The transaction changes seat control/epoch, invalidates pending human commands, records difficulty/policy, and emits an audit/domain event. The bot receives only its authorized projection and submits through the same version, idempotency, authorization-as-controller, validation, and timeout path.

Temporary replacement preserves a configurable reclaim window. Reclaim reauthenticates the original identity, verifies no permanent forfeit, rotates reconnect credentials, changes control atomically, and sends a fresh projection. Hidden information observed by the bot is not broadened to the human. Rated impact, repeated disconnect abuse, and game-specific permanent replacement remain open policy decisions.

## 22. Results and ranking persistence

Only a terminal authoritative engine transition creates a result. `game_results` is unique by session and records game/rule versions, participants, ordered rank/winner, duration, completion reason, statistics, rated eligibility, reward status, and creation time. Participant and rating changes use append-only ledgers with algorithm/season versions and before/after values.

Duplicate completion returns the existing result. Abandoned/no-contest/private/bot/offline matches have explicit non-rated policy. Corrections append an audited superseding record/ledger reversal; they never edit history invisibly. Recalculation uses the original confirmed event/version and deterministic rating algorithm.

## 23. Progression and achievement boundaries

Achievements are versioned definitions evaluated only from confirmed result/domain-event facts. Unique `(user, achievement, definition_version, source_session)` grants and an append-only progression ledger prevent duplicates. Reward/catalog/payment ownership is outside this phase; result rows may carry an idempotent `reward_status` boundary but no monetary value or payment workflow. Guest/local outcomes are not trusted competitive progression.

## 24. Audit logging

Audit login/logout/failure class, refresh rotation/replay, verification/reset completion, room create/close/host transfer, session creation, bot replacement/reclaim, moderator/restriction actions, result correction, admin/support access, repeated collisions, and suspicious authorization failures. Records include timestamp, action, outcome, actor/subject IDs, safe resource IDs, correlation/trace/request IDs, network-risk hash where lawful, and metadata allow-list.

Never log passwords, token values/hashes, cookies, private chat by default, raw request bodies, authoritative hidden state, role/card data, or control characters. Structured encoders sanitize line breaks and enforce size. Access and retention are restricted and auditable.

## 25. Moderation boundaries

Phase 9 defines case/restriction/action records, report intake, evidence references, scoped grants, appeal/status lifecycle, and enforcement hooks at auth/room/chat/matchmaking. It does not implement a final dashboard or automated punishment. Moderators cannot inspect hidden game state unless a specific incident grant is approved and audited. Support and moderator roles are distinct; all elevated reads use reason codes and least privilege.

## 26. Rate limiting

Use Redis atomic counters/sliding windows backed by policy configuration, combining authenticated identity/session plus privacy-preserving network/device risk keys—never IP alone. Distinct starting policies: login 5/15 min/account+network; registration/reset 3/hour; room create 10/hour; joins 30/10 min; invitations 20/hour; matchmaking mutation 10/min; game action burst 10/second and sustained 60/min; snapshot/resync 6/min; reconnect 12/min; spectator join 20/hour; chat 10/10 sec; moderation/admin stricter and step-up authenticated.

Responses include safe retry timing and correlation ID. Successful authentication does not reset network abuse counters. Internal bot/system commands use service credentials and separate quotas. Exact values require load/security testing and configuration—not hard-coded transport logic.

## 27. Security controls

- Passwords: Argon2id/scrypt with per-secret salt, tunable cost, pepper in managed secrets, constant-time verification, rehash-on-login.
- Tokens: asymmetric signing with key IDs/rotation, strict issuer/audience/time, opaque hashed refresh/reset/invite/reconnect tokens, family replay detection.
- Web: exact CORS allow-list, origin/CSRF checks for cookies, security headers, output encoding, no secrets in URLs, TLS only.
- Input: runtime schema allow-lists, normalization, payload/depth/array/string limits, parameterized Prisma queries, no raw object spread/mass assignment, reject operator-like keys in generic JSON.
- Realtime: authenticated handshake and every-command authorization, bound seat identity, versions/idempotency, event allow-list, socket/payload/backpressure limits.
- Privacy: project before serialize, encrypt hidden snapshots/events, recipient channels, raw-payload leakage tests, redacted logs/traces/errors.
- Operations: managed secrets, least-privilege DB/Redis ACLs, dependency/SBOM scanning, patch policy, encrypted backups, admin MFA and audit.

Threat-model tests cover token theft/replay, CSRF, CORS, XSS-sensitive strings, injection, mass assignment, authorization bypass, event spoofing, request replay/collision, oversized payloads, rate-limit evasion, log injection, and Moon Village secret leakage.

## 28. Observability

Emit JSON logs, metrics, and OpenTelemetry traces with `requestId`, `traceId`, safe `userId`, `roomId`, `gameSessionId`, `stateVersion`, and `connectionId`; omit payload secrets. Health endpoints separate liveness (process), readiness (DB, Redis for coordinated writes, migrations, engine registry), and deep diagnostics (protected).

Measure HTTP/socket connections, auth outcomes, active rooms/sessions, action latency and rejection by safe code, transaction conflict/retry, idempotency duplicate/collision, projection latency/failure, outbox lag/dead letters, reconnect success/time, matchmaking wait/cancel, timer lag, DB pool/query latency, Redis errors, event-loop lag, memory, and backup/restore status. Alerts use SLOs and burn rates. High-cardinality IDs remain trace/log fields, not metric labels.

## 29. Deployment architecture

Serve Next.js separately from horizontally scaled API/realtime instances. A managed load balancer terminates TLS and forwards trusted proxy metadata. PostgreSQL runs multi-AZ with encrypted storage/backups; Redis runs HA with ACL/TLS. Static assets use CDN/object storage. Secrets come from a managed secret store and differ by local/test/staging/production.

Build immutable images as non-root, run dependency and image scans, apply migrations as a one-at-a-time pre-deploy job, then rolling deploy with readiness gates, connection drain, lease handoff, and protocol compatibility. Start in one write region; do not add active-active game authority until fencing, data locality, and failover are proven. Logs/traces/metrics go to managed sinks with retention/access controls.

No Docker, cloud deployment, environment schema, health service, or runtime adapter exists in this repository yet; therefore deployment readiness is not claimed.

## 30. Migration strategy

Use forward-only numbered database migrations reviewed against production-scale data, with expand → dual-read/write where needed → backfill → verify → contract across releases. Migrations record checksum/application version and are never run independently by every web replica. Destructive changes require backup, tested rollback/roll-forward, and maintenance policy.

Every snapshot/event/rule/settings/idempotency payload has `schemaVersion` plus engine/game/event version. An engine registry supplies pure migrators one version at a time. Recovery copies/quarantines raw incompatible payloads, migrates in memory, validates through engine deserialization/invariants, then writes a new snapshot without rewriting append-only history. Redis keys include a version prefix and are rebuilt/dual-read rather than migrated in place where possible.

The bounded Phase 9 foundation includes an executable migration from a version-1 persisted snapshot fixture to version 2 and rejects unknown/corrupt versions. It does not migrate existing browser saves or a production database.

## 31. Backup and disaster recovery

Recommended baseline: PostgreSQL continuous WAL/PITR with daily full backups, 35-day operational retention and monthly archives per policy; encrypted cross-zone/account copy; quarterly restore drills in an isolated environment. Verify logical consistency, migration level, sampled snapshot checksums, and result counts after restore. Redis is reconstructible coordination; enable AOF/snapshots only to reduce queue/presence recovery time, never as sole permanent truth.

On process/region loss, fence old runtime owners, restore/confirm PostgreSQL, rebuild Redis keys from active sessions/timers, recover snapshots/events, rotate reconnect credentials where needed, and resume or safely pause matches. Partial writes resolve through transactions/outbox/idempotency. Corrupt latest snapshot falls back and replays events. Initial targets are RPO ≤5 minutes and RTO ≤60 minutes for durable account/results, with active-match RPO 0 committed actions and RTO ≤15 minutes; these are objectives, not achieved guarantees, until a restore/failover exercise passes.

## 32. Testing strategy

Unit: password hash/verify and parameter upgrade, token hashing/rotation/replay, authorization matrix, record validation, projection grant/fail-closed behavior, rate policies, migration fixtures, idempotency collision/duplicate/concurrency.

Integration with real PostgreSQL/Redis/Nest adapters: registration/login/refresh/logout; room start transaction; accepted/rejected/stale/duplicate action; process restart/recovery; outbox retry; reconnect rotation; host/bot races; timeout duplicate; result/rating uniqueness; migration up/down safety where supported; TTL/cleanup. Use containerized disposable services only after configuration exists.

Security: raw JSON hidden-state scans for every recipient/game, Moon Village role/team/night/investigation/protection/vote access, spoofed seat/moderator, CSRF/CORS, injection, oversized/deep payload, token replay, rate-limit bypass, and log redaction. Load/chaos: reconnect storm, gateway rolling restart, Redis failover, DB contention, lease fencing, outbox backlog, snapshot size/projection latency.

Repository validation remains typecheck, lint, unit tests, production build, and Playwright. No database/container/migration command may be reported until such scripts and adapters really exist.

## 33. Allowed implementation scope

This phase may add a framework-neutral backend foundation with durable record/index contracts, security primitives, refresh-session state transitions, authorization, projection gating, idempotency coordination against an injectable atomic store, rate-limit policy, observability redaction, and one prior-fixture migration. Test adapters are explicitly non-durable.

Deferred: Nest runtime/modules, Prisma schema/client/migrations, PostgreSQL and Redis adapters, Socket.IO gateway, email/OAuth, cloud deployment, production Color Clash persisted flow, full matchmaking/ranking/moderation, payments, and voice. No frontend or engine-rule change is required.

## 34. Risks and unresolved decisions

| Risk | Severity | Mitigation / status |
| --- | --- | --- |
| Placeholder API mistaken for production backend | Blocker | Prominent readiness labels; no production claim; runtime/adapters remain gate items |
| Memory-only Phase 8 state/idempotency | Blocker for production | Production route must use PostgreSQL transaction; development endpoint remains disabled in production |
| Hidden-state serialization/log leakage | Blocker | Projection-before-serialization, encryption, raw JSON/redaction tests, least privilege |
| Split-brain action execution | High | Redis fencing plus database optimistic version; halt on lease loss |
| Refresh replay/account takeover | High | rotating hashed families, atomic reuse revocation, short access tokens, audit |
| Snapshot/engine version incompatibility | High | engine registry, fixture migrations, quarantine/fallback/replay |
| Transaction/outbox races | High | one action transaction, unique constraints, outbox, idempotent consumers |
| Reconnect/bot reclaim races | High | seat/control epoch and transactional transition |
| Reconnect storms/abuse | High | jitter, admission/rate limits, bounded payloads/queues |
| PostgreSQL/Prisma choice unvalidated | Medium | benchmark and ADR before adapter installation |
| Open guest/rating/spectator/moderation policies | Medium | default restricted behavior; product approval required |
| DR targets unproven | High | no readiness claim until restore/failover drill |

No blocker/high issue can be considered fixed merely by specification; production claims remain blocked until the corresponding adapter and operational test exists.

## 35. Phase 10 readiness checklist

- [x] Phase 8 authority, command, reconnect, and projection contracts inspected and reused.
- [x] Proposed backend/module boundaries, PostgreSQL schema/indexes, Redis and Socket.IO topology specified.
- [x] Authentication, authorization, idempotency, recovery, result, security, observability, migration, and DR policies specified.
- [x] Bounded storage-neutral foundation and prior-fixture migration approved for implementation in Phase 9.
- [ ] Product decisions approved for guests, ratings, spectator delay, timeouts, reclaim, moderation, and retention.
- [ ] NestJS runtime/configuration/health bootstrap installed and validated.
- [ ] Prisma/PostgreSQL schema, migrations, transaction repositories, and real integration tests implemented.
- [ ] Redis ACL/TLS adapters, leases/fencing, queues, rate limits, and failover tests implemented.
- [ ] Socket.IO gateway/Redis adapter/load-balancer behavior and rolling shutdown tested.
- [ ] Production auth signing/secret/email providers and CSRF/CORS/security controls tested.
- [ ] Concrete server projection adapters and raw-payload privacy suites pass for all games.
- [ ] Persisted Color Clash restart/reconnect/finish/result flow passes across two backend instances.
- [ ] Backup restore and active-session recovery exercise meets approved RPO/RTO.
- [ ] Load, chaos, dependency, container, and deployment checks pass with evidence.

Phase 10 must not begin until this checkpoint is reviewed and explicitly approved. Phase 9 specification approval does not by itself certify production readiness.
