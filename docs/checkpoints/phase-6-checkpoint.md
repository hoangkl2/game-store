# Phase 6 Checkpoint - Animation System

Status: **READY FOR APPROVAL**  
Date: 2026-08-02  
Scope gate: Phase 6 complete; Phase 7 not started.

## Repository findings

- Approved Phase 1-5D specifications and checkpoints were reviewed, including the Phase 5D privacy boundary and validation report.
- The workspace had semantic CSS duration/easing tokens, Royal Race and Property Empire local keyframes, and per-game `setTimeout` presentation queues. It had no shared animation queue, common event adapter, animation provider, page-transition primitive, Framer Motion dependency, or audio system.
- Framer Motion usage is absent. It is documented as a future optional tool for complex presence transitions; no dependency was added in this phase.
- Existing game engines, game rules, room contracts, audio state types, realtime behavior, and Moon Village projection rules were preserved.

## Deliverables

- Specification: `docs/design-system/phase-6-animation-specification.md`
- Checkpoint and validation report: `docs/checkpoints/phase-6-checkpoint.md`
- Pure deterministic queue package: `packages/animation-core`
- Web motion provider, preferences, adapters, CSS-safe primitives, and development-only preview: `/dev/animation`

## Files created

- `packages/animation-core/package.json`
- `packages/animation-core/tsconfig.json`
- `packages/animation-core/vitest.config.ts`
- `packages/animation-core/src/index.ts`
- `packages/animation-core/src/tokens.ts`
- `packages/animation-core/src/queue.ts`
- `packages/animation-core/src/__tests__/queue.test.ts`
- `apps/web/src/features/animation/provider.tsx`
- `apps/web/src/features/animation/adapters.ts`
- `apps/web/src/features/animation/primitives.tsx`
- `apps/web/src/features/animation/adapters.test.ts`
- `apps/web/src/features/animation/provider.test.tsx`
- `apps/web/src/app/dev/animation/page.tsx`
- `apps/web/src/app/dev/animation/preview.tsx`
- `apps/web/tests/animation.spec.ts`
- `docs/design-system/phase-6-animation-specification.md`
- `docs/checkpoints/phase-6-checkpoint.md`

## Files modified

- `apps/web/package.json` - `@game-store/animation-core` workspace dependency.
- `pnpm-lock.yaml` - workspace link resolution.
- `apps/web/src/app/layout.tsx` - animation provider registration beside the existing theme provider.
- `apps/web/src/app/globals.css` - motion-token exposure and transform/opacity-only page, presence, and celebration primitives.
- `packages/ui/src/styles.css` - instant/cinematic/celebration duration and spring easing tokens.
- `apps/web/tests/property-empire.spec.ts` - explicit setup-to-play navigation wait, fixing a parallel browser-test race without changing gameplay.

## Animation foundation implemented

- `AnimationCommand` with ID, safe source event/sequence, payload, priority, blocking/skippable flags, duration, group, and creation metadata.
- Immutable snapshot/subscription queue with deterministic insertion order and parallel groups.
- Enqueue/enqueueMany, group replacement/cancellation, per-command completion, pause/resume, skip, fast-forward, obsolete-sequence clearing, reconnect reset, visibility handling, and critical-only input blocking.
- Motion durations: instant, fast, standard, deliberate, cinematic, and celebration; easing tokens: standard, enter, exit, emphasized, spring-soft, and spring-snappy.
- OFF/FAST/NORMAL/SLOW speed preference plus system, persisted application, and disposable session reduced-motion override.
- Hidden-tab decoration removal/pause and safe restart of commands queued while hidden.
- CSS-safe `PageTransition`, `PresenceTransition`, `MotionSafe`, `ReducedMotionFallback`, `GameEventTransition`, `CelebrationLayer`, and `ConnectionTransition` primitives.
- Development-only `/dev/animation` preview. It is explicitly unavailable in production and contains no game authority or audio control.

## Game mappings completed

One public, committed-event mapping is implemented and tested for each game:

