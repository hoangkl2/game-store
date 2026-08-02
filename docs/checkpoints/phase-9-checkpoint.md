# Phase 9 Checkpoint — Production Backend and Data Persistence

Status: **READY FOR APPROVAL — FOUNDATION ONLY, NOT PRODUCTION-READY**  
Date: 2026-08-02  
Scope gate: Phase 9 complete; Phase 10 not started.

## Deliverables

- Specification: `docs/backend/phase-9-production-backend-specification.md`
- Framework-neutral package: `packages/backend-core`
- Backend record, module, and PostgreSQL index contracts
- Password hashing and refresh-session rotation/replay primitives
- Identity/seat/role authorization checks
- Idempotency repository contract and execution coordinator
- Fail-closed recipient projection service
- Rate-limit policy and structured-log redaction
- Persisted snapshot v1→v2 migration
- Color Clash engine foundation integration test

## Repository audit and compatibility

The repository still has no production API runtime. `apps/api` is a one-file Phase 0 TypeScript placeholder whose package script mentions Nest but declares no Nest dependency. There is no auth implementation, database client/schema, Mongoose model, Prisma adapter, Redis client, Socket.IO gateway, room/session repository, Docker/environment/deployment configuration, migration runner, seed, health service, audit sink, or backup procedure.

Phase 8 is complete and remains a development-only in-memory authority. Its protocol-v1 request/result/snapshot/event contracts, version checks, reconnect semantics, and recipient projection requirements were reused by reference. Its state, room data, idempotency, and events remain non-durable and unavailable in production.

Phase 0 selected PostgreSQL/Prisma as the planned database direction. The Phase 9 brief’s Mongo/Mongoose list was conditional, and no repository code later selected MongoDB. The specification therefore retains PostgreSQL as the proposed durable truth and maps required data to relational tables/indexes. Prisma remains an adapter decision to validate before installation; no database stack is falsely represented as implemented.

No existing app, engine, room mock, frontend route, save adapter, animation, audio, or realtime behavior was changed. The package is additive and depends on game packages only for a test integration.

## Architecture and persistence definition

The specification defines stateless Nest API/realtime instances behind a load balancer, PostgreSQL durable truth, Redis ephemeral coordination, background timeout/matchmaking/outbox workers, and server-only game-engine execution. Transport, authorization, orchestration, persistence, projection, emission, jobs, and observability remain separate modules.

The authoritative action transaction is defined as durable idempotency claim → ownership/version check → engine validation/reduction → ordered events/optional snapshot → session version/pointer/result → idempotency completion → outbox. Acknowledgement follows database commit. The hybrid recovery model uses milestone/periodic snapshots plus append-only events and engine-versioned replay. Redis leases require fencing; Redis is never permanent truth.

The specification includes all 35 requested areas: architecture/modules, auth/authz, users/profiles/rooms/sessions/state/snapshots/events, idempotency/reconnect/projections, schemas/indexes/transactions, Redis/Socket.IO, matchmaking/timeouts/spectators/bots, results/ranking/progression, audit/moderation/rate/security/observability, deployment/migrations/DR/testing/scope/risks/readiness.

## Implemented foundation

`@game-store/backend-core` provides:

- Durable-record TypeScript contracts for game sessions, seats, snapshots, and events, with strict runtime session validation and no UI/animation/audio state.
- A 26-entry PostgreSQL index manifest covering identity, auth sessions, rooms, invitations, matchmaking, sessions/seats, snapshots/events, idempotency, reconnect, results/rankings, achievements, audit, and moderation.
- Asynchronous scrypt password hashing with per-password salt, constant-time verification, bounded cost/memory-sensitive parameters, Unicode/Vietnamese input tests, and rehash detection. Argon2id/managed pepper remains the production recommendation.
- At-least-256-bit opaque token generation, SHA-256 token hashing, refresh-family records, atomic-transition inputs, rotation, expiry/revocation behavior, and replay detection. It does not issue access/JWT tokens or persist sessions.
- Authorization for host, human seat, bot controller, spectator, moderator, administrator/support boundaries. Client-supplied player IDs must match the authenticated seat.
- A storage-neutral idempotency repository interface and coordinator with canonical action hashing, collision rejection, in-flight duplicate protection, accepted/rejected result replay, and owner-bound completion.
- A projection service requiring an exact identity, mode, and player grant before invoking player/opponent/teammate/spectator/moderator adapters. It has no full-state fallback.
- Identity-aware rate-limit defaults and structured-log redaction for credentials and hidden-game field names.
- A pure persisted-snapshot migration from schema v1 to v2 with checksum and strict corruption/unknown-version rejection.

The in-memory idempotency implementation lives only under `src/testing` and is not exported from the package root. It is not durable and cannot satisfy production persistence. Production must bind the interface to a transactional PostgreSQL repository.

## Color Clash foundation flow

The integration test reuses `UnoEngine` as the existing Color Clash rules engine. It verifies authenticated seat binding, engine-generated legal action, one idempotent reducer execution, duplicate replay without a second reduction, distinct player/spectator projections, absence of spectator hands/actions, serialization, v1 fixture migration, and engine deserialization.

This is not the recommended full persisted vertical slice: there is no registration endpoint, room repository, second process, PostgreSQL commit, Redis lease, socket, backend restart, reconnect token, durable result, or ranking write. It must not be described as production multiplayer.

