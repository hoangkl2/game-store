# Phase 5B Checkpoint - Royal Race

Status: **READY FOR APPROVAL**  
Date: 2026-08-02  
Scope gate: Phase 5B complete; Phase 5C not started.

## Repository findings

- The monorepo remains pnpm/Turborepo with Next.js 15 App Router, React 19, TypeScript, shared `@game-store/game-core`, design tokens/components, Zustand availability, and the Phase 4 room contracts.
- No reusable board engine, dice engine, timer, zoom/pan, reconnect overlay, or Royal Race engine existed at implementation start. The generic game-core interfaces and Phase 2-5A presentation/session patterns were reused.
- Royal Race remains isolated from the UNO/Color Clash engine. No UNO behavior, production Socket.IO, backend, matchmaking, voice, Property Empire, or Moon Village code was changed or added.
- This workspace has no Git metadata, so file accounting was performed from the scoped implementation rather than `git diff`.

## Deliverables

- Specification: `docs/games/royal-race/phase-5b-ui-ux-specification.md`
- Checkpoint and validation report: `docs/checkpoints/phase-5b-checkpoint.md`
- Pure engine package: `packages/game-royal-race`
- Handoff: `/games/royal-race` -> `/games/royal-race/setup` -> `/games/royal-race/play`
- Playable presets: classic (one human, three bots, four tokens) and quick (one human, one bot, one token), with presentation-speed configuration.

## Files created

- `packages/game-royal-race/package.json`
- `packages/game-royal-race/tsconfig.json`
- `packages/game-royal-race/vitest.config.ts`
- `packages/game-royal-race/src/index.ts`
- `packages/game-royal-race/src/engine.ts`
- `packages/game-royal-race/src/bot.ts`
- `packages/game-royal-race/src/random.ts`
- `packages/game-royal-race/src/storage.ts`
- `packages/game-royal-race/src/__tests__/engine.test.ts`
- `packages/game-royal-race/src/__tests__/rules-and-replay.test.ts`
- `apps/web/src/features/royal-race/types.ts`
- `apps/web/src/app/games/royal-race/setup/page.tsx`
- `apps/web/src/app/games/royal-race/play/page.tsx`
- `apps/web/src/app/games/royal-race/play/loading.tsx`
- `apps/web/src/app/games/royal-race/play/error.tsx`
- `apps/web/tests/royal-race.spec.ts`
- `docs/games/royal-race/phase-5b-ui-ux-specification.md`
- `docs/checkpoints/phase-5b-checkpoint.md`

## Files modified

- `apps/web/package.json` - Royal Race workspace dependency.
- `pnpm-lock.yaml` - workspace package/link resolution.
- `apps/web/src/features/game-catalog/catalog-data.ts` - Royal Race playable status/modes.
- `apps/web/src/app/games/[slug]/page.tsx` - Royal Race setup handoff.
- `apps/web/src/app/globals.css` - scoped committed-token animation with global reduced-motion fallback.

## Engine completion and supported actions

The engine package is complete for the approved offline slice. It is React/NestJS/Zustand independent, uses immutable state transitions and injected randomness, validates initial configuration/actions/snapshots, generates legal actions, serializes versioned state, replays action history, and exposes presentation-safe cell IDs.

Supported rules/actions:

- `ROLL_DICE` and `MOVE_PIECE` with strict active-player/phase/piece validation.
- 2-4 players, 1-4 tokens, 24-cell shared route, player start offsets, four safe cells, four-cell home paths, and exact finish.
- Six-only deployment; engine-generated extra turns for six, capture, and token finish.
- Unsafe capture, safe-cell protection, completed-player turn skipping, complete ranking, and final game result.
- Committed events for roll, no-move, deploy, move/path, capture, safe/home entry, piece/player finish, extra turn, turn change, and game finish.

## Bots, save, replay, and resume

- Bots request only engine-generated legal actions. The Phase 5B heuristic prefers the furthest legal token and uses injected deterministic random tie-breaking.
- Bot speed is presentation-only and never changes authority or legality. Difficulty tiers remain an open product decision.
- IndexedDB saves include game/state versions, serialized domain state, action history, player/bot/rule configuration, timestamps, safe preference metadata, and snapshots of both game and bot random streams.
- Resume rejects unsupported/malformed snapshots, restores random streams, clears temporary UI/animation state, and resumes the committed turn. Playwright validates browser save/resume; package tests validate versioning, strict state parsing, replay, and random restoration.

