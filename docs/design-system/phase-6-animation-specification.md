# Phase 6 - Animation System Specification

Status: implementation specification  
Scope: reusable motion foundation and one safe mapping per approved game; no audio, rules, or Phase 7 work.

## 1. Repository fit and principles

This document extends the approved Phase 1 state boundaries, Phase 2 tokens/accessibility, Phase 4 authority/reconnect model, and Phase 5A-5D event-driven game patterns by reference. The repository currently has CSS duration/easing tokens, two game-local CSS keyframes, and per-game `setTimeout` queues. It has no Framer Motion dependency, common queue, page transition, or event adapter.

Principles:

1. Domain state commits before an animation command is created.
2. Commands visualize committed public or viewer-authorized events only; they never choose outcomes, mutate domain state, or determine legality.
3. Critical feedback is immediate; decorative motion is skippable and never blocks input.
4. Latest authority wins on reconnect. Never replay a historical animation backlog.
5. Reduced motion preserves status, icons, focus, and readable result changes.
6. Queue interruption, tab hiding, navigation, and cancellation are normal paths, not errors.
7. Motion uses transforms and opacity where practical, has no `transition: all`, and never causes layout shift, focus theft, flashing, or secret leakage.

## 2. Motion-token system

| Token | CSS variable | Normal duration | Purpose |
| --- | --- | ---: | --- |
| instant | `--duration-instant` | 0-80ms | state placement and reduced motion |
| fast | `--duration-fast` | 100-160ms | press, small feedback, toasts |
| standard | `--duration-standard` | 180-260ms | cards, dialogs, token arrival |
| deliberate | `--duration-deliberate` | 300-500ms | board movement and drawers |
| cinematic | `--duration-cinematic` | 600-1000ms | route/result framing, never required |
| celebration | `--duration-celebration` | 900-1800ms | skippable results only |

Easings: `standard`, `enter`, `exit`, `emphasized`, `spring-soft`, and `spring-snappy`. The existing `--ease-spring` aliases `spring-soft`; `spring-snappy` is for short selection feedback only. All tokens resolve to instant when reduced motion or speed OFF applies to noncritical movement.

## 3. State boundaries and command contract

`DomainGameState` owns authoritative rules and emitted events. `GameUIState` owns selections/dialogs. `AnimationState` owns only disposable commands, status, speed, reduced-motion/low-performance preference, and tab visibility. `AudioState`, `RoomState`, and `RealtimeConnectionState` remain independent.

```ts
type AnimationCommand = {
  id: string;
  type: string;
  sourceEventId: string;
  sourceEventSequence?: number;
  payload: Record<string, unknown>;
  priority: "CRITICAL" | "NORMAL" | "DECORATIVE";
  blocking: boolean;
  skippable: boolean;
  durationMs: number;
  groupId?: string;
  createdAt: number;
};
```

Commands contain presentation-safe payloads only. They are not trusted save data. Current progress is never restored after reload; a resume starts from the committed snapshot with a concise placement/recovery command.

## 4. Shared queue and interruption behavior

The pure queue preserves insertion order between groups and plays commands sharing the leading `groupId` in parallel. It supports enqueue/enqueueMany, pause/resume, completion subscription, skip current, fast-forward skippable work, group cancellation, obsolete-sequence clearing, and reconnect reset.

- Only a CRITICAL command with `blocking: true` may block the relevant local control; NORMAL work should use an input lock already justified by the UI state, and DECORATIVE work is coerced nonblocking.
- Replacing a group cancels its active/queued commands before enqueuing its replacement.
- Fast-forward finishes current skippable work and removes queued skippable/DECORATIVE work. Critical state remains visibly placed.
- Hidden tabs pause active normal work, remove decorative work, and resume from the same committed command only when visible.
- Route exit, dialog close, and unmount cancel their group. Completion listeners fire exactly once per completed command, not for cancellation.

## 5. Reduced motion, speed, and performance

