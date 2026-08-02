# Phase 8 - Realtime Multiplayer Specification

Status: implementation specification  
Scope: shared realtime contracts and a development-only mock-authoritative Color Clash proof. This extends the approved Phase 1-7 specifications by reference. It does not introduce production infrastructure, authentication, matchmaking, voice, persistence, payments, or Phase 9 work.

## Repository findings and compatibility

Confirmed facts: the repository uses Next.js 15 App Router and pure TypeScript game packages. `apps/api` remains a Phase 0 TypeScript placeholder with no Nest runtime, database, authentication, Socket.IO, or WebSocket dependency. Phase 4 provides an explicitly local room UI mock and version/request-ID contract proposal, but no reusable room types in source. Game routes are offline and authoritative locally. Phase 6 and 7 queues already clear obsolete presentation on reconnect. Moon Village has public and player-private projection APIs. Saves are versioned IndexedDB snapshots and are unrelated to online authority.

Audit result: no duplicate socket clients, stale socket listeners, unbounded realtime subscriptions, or Playwright socket mocks exist because no socket implementation exists. Current room UI uses local React state and client-generated bot IDs; it truthfully claims no realtime authority. Game routes can locally advance rules because they are offline-only; that behavior must never be reused as online authority. There is no auth boundary from which a client-supplied `playerId` can be trusted.

Compatibility changes are additive: a transport-neutral `@game-store/realtime-core` package, a development-only mock endpoint/diagnostics page, web workspace dependency, and tests. No existing room/game route is reclassified as online, no engine behavior changes, and no API is generalized from a single game-specific renderer. Color Clash is selected because its engine is deterministic, smallest, and already exposes legal actions and immutable transitions.

## 1. Realtime principles

Server authority is mandatory. Every command has a request ID and expected state/room version. Repeated commands are idempotent. Reconnect applies recipient-specific snapshots, never guessed local state. Projection filtering occurs before transmission. Client selectors, hidden DOM, and CSS are not security boundaries. Only committed events drive Phase 6 animation and Phase 7 audio. Route exit tears down listeners and pending session intent. Results are server-confirmed.

## 2. System boundaries

| Boundary | Owns | Excludes |
| --- | --- | --- |
| `AuthSession` | verified user/guest identity, grants, expiry | socket object, room/game state |
| `RoomState` | membership, host, settings, ready, spectators, room version | cards, roles, legal actions, winner |
| `GameSessionState` | session ID, seats, status, state version, event sequence, timers | UI selections |
| `AuthoritativeGameState` | full engine state, randomness, hidden data, rules | client persistence/presentation |
| `PlayerProjection` | recipient-authorized public/private data and legal actions | opponents' secrets |
| `SpectatorProjection` | read-only policy-filtered public state | actions/live secrets |
| `RealtimeConnectionState` | connection lifecycle, retry count, heartbeat, last error | socket instance or domain state |
| `PendingCommandState` | in-session request IDs and sent versions | cross-session persistence |
| `GameUIState` | focus, dialogs, selections | authority |
| `AnimationState` / `AudioState` | disposable committed-event presentation | rule timing, hidden state |

Socket/transport instances live in an adapter-owned private field or React ref, never persisted Zustand. `VoiceConnectionState` remains a future separate boundary.

## 3. Room lifecycle

Create -> waiting -> join/invite -> settings/bots -> ready check -> starting -> in game -> finished/closed/expired. Create/join/leave/ready/settings/bot/transfer/start commands carry request ID and expected room version where membership already exists. The server validates capacity, duplicate membership, role, host permission, game capability, spectator capacity, compatible client protocol, and current room status. Material settings or roster changes revoke eligible ready states. Room identity and seat assignments persist through game handoff.

## 4. Session lifecycle

`CREATING -> WAITING_FOR_CLIENTS -> COUNTDOWN -> ACTIVE -> FINISHED -> CLOSED`. Start validates the locked room once, assigns seats, creates engine/random state, increments room version, and creates each recipient projection. Duplicate start returns the original session. A missing navigator keeps its seat for the configured grace period; countdown may wait/cancel by server policy. Host loss never transfers game computation.

## 5. Connection lifecycle

