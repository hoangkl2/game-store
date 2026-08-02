# Game Store — Phase 0 architecture

## Scope and assumptions

Phase 0 defines boundaries and contracts; it does not implement UNO or any other game. The first production slice is browser-local offline play. The API and database are prepared for accounts, persistence, statistics, and a later server-authoritative multiplayer mode. Game rules remain framework-independent and are shared by browser, bot, replay, and server validation code.

Assumptions to validate before Phase 1:

- pnpm workspaces and Turborepo are the repository orchestration layer.
- `game-core` owns generic contracts and deterministic primitives; each game package owns its rules.
- IndexedDB is the source of truth for an offline session; the API is not required to start or resume offline games.
- IDs are opaque strings, timestamps are ISO strings at package boundaries, and serialized payloads are versioned envelopes.

## Final monorepo

```text
apps/web                 Next.js App Router, offline UX, Dexie adapter
apps/api                 NestJS HTTP/WebSocket boundary, auth, persistence
packages/game-core       framework-free engine, bot, replay, save contracts
packages/game-uno        UNO rules and bots
packages/game-ludo       Ludo rules and bots
packages/game-monopoly   Monopoly-like rules and bots
packages/game-werewolf   Werewolf rules, information views, and bots
packages/shared-types    transport/API/domain DTO types and stable enums
packages/ui              accessible Tailwind/shadcn-compatible primitives
packages/eslint-config   shared lint presets
packages/tsconfig        shared TypeScript presets
docs                     architecture, ADRs, rule decisions, operations
```

Dependency rule: game packages may depend on `game-core` and `shared-types`; `game-core` depends on no application/UI framework. Apps may depend on packages, never the reverse. UI components receive state and callbacks; animation cannot alter game state.

## Shared game-engine contracts

The canonical contracts are in `packages/game-core/src/index.ts`. Every game supplies `GameEngine<TState, TAction, TEvent, TRuleConfig>` with immutable reducer transitions, validation, legal-action generation, game-over detection, serialization, and deserialization. `GameTransition` returns the next state plus an event list and does not mutate its input.

Randomness is injected through `RandomProvider`: production uses `MathRandomProvider`, while tests/replays use `SeededRandomProvider` or `MockRandomProvider`. A replay records the initial serialized state, ordered actions, random seed/provider metadata, and engine version. Replays must be deterministic or explicitly reject incompatible versions.

Saved games use a versioned envelope: `{ schemaVersion, gameType, gameVersion, stateVersion, state, actionHistory, createdAt, updatedAt }`. Migrations are pure functions from one state version to the next. Invalid JSON, unknown game versions, and failed migrations go through recovery: preserve the raw record, mark it corrupted, and offer export/delete rather than silently changing state.

## Offline save architecture

The web app will use a Dexie database with tables for `savedGames`, `actionHistory`, `settings`, `playerProfile`, `recentGames`, and `unlockedCosmetics`. The game room writes an action only after engine validation and reducer success, then schedules a debounced snapshot/autosave. Writes are idempotent by saved-game ID plus action sequence. Resume loads the latest snapshot, validates the envelope, migrates it, and replays any unapplied actions. Import/export uses a bounded JSON file format with checksum/shape validation; no imported result is trusted without replaying it through the engine.

## Bot architecture

`GameBot<TState, TAction>` receives state and player ID, asks the engine for valid actions, scores only that set, applies configured difficulty/personality randomness, and returns one legal action. The bot package must never call a reducer mutably or bypass validation. Thinking delay is a presentation concern. Difficulty controls lookahead/heuristics; personality weights behavior. Bot decisions should optionally emit a structured decision trace for testing and diagnostics, never player-private data to the UI.

## Database plan

Prisma models: `User`, `Game`, `GameSession`, `GamePlayer`, `GameAction`, `GameResult`, `SavedGame`, `BotProfile`, `UserGameStat`, `Achievement`, `UserAchievement`, `CosmeticItem`, and `UserInventory`.

Frequently queried fields are typed columns: ownership, game type, status, sequence number, timestamps, and foreign keys. JSON is reserved for serialized state, replay payloads, configuration snapshots, and structured metadata. Use UUID/string IDs, composite uniqueness for membership and sequence, cascading rules only where lifecycle is clear, indexes on owner/status/game/timestamps, and optimistic sequence/state-version checks for future multiplayer. `SavedGame` is user-owned and may also carry an anonymous device key for offline sync design; sync policy requires a later decision.