System `prefers-reduced-motion`, an application preference, and a session override resolve to one effective mode. Speed options are `OFF`, `FAST`, `NORMAL`, and `SLOW`; they change client presentation only, never engine/server timers.

| Effective mode | Critical | Normal | Decorative |
| --- | --- | --- | --- |
| OFF/reduced | instant placement + status | instant/fade | omitted |
| FAST | short readable transform/fade | 55% duration | omitted if queued |
| NORMAL | token duration | token duration | capped |
| SLOW | readable capped duration | up to 1.5x | normal cap |

Use transform/opacity, lazy-load game-specific effects, cap concurrent decorative effects at three, avoid large blur/filter on low-performance mode, and pause decoration in hidden tabs. Target approximately 60 FPS; failure to meet it degrades to opacity/instant placement rather than delaying interaction.

## 6. Page, shared UI, and room patterns

Page transitions are 120-200ms opacity/translate enter transitions with no delayed navigation, no layout shift, and focus restored by the route/dialog owner. Defined journeys: route enter/exit, auth-to-app, library-detail, detail-room, room-game, game-results, rematch, settings, and system recovery. Current implementation provides a CSS-safe `PageTransition` primitive and preview; app-wide route interception is deferred until navigation/focus ownership is standardized.

Shared UI patterns: button press/loading, card hover/selection, dialog/drawer/bottom sheet, tooltip, toast, dropdown, tabs, segmented controls, skeleton/progress, badge/avatar/connection update, invalid action, and success. All have an instant text/icon fallback.

Room patterns: join/leave, bot add/remove, ready/host/settings change, invitation acceptance, full/closed, game start, and reconnect. Rapid room events are coalesced by room group; the latest seat/ready snapshot wins. No mocked room animation is represented as production realtime behavior.

## 7. Domain-event mappings

Adapters accept already safe events/projections and return commands. They do not call reducers or receive full Moon Village domain state.

| Game | Implemented example mapping | Source event | Result / recovery |
| --- | --- | --- | --- |
| Color Clash | `CARD_PLAYED` | committed UNO event | card scales/fades to discard; instant card placement on reduced/reconnect |
| Royal Race | `TOKEN_MOVED` | committed race event | token transform arrival; place at authoritative cell on recovery |
| Property Empire | `TOKEN_MOVED` | committed economic event | token arrival plus nonblocking tile cue; authoritative board placement on recovery |
| Moon Village | `DAY_ANNOUNCEMENT` | public/player projection phase only | safe mist-to-day/status transition; no role, target, vote, or investigation payload |

The complete game design mapping follows. Every noncritical item is skippable, and reconnect cancels it in favor of the latest visible snapshot.

### Color Clash

Initial deal: committed setup -> parallel dealt cards, 300ms deliberate, nonblocking, instant stacked hand when reduced. Draw/multi-card penalty: committed draw event -> cards appear, 180ms standard, relevant draw control remains locked by domain/UI state, compact count on reconnect. Card play: `CARD_PLAYED` -> discard transform, 200ms standard, relevant action lock only, instant placement reduced. Invalid card: rejected UI action -> 120ms fast border/status, nonblocking, no reconnect replay. Skip/reverse/color change/draw-two/draw-four/final-call/challenge/turn change: committed public event -> badge/discard/status update, 100-200ms, nonblocking except existing decision UI. Bot thinking: disposable loop/status, decorative/nonblocking. Victory/defeat: committed finish -> skippable 900ms celebration/result panel. Reconnect: cancel queue and show latest hand counts/discard only.

### Royal Race

Dice roll/settle: `DICE_ROLLED` -> display committed faces, 180ms standard, no fabricated interim value, input lock remains engine-derived. Deployment/token movement/capture/return/safe-zone/home-path/finish: committed event -> transform to committed cell, 200-450ms deliberate, relevant piece controls wait for existing UI lock, reduced uses highlight/status. Extra turn/turn change/ranking/victory: committed event -> badge/list update, 100-900ms and skippable after result. Invalid move is fast status only. Reconnect places tokens/ranking directly from snapshot.

