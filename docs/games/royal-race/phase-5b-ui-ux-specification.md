# Phase 5B - Royal Race UI/UX Specification

Status: implemented candidate, awaiting Phase 5B approval. Phase 1 product/state boundaries, Phase 2 tokens/accessibility, Phase 3 global shell, Phase 4 room handoff, and Phase 5A offline session conventions are reused by reference.

## 1. Product goal and loop

Royal Race is an original, quick race-board game for 2-4 players. The Phase 5B slice supports a local human against bots: observe the turn, roll, receive the engine result, choose an engine-approved token, commit movement/capture/finish effects, then continue or save. It uses original names, a 24-cell compass loop, geometric markers, patterns, and no third-party game artwork.

## 2. Modes

| Mode | Phase 5B behavior |
| --- | --- |
| Offline bots | Implemented: classic (one human, three bots, four tokens) and quick (one human, one bot, one token). |
| Local multiplayer | Future adapter; same engine, device handoff and private-turn policy remain open. |
| Private room / matchmaking | Future Phase 4 handoff; the server owns dice, legality, movement, capture, turn, and ranking. |
| Reconnect | Future Phase 4 snapshot/version flow; stale intents and obsolete effects are discarded. |
| Spectator | Future read-only board, public players, turn, ranking, and log; no action controls. |

## 3. State and authority boundaries

- `RoyalRaceDomainState`: players, pieces, relative positions, die, phase, active player, turn, ranking, and versions. Only the engine changes it.
- `RoyalRaceUIState`: selection, focus index, panels, pause, board fit, and interaction lock.
- `RoyalRaceAnimationState`: current committed event, queue, timestamp, and presentation speed.
- `RoyalRaceAudioState`: mute, captions, and future volume preferences; no domain decisions.
- `GameSessionState`: save identity/status, action history, configuration, and random snapshots.
- `RoomState` and `RealtimeConnectionState`: Phase 4 concerns and absent from offline authority.

React submits `ROLL_DICE` or `MOVE_PIECE`; it does not calculate dice, legal tokens, destination, capture, safety, extra turns, finish, or ranking. Future online commands use the Phase 4 request ID/session ID/expected-version envelope and render only accepted snapshots/events.

## 4. Official-style Phase 5B rule assumptions

- 2-4 players and 1-4 tokens per player; all players use the same token count.
- The shared track has 24 cells. Player starts are offset by six cells; cells 0, 6, 12, and 18 are safe.
- A token leaves home only on a six and enters its player's start cell.
- A six grants another turn. Capture and token finish also grant another turn unless the player has completed the race.
- Landing on an unsafe cell returns every opponent token on that cell home. Safe cells permit co-location without capture.
- After one circuit, a token enters its four-cell home path. Finishing requires an exact roll.
- A player ranks when every token finishes and is skipped in later turn rotation. When all but one player rank, the remaining player receives the final rank and the game ends.
- No three-sixes penalty, blockades, teams, backward movement, optional pass, or token immunity beyond marked safe cells.
- The bot uses only generated legal actions, prefers the furthest legal token, and breaks equal choices with injected deterministic randomness. Strategy difficulty is an open later decision; Phase 5B speed changes presentation only.

## 5. Board and information architecture

The board renders the 24-cell perimeter as the primary spatial surface. Four labelled, patterned home paths sit in the center with finish counts. Home/track/finish counts also appear in player panels. Safe cells use text, dashed borders, and semantic color. Tokens combine player number, shape initial, pattern name, border, and player color; ownership never relies on color alone.

Priority is board, current action, active player/die, legal tokens, player status, then log/settings. Public information includes all positions, counts, die after commitment, turn, events, and ranking. Bot scoring and future random values are never shown.

## 6. Interaction flows

### Roll and move

1. `ROLL` phase enables Roll only for the local active player.
2. The engine commits `DICE_ROLLED` and either exposes legal token IDs or commits `NO_LEGAL_MOVE` plus `TURN_CHANGED`.
3. Legal token buttons become enabled and visually highlighted. Selection is UI-only.
4. Move submits the selected ID. The engine returns the new immutable state and ordered events.
5. UI announces the event summary, animates committed events, and applies engine-provided extra-turn/turn/ranking state.

