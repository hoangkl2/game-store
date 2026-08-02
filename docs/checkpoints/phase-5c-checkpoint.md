# Phase 5C Checkpoint - Property Empire

Status: **READY FOR APPROVAL**  
Date: 2026-08-02  
Scope gate: Phase 5C complete; Phase 5D not started.

## Repository findings

- The approved pnpm/Turborepo architecture remains intact: Next.js 15 App Router, React 19, strict TypeScript, shared `@game-store/game-core`, Phase 2 design tokens/components, and the approved Phase 4 and Phase 5B contracts.
- No Property Empire engine or prototype existed at implementation start. No stable generic board, timer, zoom/pan, audio, or reconnect API existed either.
- Shared extraction was evaluated against Royal Race and Property Empire. Their concrete board geometry, action phases, presentation events, and accessibility controls differ enough that generalizing those systems now would be premature. Only stable app shell, token, game-core, route, persistence, and accessibility patterns were reused.
- This workspace has no Git metadata, so file accounting was performed from the scoped implementation rather than `git diff`.
- No production backend, Socket.IO implementation, matchmaking, commerce, Phase 5D, or copyrighted Monopoly material was added.

## Deliverables

- Specification: `docs/games/property-empire/phase-5c-ui-ux-specification.md`
- Checkpoint and validation report: `docs/checkpoints/phase-5c-checkpoint.md`
- Pure TypeScript engine package: `packages/game-property-empire`
- Route handoff: `/games/property-empire` -> `/games/property-empire/setup` -> `/games/property-empire/play`
- Playable presets: standard four-player/60-turn match and quick two-player/10-turn match, with bot difficulty and presentation-speed configuration.

## Files created

- `packages/game-property-empire/package.json`
- `packages/game-property-empire/tsconfig.json`
- `packages/game-property-empire/vitest.config.ts`
- `packages/game-property-empire/src/index.ts`
- `packages/game-property-empire/src/board.ts`
- `packages/game-property-empire/src/engine.ts`
- `packages/game-property-empire/src/bot.ts`
- `packages/game-property-empire/src/random.ts`
- `packages/game-property-empire/src/storage.ts`
- `packages/game-property-empire/src/__tests__/engine.test.ts`
- `packages/game-property-empire/src/__tests__/bot-save-replay.test.ts`
- `apps/web/src/features/property-empire/types.ts`
- `apps/web/src/features/property-empire/components.tsx`
- `apps/web/src/features/property-empire/components.test.tsx`
- `apps/web/src/app/games/property-empire/setup/page.tsx`
- `apps/web/src/app/games/property-empire/play/page.tsx`
- `apps/web/src/app/games/property-empire/play/loading.tsx`
- `apps/web/src/app/games/property-empire/play/error.tsx`
- `apps/web/tests/property-empire.spec.ts`
- `docs/games/property-empire/phase-5c-ui-ux-specification.md`
- `docs/checkpoints/phase-5c-checkpoint.md`

## Files modified

- `apps/web/package.json` - Property Empire workspace dependency.
- `pnpm-lock.yaml` - workspace package/link resolution.
- `apps/web/src/features/game-catalog/catalog-data.ts` - truthful playable status and supported mode.
- `apps/web/src/app/games/[slug]/page.tsx` - Property Empire setup handoff.
- `apps/web/src/app/globals.css` - scoped Property Empire presentation tokens and reduced-motion behavior.
- `apps/web/src/app/games/royal-race/play/page.tsx` - minimal compatibility fix that keeps the successful resume notice visible when a bot status update follows it; no Royal Race engine behavior changed.

## Engine completion and supported rules

The engine is complete for the approved offline vertical slice. It has no React, Zustand, or NestJS dependency. It uses immutable transitions, injected deterministic randomness, strict action/state validation, engine-generated legal actions, versioned serialization, replay, and random-stream restoration.

Supported rules and actions:

- `ROLL_DICE`, `BUY_PROPERTY`, `DECLINE_PROPERTY`, and `END_TURN`, with phase, actor, affordability, ownership, and stale-decision validation.
- Two deterministic dice, a 20-tile serpentine board, pass-start salary, property offers, purchases, ownership, rent, tax, original event effects, Transit Hold, bankruptcy, turn advancement, maximum-turn ranking, net worth, and winner determination.
- Original Property Empire names and concepts, including Founders' Gate, Copper Quay, Kiteworks Yard, Juniper Arcade, Mosslight Market, Lantern Row, Emberline Studios, Tideglass Labs, River Commons, Northstar Foundry, Meridian Exchange, Market Signal, and Civic Dispatch.
- Multi-player bankruptcy safely removes the bankrupt active player from rotation and either advances to a valid player or completes the game.
- Economic rules remain entirely in the engine; React consumes state, legal actions, derived finances, and committed events.

## Explicit advanced-system status

The specification defines intended UX and authority boundaries for auctions, trades, mortgages, buildings, Transit Hold choices, debt recovery, creditor transfer, and advanced bankruptcy. These systems are **documented but deferred** and are not labelled or presented as implemented.

The playable slice deliberately excludes:

- Competitive auctions and timed bidding.
- Player-to-player trade offers, expiry, counteroffers, and visibility rules.
- Mortgage interest, unmortgage, building supply, even-building constraints, and improvement selling.
- Advanced hold-release choices, debt liquidation, creditor asset transfer, and negotiated recovery.
- Local pass-and-play, online rooms, spectators, reconnect transport, rewards, and production economy services.

## Bots, save, replay, and resume