| State | Visible/announcement | Authoritative actions | Retry, timeout, cleanup |
| --- | --- | --- | --- |
| `IDLE` | offline/idle | none | connect on explicit online entry |
| `CONNECTING` | “Connecting” | none | bounded attempt, abort on route exit |
| `AUTHENTICATING` | “Verifying session” | none | refresh/retry once, redact errors |
| `CONNECTED` | stable badge, minimal announcement | authorized versioned commands | heartbeat and normal cleanup |
| `DEGRADED` | unstable warning | optionally queue one safe intent; default disable | short retry/backoff |
| `RECONNECTING` | overlay, safe state retained | none | exponential jitter, bounded attempts |
| `RESYNCHRONIZING` | “Updating game state” | none | snapshot timeout -> retry/fail |
| `DISCONNECTED` | connection lost | none | manual/automatic retry within grace |
| `CLOSED` | room/session ended | none | remove listeners and pending state |
| `FAILED` | actionable error/reference | none | manual retry or safe exit |

Every transition records safe correlation data. Timers and subscriptions are canceled on route/session cleanup. Accessibility uses polite announcements except imminent timeout/removed states, which use assertive status sparingly.

## 6. Authentication and authorization boundary

Handshake credentials resolve to an `AuthSession`; the transport binds connection ID to server-derived user/guest ID. Commands may contain `playerId` for correlation, but the server compares it with seat ownership from the authenticated connection. Room membership, host/moderator role, player seat, spectator role, and recipient projection are checked per command/emission. The development mock uses an explicit mock identity header/body and is unavailable in production; it is not authentication.

## 7. Player-specific state projections

Projection functions receive full state plus verified recipient and return new serializable values. Current players receive own private hand/role/legal actions, opponents receive only public counts/status, teammates receive only game-policy-approved team data, spectators receive public read-only data, and moderators receive a separately authorized audit projection. Projection failures fail closed and are logged without hidden payloads.

## 8. Public, private, and team-private payloads

Public: seats, names, connection labels, current turn, visible board/discard, public event summaries, result. Player-private: own hand, own role, own legal actions, authorized investigation/protection result. Team-private: only explicit teammates/coordination state. Moderator: separately permissioned state; never inferred from spectator access. Private values use distinct envelope fields and recipient emissions, not a full-state broadcast.

## 9. Socket event naming

Versioned namespaces: `room:v1:create|join|leave|ready|settings|bot|transfer-host|start|snapshot|member-joined|member-left|host-changed|ready-changed|game-starting`; `game:v1:session-created|client-ready|action|action-result|snapshot|patch|events|turn-timeout|player-disconnected|player-reconnected|player-replaced|finished`; `system:v1:error|ping|pong|maintenance`. Generic `update`, `message`, `change`, and `sync` are prohibited. A transport maps these names to typed request/response definitions.

## 10. Versioned action contract

```ts
interface GameActionCommand<TAction> {
  protocolVersion: 1; requestId: string; gameSessionId: string; playerId: string;
  expectedStateVersion: number; sentAt: string; action: TAction;
}
```

Validate protocol/schema/size, request ID, session, authenticated seat, status, expected version, timeout ownership, and engine action. Client clocks are diagnostic only.

## 11. Action acknowledgement

```ts
interface GameActionResult<TEvent = unknown> {
  protocolVersion: 1; requestId: string; accepted: boolean; gameSessionId: string;
  stateVersion: number; events?: TEvent[]; rejectionCode?: string; message?: string;
  retryable?: boolean; snapshotRequired?: boolean;
}
```

Codes include `STALE_VERSION`, `INVALID_ACTION`, `UNAUTHORIZED`, `DUPLICATE_REQUEST`, `SESSION_CLOSED`, `PLAYER_REMOVED`, `TURN_TIMEOUT`, `MALFORMED_COMMAND`, and retryable transport failure. Safe messages never reveal legal/hidden data. Accepted events are recipient-filtered or delivered through a separate committed-event envelope.

## 12. Idempotency and duplicate protection

Key: `(gameSessionId, authenticatedPlayerId, requestId)`. The authority records a bounded hash of the command and original result before responding. Same key/same hash returns the original result without reducer execution or event emission; same key/different hash rejects as collision. Retain through session lifetime plus 24 hours for normal games, configurable to seven days where rewards exist. Cleanup is bounded. Rewards/payments are absent in this phase and later require their own durable ledger.

## 13. State snapshots