Invalid actions remain disabled; a reducer rejection is announced without changing state. During bot turns controls lock, a bot badge is visible, and a presentation-only delay precedes a legal bot command.

### Pause, save, resume, and exit

Pause stops offline bot scheduling. Save persists the versioned serialized domain state, action history, player/bot/rule configuration, and both deterministic random snapshots. It excludes selection, open panels, animation progress, hover, and focus. Resume validates game/state versions and the full domain shape, restores random streams, drops stale animation/UI state, fits the current board, and resumes the committed turn. Save-and-exit/restart confirmations remain a medium-priority follow-up; browser navigation currently provides exit.

### Results and rematch

`GAME_FINISHED` renders the complete engine ranking. The client never computes a winner or rewards. Rematch/return actions are specified for the later reusable result panel; the implemented slice stops at results and browser navigation.

## 7. Event presentation mapping

| Committed event | Visual/audio-caption behavior | Typical duration | Reduced motion / reconnect |
| --- | --- | --- | --- |
| `DICE_ROLLED` | Update committed die and live summary; future die-settle sound caption | 120-240 ms | Immediate value; skip if stale. |
| `PIECE_DEPLOYED`, `PIECE_MOVED` | Pulse destination token; log path-derived result | 240 ms | Immediate destination; no step announcements. |
| `PIECE_CAPTURED` | Log attacker/returned token; future non-humiliating cue | 200 ms | Immediate positions; summarize once. |
| `PIECE_ENTERED_SAFE_ZONE`, `PIECE_ENTERED_HOME_PATH` | Marker/path status and caption | 160-240 ms | Immediate label. |
| `PIECE_FINISHED`, `PLAYER_FINISHED` | Finish count/rank emphasis | 240 ms | Immediate count/rank. |
| `EXTRA_TURN_GRANTED`, `TURN_CHANGED` | Header/badge and live announcement | 160 ms | Immediate status. |
| `GAME_FINISHED` | Results status and full ranking | 300 ms | Immediate result; server snapshot wins online. |

Animations consume committed events and never delay or mutate domain transitions. The queue advances immediately under reduced motion. Audio is not shipped in this slice; captions and mute-safe state are retained for a later adapter.

## 8. Responsive behavior

- Mobile portrait: fit-to-width board, compact player cards, center paths, and fixed bottom Roll/Move/Cancel bar.
- Mobile landscape/tablet: two-column player cards and compact log; browser scrolling remains available.
- Desktop: board plus persistent token/log rail, four player panels, and non-fixed action bar.
- Large desktop: content and board height are capped to avoid unreachable controls and empty expansion.

Zoom/pan is intentionally deferred because the 7x7 board fits supported viewports. If future art makes fit unusable, controls must include zoom in/out/reset/recenter and preserve page scrolling.

## 9. Accessibility and input

- Semantic heading, player regions, labelled board/grid cells, home-path labels, status, live region, and result status.
- Token names include owner, geometric identity, number, location, and selectable state.
- Roll, selection, and movement are native buttons. Tab reaches controls; arrow keys cycle enabled legal tokens; Enter/Space activates; Escape clears selection/closes pause; L toggles the log; P toggles pause outside text inputs.
- Focus uses Phase 2 focus tokens. Primary targets are at least 44 CSS pixels; the mobile action bar stays reachable.
- Color-independent letters, shapes, patterns, labels, borders, and safe text support color-vision differences and forced/high contrast.
- Global reduced-motion policy shortens commit animation to effectively immediate. Announcements summarize outcomes, not every movement step.
- Pause initially focuses Resume, traps Tab/Shift+Tab within its actions, and restores focus to Pause when closed. Extraction into a shared dialog remains a later maintainability task.

## 10. Component architecture