## UI, responsive, and accessibility status

- Original 24-cell compass perimeter, labelled safe cells, four visible home paths, finish counts, deterministic die display, legal-token controls, engine event log, pause/save/results, and bot-turn lock.
- Player identity combines number, shape word/initial, pattern, text, border, and design-system player color.
- Mobile uses a reachable sticky action bar; tablet/desktop use responsive panels and a capped board.
- Keyboard: native Enter/Space, Tab, arrow cycling among legal tokens, Escape, L, and P. Pause autofocuses Resume, traps Tab/Shift+Tab, and restores Pause focus.
- Live summaries, labelled grid/cells/tokens/home paths, visible focus, 44px targets, high-contrast token inheritance, and reduced-motion event-queue behavior are present.

## Severity audit

Fixed blocker/high findings:

- Ranked players could re-enter normal turn rotation.
- Completing a race could grant a meaningless extra turn to an already ranked player.
- Resume did not preserve the future deterministic random stream.
- Bot scheduling continued behind pause.
- A bot status update raced and hid successful resume feedback.
- Initial deserialization accepted structurally corrupt snapshots too permissively.
- The first board rendering omitted visible home paths and non-color player differentiation.
- Setup did not expose a meaningful bot/preset configuration step.

No blocker or high-severity finding remains.

Tracked medium/low items:

- Shared extraction of board cells, player panels, modal, result panel, timer, zoom/pan, audio, and reconnect overlay should wait for a second board-game consumer.
- Save migration currently fails closed for unsupported versions; no historical Royal Race schema yet requires a migrator.
- Advanced bot difficulty, alternate rules, local pass-and-play, online timeout policy, spectator policy, and richer animation/audio are unresolved product decisions.
- The compact route rerenders its small board after a committed transition; profiling shows no present need for per-cell memoization.

## Exact validation report

Final commands executed from `C:\code\game-store`:

| Command | Result |
| --- | --- |
| `pnpm.cmd typecheck` | PASS - 7/7 workspace packages. |
| `pnpm.cmd lint` | PASS - 7/7 workspace packages. Current repository lint scripts are TypeScript checks. |
| `pnpm.cmd --filter @game-store/game-royal-race test` | PASS - 2 files, 12 tests; 96.98% statements/lines, 84.09% branches, 92.59% functions. |
| `pnpm.cmd --filter @game-store/web test` | PASS - 2 files, 5 frontend tests. |
| `pnpm.cmd test` | PASS - all 7 workspace package tasks, including Royal Race, UNO regression, and frontend tests. |
| `pnpm.cmd build` | PASS - API build and Next.js production build; 11 routes generated, including Royal Race setup/play. |
| `pnpm.cmd exec playwright test` | PASS - 6/6 browser tests, including full Royal Race handoff/save/final-ranking flow and mobile viewport. |

One earlier build attempt encountered a Windows `.next/trace` lock held by a workspace-owned Next dev process. Only the identified workspace processes were stopped; the production build then passed. A concurrent validation attempt also left Vitest workers after the orchestration timeout; those identified validation processes were stopped and every command was rerun sequentially to the passing results above.

## Phase 5C readiness checklist

| Foundation | Readiness |
| --- | --- |
| AppShell, design tokens, responsive utilities | Ready and reused. |
| Game-core contract and deterministic engine/package pattern | Ready. |
| Route detail/setup/game handoff | Ready for reuse as a pattern. |
| Player panels, turn indicator, dice/action presentation | Ready as Royal Race-local patterns; extract only with proven shared props. |
| Bot presentation, pause, save/replay, results, event queue, live announcements | Ready as implementation references. |
| Generic board renderer, timer, zoom/pan, audio adapter, reconnect overlay | Not generalized; design explicitly in Phase 5C if required. |
| Phase 4 room/server authority contracts | Ready by reference; no production transport exists. |

## Approval gate

Phase 5B is complete and stopped at this checkpoint. Explicit approval is required before **Phase 5C - Property Empire UI/UX** begins.
