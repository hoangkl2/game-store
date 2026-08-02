# Phase 8 Checkpoint - Realtime Multiplayer Integration

Status: **READY FOR APPROVAL**  
Date: 2026-08-02  
Scope gate: Phase 8 complete; Phase 9 not started.

## Deliverables

- Specification: `docs/realtime/phase-8-realtime-multiplayer-specification.md`
- Pure package: `packages/realtime-core`
- Development-only mock authority endpoint: `/api/dev/realtime`
- Development-only diagnostics page: `/dev/realtime`
- Color Clash committed-event bridge into Phase 6 animation and Phase 7 audio
- Unit, integration, security, presentation-deduplication, and two-context Playwright coverage

## Repository audit

- No Socket.IO/WebSocket implementation, auth/session implementation, realtime Zustand store, production room API, reconnect overlay, or realtime Playwright mock existed.
- Phase 4 remains a truthful local room mock. Existing game pages remain offline-authoritative and were not reclassified as online.
- No duplicate sockets, stale socket listeners, or unbounded realtime subscriptions existed because no transport existed. The new route subscription registry replaces duplicate keys and provides deterministic route cleanup.
- Phase 6/7 queues already had reconnect cancellation. The new committed-event bridge deduplicates by event ID/sequence before mapping and resets both presentation systems on resync.
- Moon Village already had raw public/player projection tests. That engine projection remains the mandatory privacy boundary; no client filtering or second role model was added.

## Architecture implemented

`@game-store/realtime-core` defines protocol-v1 action/result/snapshot/event envelopes, explicit connection states, bounded retry behavior, request-ID generation, pending-command registry, sequence-gap/event deduplication, and route subscription cleanup. Runtime transport/socket instances are absent from these serializable states.

`MockColorClashAuthority` owns room membership/version, session creation, deterministic UNO/Color Clash engine state, full deck, legal validation, authoritative state version, event sequence, idempotency results, host migration, connection flags, spectator projection, bot-control replacement label, and match completion. It emits recipient-specific full snapshots and bounded public committed events. State patches are deliberately not implemented.

The web endpoint is in-memory HTTP diagnostics, not Socket.IO. It returns 404 in production, limits payloads to 8 KiB, sanitizes endpoint errors, and is explicitly labelled as lacking authentication, persistence, matchmaking, horizontal scale, and production realtime. The mock identity is bound to its player seat for executable spoofing tests but is not production authentication.

## Room and game-session flow

Implemented development proof: create private Color Clash room -> second mock identity joins -> room-versioned ready commands -> host start -> authoritative deterministic session -> separate player snapshots -> versioned action -> acknowledgement/committed event -> duplicate returns original result -> stale action requests snapshot -> disconnect/host migration -> reconnect/fresh snapshot -> spectator read-only snapshot -> deterministic server-confirmed finish.

Invite delivery, matchmaking, handoff countdown/client-ready acknowledgement, real timers, transport heartbeat, and room persistence are specification-only. Existing Phase 4 UI was preserved.

## Command, snapshot, projection, and reconnect behavior

- Idempotency key: session + bound player + request ID. Same envelope returns the original result; a changed envelope with the same key rejects. Records and committed events are capped at 256 in the mock.
- Every accepted action increments the independent authoritative state version exactly once. Stale versions cannot call the reducer and return `snapshotRequired`.
- Player snapshots contain own hand/legal actions plus public opponent counts. Spectators have no hand or legal actions. Public draw events contain counts, never card IDs/deck order.
- Reconnect authenticates only in the future production boundary; the mock rebinds its known identity, returns one fresh recipient snapshot, and sends no historical event backlog.
- Host migration changes room administration only. Server authority never moves to a client.
- Bot replacement changes the disconnected seat’s controller label and prevents human reclaim in this proof. Autonomous bot scheduling/reclaim policy is documented but not represented as complete.

## Animation and audio integration

`deliverColorClashCommittedEvent` accepts only a committed realtime event after event-cursor validation. Duplicates/old events enqueue nothing; a gap requests a snapshot. Supported public card/result events reuse the approved Phase 6/7 adapters. `resynchronizePresentation` applies the snapshot cursor and resets obsolete animation/audio work. Presentation failure never mutates or delays authority.