## Security and severity audit

Fixed blocker/high-severity findings in the implemented scope:

- Unsafe identity correlation: authorization now binds supplied player IDs to authenticated seat identity/control and separates moderator/spectator/bot grants.
- Projection fallback/leakage risk: projection requests fail closed on identity, mode, seat, opponent, or grant mismatch; raw projection tests verify known opponent secrets are absent.
- Duplicate/concurrent action risk: the coordinator requires an atomic repository claim, canonical action hash, claim owner, collision handling, and original-result replay; concurrent test requests execute once.
- Credential exposure/weak comparison: passwords use salted scrypt and constant-time comparison; refresh/opaque tokens are hashed before record storage.
- Resource-exhaustion risk from malformed stored scrypt parameters: cost, block size, parallelism, key length, salt length, and password byte length are bounded before allocation/derivation.
- Unsafe log metadata: sensitive keys are redacted, nested values are dropped by default, control characters are normalized, and strings are bounded.
- Accidental memory-adapter use: the in-memory idempotency adapter was moved to a non-exported test-only path.
- Persisted-state ambiguity: session status/control/seat/date/version validation is strict; migration validates checksums and rejects unknown/corrupt versions.

No blocker/high issue remains in the bounded foundation. Production readiness remains blocked by absent runtime and durable adapters; specification alone does not fix those blockers.

## Files created

- `docs/backend/phase-9-production-backend-specification.md`
- `docs/checkpoints/phase-9-checkpoint.md`
- `packages/backend-core/package.json`
- `packages/backend-core/tsconfig.json`
- `packages/backend-core/vitest.config.ts`
- `packages/backend-core/src/{index,model,security,authorization,idempotency,projection,migration,policy}.ts`
- `packages/backend-core/src/testing/in-memory-idempotency.ts`
- `packages/backend-core/src/__tests__/{security,authorization-projection,idempotency,model-migration-policy,color-clash-foundation.integration}.test.ts`

## Files modified

- `pnpm-lock.yaml` — backend-core workspace importer and existing workspace test dependencies.

Generated ignored artifacts such as coverage and Playwright output are not deliverables. No production source outside the new package was modified.

## Validation report

| Command | Result |
| --- | --- |
| `pnpm.cmd install` | PASS — 14 workspace projects resolved; no new runtime package downloaded. |
| `pnpm.cmd --filter @game-store/backend-core typecheck` | PASS. |
| `pnpm.cmd --filter @game-store/backend-core test` | PASS — 5 files / 18 tests. |
| `pnpm.cmd typecheck` | PASS — 13/13 workspace packages. |
| `pnpm.cmd lint` | PASS — 13/13; repository lint scripts currently run TypeScript checks. |
| `pnpm.cmd test` | PASS — 13/13 workspace tasks; backend-core 18/18. |
| `pnpm.cmd build` | PASS — API TypeScript and Next.js 15.5.22 production build; 19 routes generated. |
| `pnpm.cmd exec playwright test` | PASS — 13/13 browser tests. |

Backend-core coverage: 100% statements, 97.36% branches, 100% functions, and 100% lines. The complete validation set was rerun after the final security/maintainability refactor.

No PostgreSQL/Redis/container health, database migration, restore, failover, or load command exists in the repository, so none was invented or reported. The v1→v2 snapshot migration is validated by the package test fixture. `apps/api`’s current test script is only `tsc --noEmit`.

## Risks and unresolved decisions

Production blockers:

- No NestJS bootstrap/configuration/validation/health runtime.
- No Prisma/PostgreSQL schema, migration runner, transaction repository, outbox, encryption adapter, or real restart test.
- No Redis ACL/TLS client, Socket.IO adapter/gateway, lease/fencing, timeout queue, rate-limit backend, or failover test.
- No access-token signer/key rotation, HTTP-only cookie/CSRF/CORS integration, refresh persistence, email verification/reset provider, or compromised-session socket revocation.
- No concrete server projection adapters/privacy suites for all games; Moon Village engine projection remains the strongest existing source boundary.
- No deployment image/environment schema/load balancer/secrets/telemetry/backup restore evidence.
- No full persisted Color Clash room → restart → reconnect → finish → result flow.

Open product/architecture decisions: final Prisma adapter ADR, cloud/region/vendors, guest online/rating/reward eligibility, spectator delay/chat retention, per-game timeout/auto-action and bot-reclaim policy, rating algorithm/private-room policy, moderation roles/vendor/retention, signing/key/email providers, and funded RPO/RTO.

## Phase 10 readiness

| Foundation | Readiness |
| --- | --- |
| Complete Phase 9 backend/persistence specification | Ready. |
| Framework-neutral security, authorization, record, index, idempotency, projection, policy, and migration contracts | Ready and tested. |
| Existing engine integration and recipient-boundary proof | Ready as a bounded foundation test only. |
| Product/security/deployment decisions needed for implementation | Open. |
| Nest/Prisma/PostgreSQL/Redis/Socket.IO production runtime | Not implemented. |
| Production auth, durable idempotency, horizontal coordination, DR/load/security proof | Not implemented. |

Phase 10 may use this specification and foundation only after approval, and must preserve the non-production boundary until every unchecked readiness item has implementation evidence.

## Approval gate

Phase 9 is complete and stopped at this checkpoint. **Explicit approval is required before Phase 10 begins.**