- Color Clash: `CARD_PLAYED` -> safe discard command.
- Royal Race: `PIECE_MOVED` and committed `DICE_ROLLED` -> token/dice commands.
- Property Empire: `TOKEN_MOVED` and public event-card reveal -> board/ledger commands.
- Moon Village: public `DAY_ANNOUNCEMENT` or post-game public projection -> day/result command only.

Moon Village adapters accept `MoonVillagePublicProjection`, not `MoonVillageDomainState` or private event types. Tests verify command payloads never contain role, target, or investigation data.

The full per-game animation catalog, room behavior, victory/reward behavior, reconnect handling, and deferred advanced Property Empire actions are defined in the specification. No existing game route was migrated to the foundation in this phase, avoiding a behavior-changing refactor.

## Accessibility, performance, reconnect, and privacy review

- Reduced motion preserves commands' critical placement/status, removes decoration, and offers a content fallback. Speed OFF does not hide critical state changes.
- Motion primitives preserve focus ownership; no route transition delays navigation or captures focus. Native controls remain keyboard operable and preview controls have visible focus/labels.
- CSS motion uses explicit transform/opacity properties and contains no `transition: all`. No large blur, particle system, canvas, WebGL, audio, or copied animation asset was introduced.
- Queue animation does not mutate domain input. It is ephemeral, excluded from saves, and never restores in-progress progress as authority.
- Reconnect cancels queued work and expects one compact recovery/snapshot placement command; it does not replay historical animations.
- Moon Village mapping is public-projection-only. No hidden role data is passed to commands, preload lists, animation DOM, or queue state.

## Severity audit

Fixed blocker/high findings:

- A parallel group implementation discarded later commands after completing the group; the queue now retains and resumes later commands deterministically.
- A browser without `matchMedia` crashed the provider test/runtime fallback; the provider now safely assumes no system reduction when the API is absent.
- Commands enqueued while a tab was hidden could remain idle after return; visibility restoration now pumps them safely.
- A full browser regression exposed a Property Empire setup-to-play navigation race; the test now waits for the concrete destination URL.

No blocker or high-severity issue remains.

Tracked medium/low items:

- App-wide route transition interception remains deferred until navigation and focus ownership are standardized.
- Framer Motion adoption, low-performance detection policy, and production particle/celebration direction need future product/performance decisions.
- Real server event-sequence policy, room coalescing, reconnect snapshot transport, and advanced Property Empire animation mappings depend on future online/advanced-rule phases.
- No per-game route has yet consumed the shared queue; existing local queues remain stable references until a migration is justified by a concrete rollout plan.

## Exact validation report

Final commands executed from `C:\code\game-store`:

| Command | Result |
| --- | --- |
| `pnpm.cmd typecheck` | PASS - 10/10 workspace packages. |
| `pnpm.cmd lint` | PASS - 10/10 workspace packages. Repository lint scripts run strict TypeScript checks. |
| `pnpm.cmd --filter @game-store/animation-core test` | PASS - 1 file, 5 tests; 95.45% statements/lines, 87.65% branches, 89.28% functions. |
| `pnpm.cmd --filter @game-store/web test` | PASS - 6 files, 13 frontend tests. |
| `pnpm.cmd test` | PASS - all 10 workspace tasks, including all game regressions and the animation queue/provider/adapters. |
| `pnpm.cmd build` | PASS - API and Next.js production build; 16 routes generated, including development animation preview. |
| `pnpm.cmd exec playwright test` | PASS - 11/11 browser tests, including queue/reduced-motion/reconnect preview and all existing game, room, and design-system flows. |

## Phase 7 readiness checklist

| Foundation | Readiness |
| --- | --- |
| Motion token ownership and CSS fallbacks | Ready. |
| Deterministic command lifecycle, cancellation, reconnect reset, hidden-tab handling | Ready. |
| Application/session preference and reduced-motion behavior | Ready. |
| Public event adapter boundary and Moon Village secret-safety test | Ready. |
| Shared queue rollout into individual game routes | Deliberately deferred; migrate only with per-game verification. |
| Audio playback, sound settings, caption mapping, assets, or mixing | Not started. |
| Phase 7 files or features | Not started. |

## Approval gate

Phase 6 is complete and stopped at this checkpoint. Explicit approval is required before **Phase 7 - Audio System** begins.