```ts
interface GameSnapshot<TProjection> {
  protocolVersion: 1; gameSessionId: string; stateVersion: number; serverTime: string;
  recipient: { type: "PLAYER" | "SPECTATOR" | "MODERATOR"; playerId?: string };
  projection: TProjection; currentTurn?: { playerId: string; startedAt: string; expiresAt?: string };
  status: "WAITING" | "ACTIVE" | "FINISHED" | "CLOSED";
  lastEventSequence: number;
}
```

Snapshot schema, session, monotonic version, recipient, and size are validated before atomic replacement. Each snapshot is generated for one verified recipient.

## 14. State patches

Phase 8 uses recipient-specific full snapshots plus committed events because current projections are small and correctness/privacy outweigh premature optimization. A future patch must declare base/target versions, apply atomically, reject gaps/out-of-order data, roll back on validation failure, and request a fresh snapshot. JSON Patch is not adopted yet.

## 15. Domain-event delivery

`RealtimeDomainEvent<T>` contains event ID, sequence number, session, state version, type, occurrence time, and one authorized payload. Clients retain a bounded event-ID window, ignore duplicates/old events, detect a sequence gap, and request a snapshot. Events never mutate authoritative client state; the accompanying snapshot/projection does. Private/public variants are emitted separately.

## 16. Reconnect

Transport loss disables actions while keeping safe projection visible. Reconnect -> reauthenticate -> rejoin room/session -> fetch recipient snapshot -> validate version/sequence -> clear stale pending commands -> reset Phase 6/7 queues -> atomically render projection -> restore server timer -> enable eligible action. No presentation backlog is replayed.

## 17. Resynchronization

Triggers: stale command, sequence gap, invalid patch, reconnect, server request, or impossible projection. Only the newest in-flight resync token may commit; older responses are discarded. Pending intents at or below the replaced version are rejected locally, not blindly retried. One concise recovery announcement/animation/audio cue is permitted.

## 18. Host migration

Host is room-administration owner only. Server remains game authority. On loss, preserve the session and choose a connected eligible authenticated human by explicit transfer then longest tenure/seat order; never silently choose a spectator/bot. Emit `room:v1:host-changed`, update permissions, and invalidate stale host commands. If none exists, room policy closes or awaits grace; active game policy is independent.

## 19. Spectator mode

Spectators have explicit read-only membership, capacity, label, reconnect, and optional stream delay. Action submission always rejects. They receive no private hands, deck order, bot reasoning, or timer control. Moon Village defaults to delayed/public-only projection with no live roles; moderator view requires a distinct grant and connection.

## 20. Bot replacement

Server policy defines grace expiration, temporary/permanent replacement, and reclaim window. Replacement invalidates pending human requests, retains the seat identity with a bot-control label, and uses the same engine validation. The bot executes server-side and receives only its authorized projection. Human reclaim requires reauthentication, fresh snapshot, and policy approval; hidden knowledge is never broadened.

## 21. Timeout and disconnect policy

Per-game server configuration owns grace period, turn deadline, auto-pass/draw, bot replacement, removal, forfeit, spectator conversion, and host migration. Offline pause remains local-only. React never calculates penalties. Recommended initial policy: 30-second reconnect grace, game-configured 45-90 second turn, no automatic forfeit until grace/turn policy resolves, and explicit audit events.

## 22. Match completion

Only the authority checks engine completion, increments state version, records final state/result once, emits `game:v1:finished`, rejects later actions, and returns recipient-safe final snapshots. Rematch creates a new session/idempotency namespace. Reward processing is deferred and must be idempotent/durable in Phase 9+.

## 23. Animation integration

Committed recipient-safe events map through Phase 6 adapters using event ID/sequence. Event dedupe happens before enqueue. A newer snapshot calls `clearObsolete`/reconnect reset; snapshots do not synthesize historical movement. Current state may use one compact recovery animation. Animation failure never delays an acknowledgement or interaction eligibility.

## 24. Audio integration

Committed authorized events map through Phase 7 adapters. Duplicate IDs do not replay. Reconnect clears historical SFX and may use one public/system resync caption. Moon private cues require recipient-specific event delivery and never appear in common asset/preload metadata. Audio unlock/failure cannot block gameplay; route cleanup remains provider-owned.

## 25. Per-game integration