### Property Empire

Dice/token/tile arrival: committed values/events -> transform/arrival cue, 180-400ms, readable finance text remains visible. Purchase/ownership/rent: committed event -> card/owner/balance update, 150-260ms, no particles. Auction, trade, mortgage, unmortgage, building, and advanced jail are defined future mappings only because those rule systems are deferred. Event-card reveal, bankruptcy, turn, victory: committed event -> card/status/ledger update, standard-deliberate, skippable result sequence. Reconnect replaces the board/finance ledger from the snapshot.

### Moon Village

Role reveal: authorized private projection -> covered seal reveal, 180ms standard, local viewer only. Night/day transition/discussion/timer warning/vote selection/vote lock/elimination/system announcement/victory/defeat -> public or authorized projection -> status/opacity/placement, 100-500ms. Protection/investigation/role action execute only in the authorized recipient's animation tree and never preload another role’s asset, target label, timing signal, DOM node, or command payload. Reconnect cancels all role/night work and renders the latest recipient projection; no historical night animation replays.

## 8. Victory, reconnect, and recovery

Victory/defeat/reward presentation starts only from a committed result/reward event, displays outcome text before decoration, supports Skip, and remains accessible without celebration motion. Rewards are future-facing; no economy/reward system is implemented here.

On reconnect: disable authoritative intent submission, preserve safe visible state, cancel obsolete commands, fetch/apply the newest authority snapshot, discard historical queue entries, enqueue one `RECOVERY_SNAPSHOT_APPLIED` command, announce resynchronization, then re-enable eligible interaction. Recovery never waits for motion.

## 9. Component and utility architecture

`@game-store/animation-core` is a pure TypeScript command/queue/token package. Web-local modules provide `AnimationProvider`, `AnimationQueueProvider` alias, `useAnimationQueue`, `useReducedMotionPreference`, `useAnimationSpeed`, `DomainEventAnimationAdapter`, `PageTransition`, `PresenceTransition`, `GameEventTransition`, `CelebrationLayer`, `ConnectionTransition`, `MotionSafe`, and `ReducedMotionFallback`.

Framer Motion is the preferred optional future tool for complex page/dialog/card presence once a dependency decision is approved. It is not installed or required for this phase. CSS remains the default for indicators and small interactions. Canvas/WebGL require an explicit performance justification.

Proposed files:

- `packages/animation-core/{package.json,tsconfig.json,vitest.config.ts,src/{index,tokens,queue}.ts,src/__tests__/queue.test.ts}`
- `apps/web/src/features/animation/{provider,adapters,primitives}.tsx`, `adapters.test.ts`, `provider.test.tsx`
- `apps/web/src/app/dev/animation/{page,preview}.tsx`, `apps/web/tests/animation.spec.ts`
- token additions in `packages/ui/src/styles.css`, provider registration in the root layout, package/lockfile updates, and Phase 6 documentation/checkpoint.

## 10. Testing, risks, and Phase 7 readiness

Test queue ordering/parallel groups/cancellation/skip/fast-forward/reconnect clearing/hidden-tab handling, critical versus decorative blocking, immutable input, preference fallback, adapter mappings, public-only Moon Village payloads, focus preservation, and preview page reduced-motion behavior. Run typecheck, lint, unit/integration tests, production build, and Playwright.

Risks/open decisions: app-wide route transition ownership, future Framer Motion adoption, low-performance detection policy, real server sequence semantics, animation telemetry, celebration/reward art direction, advanced Property Empire rules, room event coalescing policy, and Moon Village authorized asset delivery. No audio system, rules change, production particles, or Phase 7 work is in scope.

Phase 7 readiness: motion contracts, token ownership, deterministic command lifecycle, preference model, event adapter boundary, and reconnect cancellation are ready. Audio mappings, sound-caption design, volume settings, and actual audio playback remain untouched and require approval.