## API module plan

Initial NestJS modules: `AuthModule`, `UsersModule`, `GamesModule`, `GameSessionsModule`, `SavedGamesModule`, `GameStatisticsModule`, `AchievementsModule`, `InventoryModule`, `BotProfilesModule`, and `MatchHistoryModule`. Cross-cutting infrastructure includes configuration/environment validation, Prisma, request logging, response envelope, global exception filter, validation pipe, security headers, rate limiting, JWT/refresh rotation, and Swagger.

Future modules: `GameRoomsModule`, `MatchmakingModule`, `RealtimeGameModule`, and `LeaderboardModule`. Multiplayer will be server-authoritative: action → authorization/idempotency/sequence checks → engine validation/reduction → persistence/snapshot → broadcast. WebSocket events are `room:create`, `room:join`, `room:leave`, `room:ready`, `game:start`, `game:action`, `game:state-updated`, `game:player-disconnected`, `game:player-reconnected`, and `game:finished`.

## Frontend route plan

`/` Home; `/games` catalog; `/games/[gameType]` details; `/games/[gameType]/setup` setup; `/play/[gameType]/[sessionId]` offline room; `/saved-games`; `/history`; `/profile`; `/statistics`; `/settings`; `/achievements`; `/inventory`.

The web app owns routing, Zustand session orchestration, React Hook Form/Zod setup validation, Dexie persistence, accessibility, responsive layouts, and visual animation. It does not own game rules.

## Testing strategy

Game engines are the highest priority: unit tests for every rule branch, invalid-action tests, seeded replay identity, serialization/migration tests, bot legality tests, and property-based invariants (no duplicate cards, conservation of pieces/cards, legal turn ownership, terminal states). Targets are ≥90% engine, ≥80% backend services, and ≥70% critical frontend flows. Playwright covers catalog → setup → play → bot turn → pause/reload/resume → finish/result. CI runs format check, lint, typecheck, unit tests, and browser tests with PostgreSQL service coverage when API tests exist.

## Phased roadmap

0. Architecture, contracts, scaffold, review gate (current).
1. UNO vertical slice: engine, deterministic bots, web room, IndexedDB save/resume, tests.
2. Shared platform shell: catalog/details/setup, profile/settings/history/statistics foundations.
3. Ludo engine, bots, room, persistence, tests.
4. Monopoly-like engine, bots, room, persistence, tests.
5. Werewolf engine, hidden-information views, suspicion model, template dialogue, tests.
6. API accounts, Prisma persistence, auth, saved-game/statistics synchronization.
7. Server-authoritative online foundation: rooms, Socket.IO events, reconnect/idempotency, anti-cheat controls.
8. Hardening: observability, performance, security review, accessibility audit, deployment and scaling.

## Risks and unresolved rule decisions

- Rule variants must be explicitly versioned per game; decide UNO stacking, seven-zero, jump-in, challenge rules, and initial hand size.
- Decide Ludo board variant, player count, starting positions, capture semantics, and block rules.
- Decide Monopoly board layout, currency, event deck, bankruptcy resolution, and whether free parking has a reward.
- Decide Werewolf role counts by player count, witch potion limits, hunter timing, guard self-protection, tie behavior, and private-information UI.
- IndexedDB corruption, browser quota limits, multiple tabs, and interrupted writes require recovery and locking tests.
- Seeded randomness is reproducible only when all random calls are centralized and versioned.
- Online sync introduces conflict resolution, reconnect identity, cheating, rate limits, and horizontal scaling concerns.
- Accessibility and responsive board/card layouts need dedicated usability validation.

## Implementation checklist

- [x] Define monorepo and dependency boundaries.
- [x] Define generic engine, randomness, replay, save, and bot contracts.
- [x] Define offline IndexedDB ownership and recovery strategy.
- [x] Define database and API module plans.
- [x] Define routes and testing strategy.
- [x] Define roadmap and rule-decision risks.
- [x] Scaffold the five Phase 0 workspaces.
- [ ] Review and approve shared contracts before UNO.
- [ ] Add package manager dependencies and CI in the next implementation slice.
- [ ] Implement UNO only after approval.