## Security and privacy audit

Fixed blocker/high findings:

- Player identity was initially represented only by the client-supplied mock player ID. The mock now binds player ID to its original mock user identity and rejects conflicting users/spoofed action players. Production still requires real signed authentication.
- The first idempotency map and development request body were not explicitly bounded. Idempotency/event windows are now capped at 256 and endpoint payloads at 8 KiB.
- Endpoint exceptions could have returned arbitrary internal messages. Only allow-listed development error codes are now exposed.
- A one-card deterministic test could finish before stale-version behavior was isolated. The stale test now uses a guaranteed legal draw; session-closed and stale-version paths remain distinct.

Raw JSON tests verify opponent private cards and spectator hands/actions are absent; public draw events exclude card IDs; spectators and spoofed identities cannot act; stale/duplicate actions cannot mutate twice; Moon Village’s existing engine tests verify unauthorized roles/actions are absent before finish. No blocker or high-severity finding remains.

## Files created

- `docs/realtime/phase-8-realtime-multiplayer-specification.md`
- `docs/checkpoints/phase-8-checkpoint.md`
- `packages/realtime-core/package.json`, `tsconfig.json`, `vitest.config.ts`
- `packages/realtime-core/src/{index,types,client,mock-authority}.ts`
- `packages/realtime-core/src/__tests__/{client,mock-authority}.test.ts`
- `apps/web/src/app/api/dev/realtime/route.ts`
- `apps/web/src/app/dev/realtime/{page,preview}.tsx`
- `apps/web/src/features/realtime/{presentation,presentation.test}.ts`
- `apps/web/tests/realtime.spec.ts`

## Files modified

- `apps/web/package.json` - realtime-core workspace dependency.
- `pnpm-lock.yaml` - workspace link.

No game engine, gameplay route, save format, room mock, animation/audio provider, auth, API scaffold, or production infrastructure behavior was modified.

## Validation report

| Command | Result |
| --- | --- |
| `pnpm.cmd typecheck` | PASS - 12/12 workspace packages. |
| `pnpm.cmd lint` | PASS - 12/12 workspace packages. Repository lint scripts run strict TypeScript checks. |
| `pnpm.cmd test` | PASS - all 12 workspace tasks; realtime core 2 files / 11 tests; web 9 files / 18 tests. |
| `pnpm.cmd build` | PASS - API and Next.js production build; 19 routes generated. Development endpoint remains runtime-disabled in production. |
| `pnpm.cmd exec playwright test` | PASS - 13/13 browser tests, including the two-isolated-context realtime flow. |

Realtime-core coverage: 100% statements/lines, 78.98% branches, 95.65% functions.

## Risks and unresolved decisions

- Production transport/library/topology, authentication/guest tokens, durable room/session/idempotency storage, Redis/pub-sub, rate limiting, deployment, and disaster recovery.
- Matchmaking acceptance, invites, room expiry/capacity, timeout/grace defaults, bot scheduling/reclaim, spectator delay, moderation grants, and reconnect token rotation.
- Protocol evolution, patch strategy, observability backend, horizontal fan-out, rewards, and offline-save-to-online policy.
- Final per-game online rules: Color Clash call/challenge, Property Empire deferred economy, Moon Village dead-player/team/spectator policy.
- The development singleton loses all state on restart and cannot operate across server instances.

## Phase 9 readiness

| Foundation | Readiness |
| --- | --- |
| Typed protocol, authority/version/idempotency semantics | Ready. |
| Recipient projections, spectator guard, Moon privacy requirements | Ready. |
| Connection/reconnect/event dedupe/route cleanup contracts | Ready. |
| Executable single-process mock-authority proof | Ready for development validation only. |
| Production auth, database, durable idempotency, Redis, Socket.IO deployment | Not started; requires Phase 9 approval. |

## Approval gate

Phase 8 is complete and stopped at this checkpoint. Explicit approval is required before **Phase 9 - Production Backend and Data Persistence** begins.