| Component | Responsibility and inputs | Local state / considerations |
| --- | --- | --- |
| `RoyalRaceGameShell` | Wires engine adapter, domain snapshot, session, event queue, and intent handlers. | No rule calculations; memoize engine/providers. |
| `RoyalRaceBoard` / `BoardCell` | Render engine cell IDs, safe labels, token positions, paths, and finish counts. | Board geometry only; stable piece/cell keys. |
| `RoyalRaceToken` | Owner/shape/pattern/number/location/selectability. | Focus only; no move mutation. |
| `PlayerPanel` | Public counts, kind, active/ranked status. | Responsive summary; no bot reasoning. |
| `DiceControl` / `GameActionBar` | Submit valid user intent and show disabled reason. | Sticky on mobile. |
| `GameLog` | Durable committed-event summaries separate from animation queue. | Collapsible; virtualize only if long logs require it. |
| `PausePanel` / `ResultPanel` | Session actions and engine ranking. | Restore focus in later shared dialog extraction. |
| `BotThinkingIndicator` | Presentation lock/delay only. | Never chooses or validates actions. |

The current compact vertical slice keeps presentation helpers beside the route; extraction is recommended only when another board game proves a shared API.

## 11. Persistence, replay, and reconnect

The package implements strict state serialization, versioned IndexedDB storage, action history, replay, and restorable game/bot PRNG snapshots. IndexedDB uses a Royal Race-specific database to avoid changing existing save schemas. Unsupported or malformed saves fail closed with recovery messaging.

Future reconnect follows Phase 4: keep the last board visible, disable authoritative actions, reauthenticate, fetch a versioned server snapshot, discard stale pending commands/events, restore public/private identity boundaries, and resume only if the server says the turn is valid. Spectators receive no action controls.

## 12. Implementation and file plan

- Pure engine, bot, replay, random, serialization, and storage: `packages/game-royal-race/src/`.
- Route handoff: game catalog/detail -> `/games/royal-race/setup` -> `/games/royal-race/play`.
- UI/session boundary types: `apps/web/src/features/royal-race/types.ts`.
- Original responsive route: `apps/web/src/app/games/royal-race/`.
- Unit/integration coverage: package Vitest tests and `apps/web/tests/royal-race.spec.ts`.

No production Socket.IO, matchmaking, backend, voice, commerce, Property Empire, or Moon Village work is included.

## 13. Testing and performance plan

Package tests cover setup validation, deterministic roll/deploy, legal actions, immutable movement, unsafe capture, safe protection, home entry, exact finish, extra turns, ranked-player skipping, full ranking, bot legality, strict serialization, replay, save versioning, and random restoration. Browser integration covers detail/setup configuration, keyboard focus, roll, accessible board/tokens, pause/save/resume, and mobile action reachability. Repository typecheck, lint, tests, production build, and all Playwright flows are required at the checkpoint.

The route memoizes engine/providers, uses stable cell/piece keys, limits the board to 40 small cells, and lazily ships only on its route. The complete board rerenders after a committed transition, which is acceptable at this scale; hover does not mutate domain state.

## 14. Risks and unresolved decisions

- Final art direction, richer movement/audio assets, timer, hints, zoom/pan, and bot strategy levels.
- Blockades, multiple-capture policy, three-sixes penalty, alternate token counts, teams, and match duration presets.
- Local pass-and-play privacy, online timeout/auto-action policy, spectator/chat policy, rewards, and rematch ownership.
- Shared modal focus trap/restoration and extraction of reusable board/player/result components.

## 15. Phase 5C readiness

Ready to reuse: AppShell, design tokens, responsive utilities, focus/live-region conventions, game-core engine contract, deterministic provider pattern, player panel language, action bar, bot presentation delay, pause/save/replay approach, event animation queue, and Phase 4 authority/handoff contracts.

Needs deliberate design before Property Empire: a generic board renderer, timer, zoom/pan, reusable dialog/result components, audio adapter, reconnect overlay implementation, and stateful economic-action panels. These are readiness notes, not Phase 5C work.