- EASY, NORMAL, and HARD bots choose only engine-generated legal actions. Their purchase scoring differs by reserve, yield, color-group potential, and game phase; deterministic random tie-breaking is injected.
- Bot speed is presentation-only and never changes legality or outcomes.
- IndexedDB saves contain explicit game/save/board versions, serialized domain state, action history, setup preferences, timestamps, and game/bot random snapshots.
- Resume fails closed for malformed or unsupported snapshots, restores both random streams, resets transient UI/animation state, and creates a fresh automatic save after the next committed transition.
- Package tests cover replay, strict deserialization, version rejection, and deterministic continuation after random restoration.

## State-boundary status

- `PropertyEmpireDomainState` owns authoritative offline rules, balances, positions, ownership, offers, turn phase, rank, and committed events.
- `PropertyEmpireUIState` owns selection, tile details, dialogs, pause state, notices, and focus intent.
- Animation queue, audio preferences, offline session/save metadata, Phase 4 `RoomState`, and realtime connection state remain separate.
- The offline client may invoke the pure engine locally. Future online clients must consume server-authoritative actions and snapshots; they must not calculate dice, legality, economic transfers, turn changes, or winners.

## Route, responsive, and accessibility status

- Game detail, setup, play, save/resume, results, and return flows are integrated.
- The board is an original responsive 4x5 serpentine route with engine-supplied tile data and financial summaries.
- Mobile uses readable board cells and reachable actions; larger layouts expose board, status, player finances, tile details, decisions, and transaction history without changing domain behavior.
- Keyboard support includes native Enter/Space, arrow-key tile navigation, Escape, and pause controls. Pause traps focus, autofocuses Resume, and restores focus when closed.
- Live status announcements, labelled board cells, non-color player identifiers, visible focus, disabled/loading behavior, high-contrast support, reduced-motion event commits, and minimum touch targets are covered.

## Severity audit

Fixed blocker/high findings:

- A bankrupt active player could deadlock a match with more than two players.
- Deserialization initially accepted structurally incomplete or corrupt snapshots too permissively.
- The legal-action generator could expose an unaffordable purchase and stale purchase decisions were insufficiently guarded.
- UI actions could overtake an uncommitted presentation event; actions are now gated until the event queue commits.
- Resume could lose deterministic future random behavior without both random snapshots.
- A Royal Race bot status update could hide the successful resume notice during the full regression flow; the notice was made persistent without changing engine behavior.
- Catalog/setup copy could overstate unavailable advanced modes; supported mode and deferrals are now explicit.

No blocker or high-severity issue remains.

Tracked medium/low items:

- Unsupported historical save versions fail closed. No migration chain is needed until a second schema exists.
- Advanced auction, trade, mortgage, building, debt, hold, local-play, and online authority decisions remain open.
- Mobile board density remains a usability watch item, though cells, labels, focus, and touch controls passed the implemented viewport audit.
- Generic board, timer, zoom/pan, audio, and reconnect components remain intentionally unextracted until another concrete consumer proves stable shared APIs.

## Exact validation report

Final commands executed from `C:\code\game-store`:

| Command | Result |
| --- | --- |
| `pnpm.cmd typecheck` | PASS - 8/8 workspace packages. |
| `pnpm.cmd lint` | PASS - 8/8 workspace packages. Current repository lint scripts are TypeScript checks. |
| `pnpm.cmd --filter @game-store/game-property-empire test` | PASS - 2 files, 14 tests; 94.47% statements/lines, 79.13% branches, 97.22% functions. |
| `pnpm.cmd --filter @game-store/web test` | PASS - 3 files, 7 frontend tests. |
| `pnpm.cmd test` | PASS - all 8 workspace tasks, including Property Empire, Royal Race, UNO regression, and frontend tests. |
| `pnpm.cmd build` | PASS - API build and Next.js production build; 13 routes generated, including Property Empire setup/play. |
| `pnpm.cmd exec playwright test` | PASS - 8/8 browser tests, including Property Empire handoff, keyboard interaction, purchase, save/resume, final result, mobile reduced-motion, and forced-colors coverage. |

The final Playwright regression run followed a minimal Royal Race compatibility fix for a resume-notice race and passed all eight tests. Temporary visual-audit screenshots were removed after desktop and mobile inspection.

## Unresolved product decisions and risks

- Auction authority, bidding timer, minimum increments, ties, bot bidding, and disconnect behavior.
- Trade visibility, expiry, counteroffer limits, simultaneous offers, and offline/online bot acceptance models.
- Mortgage interest and repayment rules; building costs, supply, even-building policy, and sell-back values.
- Debt-resolution ordering, liquidation UX, creditor transfer, and bankruptcy termination rules.
- Transit Hold choices, release costs, maximum duration, and card interactions.
- Final economy balancing, match-duration targets, difficulty calibration, and event-card distribution.
- Local pass-and-play privacy, future server-authoritative room policies, spectator redaction, reconnect, and resynchronization behavior.

The primary residual risk is that the intentionally small economic slice is not yet representative of the strategic depth of the future advanced systems. The UI identifies those systems as unavailable; it does not imply completeness.

## Phase 5D readiness checklist

| Foundation | Readiness |
| --- | --- |
| Phase 5C specification, engine, offline route, save/resume, bots, tests | Ready. |
| App shell, design tokens, game-core contract, route/setup pattern | Ready for reuse where APIs are stable. |
| Concrete comparison of Royal Race and Property Empire board requirements | Complete; no premature board abstraction recommended. |
| Generic board/timer/zoom/audio/reconnect components | Not generalized; reassess only against concrete Phase 5D requirements. |
| Production room transport, matchmaking, backend authority | Out of scope and not implemented. |
| Phase 5D files or features | Not started. |

## Approval gate

Phase 5C is complete and stopped at this checkpoint. Explicit approval is required before **Phase 5D** begins.