- Color Clash: authority owns deck/shuffle/draw, hand projections, legal actions, current color, final-card/challenge timing, and Wild selection expiry. Reconnect discards an unacknowledged picker choice and returns current legal actions.
- Royal Race: authority owns die, legal pieces/path/capture/exact finish/extra turns/ranking. Snapshot places committed pieces directly after interrupted movement.
- Property Empire: authority owns dice, balances, purchase/rent and later auction/trade/mortgage/building/bankruptcy decisions. Deferred rules remain unavailable; reconnect restores the active server decision and deadline.
- Moon Village: full state stays server-side. Public, player-private, team-private, dead-player, spectator, and moderator projections are separate. Night actions, investigations, protections, hidden votes, roles, priority resolution, elimination, and result come only from authorized projections/events.

No common gameplay projection shape is extracted beyond shared envelopes because the four games have materially different privacy and decision models.

## 26. Security requirements

Authenticate handshake and reconnect tokens; authorize room/seat/action/recipient on every operation; derive identity server-side; validate schemas, versions, limits, command type, request collision, and payload size; rate-limit joins/actions/resync; bound queues/logs; reject replay/stale/malformed/flooded traffic; sanitize safe errors; segregate moderator/spectator grants; and filter before serialization. Never trust client dice, balance, winner, timer expiry, legal actions, role visibility, or supplied player ID. Security tests inspect raw JSON—not only rendered DOM.

## 27. Performance requirements

One transport lifecycle per authenticated browser session where appropriate; explicit room/session subscriptions; recipient-only fan-out; bounded payload/event/idempotency/pending windows; jittered bounded reconnect; heartbeat tuned above normal mobile radio churn; projection generation measured per game; no full hidden-state serialization before filtering; large logs paginated. Initial targets: snapshots under 64 KiB, commands under 8 KiB, event batches under 32 items, pending commands under 16, remembered event IDs under 256, reconnect at most 6 attempts in 60 seconds.

## 28. Observability

Structured events: connect/disconnect/reconnect, room join/leave, session creation, action accepted/rejected, stale/duplicate, snapshot sent, sequence gap, projection failure, unauthorized access, replacement, host migration, match finish. Include request/connection/user/room/session IDs and state version where applicable. Redact actions/private payloads, tokens, card IDs not visible publicly, roles, votes, investigations, deck order, and moderation notes. Metrics cover latency, reject codes, payload size, reconnect success, gaps, projection time, and listener count.

## 29. Testing strategy

Unit: request IDs, pending registry, duplicate acknowledgement, stale handling, event dedupe/gaps, snapshot validation, projection filtering, state transitions/retry bounds, cleanup. Integration: room create/join/ready/start, handoff, distinct projections, accepted/rejected/duplicate/stale actions, reconnect snapshot, host migration, spectator rejection, bot replacement, server-confirmed finish, presentation dedupe. Security: spoofed player, opponent hand, Moon role, malformed data, spectator action. Playwright uses two isolated contexts against the development-only mock endpoint and verifies projection separation, versioning, duplicate/stale behavior, reconnect snapshot, and cleanup diagnostics.

## 30. Allowed implementation scope and files

Implement `packages/realtime-core` contracts/state machines/pending/event reconciliation plus a mock-authoritative Color Clash room/session service; web development endpoint `/api/dev/realtime`, diagnostics page `/dev/realtime`, tests, this specification/checkpoint, workspace links, and lockfile. The mock endpoint returns 404 in production and is labelled non-production. No Socket.IO dependency, persistent service, auth, Redis, production matchmaking, voice, payment, moderation system, or existing gameplay migration is allowed.

## 31. Risks and unresolved decisions

Transport/library and deployment topology; production auth/guest identity; durable idempotency store; Redis/room ownership; room expiration/capacity; reconnect grace/turn defaults; host election; spectator delay; bot reclaim; matchmaking acceptance; patch adoption; protocol evolution; moderation grants; Moon dead-player/team policy; final Color Clash call/challenge rules; offline-to-online save policy; horizontal scale and disaster recovery. The in-memory mock loses state on restart and must never be represented as production.

## 32. Phase 9 readiness checklist

Ready after Phase 8 validation: protocol envelopes, authority boundaries, room/session lifecycle, recipient projection rules, version/idempotency semantics, reconnect state machine, presentation dedupe, security/performance/observability requirements, and a bounded executable mock. Not ready without Phase 9 approval: production backend framework, authentication, database schemas, durable room/session/idempotency storage, Redis/pub-sub, deployed Socket.IO, cloud save migration, rewards/payments, moderation persistence, or operations rollout.
