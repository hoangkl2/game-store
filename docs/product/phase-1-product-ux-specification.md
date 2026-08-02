# Game Store — Phase 1 Product and UX Specification

Status: Draft for approval  
Scope: Product and UX analysis only  
Implementation gate: Do not begin Design System or production implementation until this document is approved.

## 0. Source of truth and classification

This specification uses the master product brief supplied in the conversation and a repository audit performed against the current workspace. Statements are classified as follows:

- **Confirmed repository fact**: observed in source, package metadata, or the resolved workspace dependency graph.
- **Recommendation**: proposed product or UX behavior for a later phase; it is not implemented by this document.
- **Assumption**: a working interpretation used to keep the specification coherent without blocking Phase 1.
- **Unresolved decision**: requires product, legal, game-rules, business, or engineering approval before the affected design is finalized.

## 1. Repository findings

### 1.1 Confirmed repository facts

#### Toolchain and framework versions

| Area | Declared | Resolved/observed |
|---|---|---|
| Package manager | pnpm 9.15.0 | pnpm workspace with lockfile |
| Monorepo | Turborepo `^2.3.3` | 2.10.8 |
| Web framework | Next.js `^15.1.3` | 15.5.22, App Router |
| UI runtime | React/React DOM `^19.0.0` | 19.2.8 |
| Language | TypeScript `^5.7.2` | 5.9.3; strict and `noUncheckedIndexedAccess` enabled |
| Client state dependency | Zustand `^5.0.2` | 5.0.14 |
| Unit testing | Vitest `^2.1.8` | 2.1.9 with V8 coverage |
| Browser testing | Playwright `^1.49.1` | 1.62.1 |

The root workspace includes `apps/*` and `packages/*`. Existing source workspaces are `apps/web`, `apps/api`, `packages/game-core`, `packages/game-uno`, `packages/shared-types`, and `packages/ui`.

#### Routing conventions and current screens

- The web app uses Next.js App Router under `apps/web/src/app`.
- Only `/` exists, implemented by `app/page.tsx`; `app/layout.tsx` is the sole layout.
- `/` directly renders a minimal client-side UNO match rather than a platform home page.
- No route groups, dynamic game routes, authentication routes, error boundaries, loading files, not-found route, or metadata hierarchy exist.
- One Playwright test verifies that the UNO heading, player hand, and Draw button render.

#### Design system and reusable components

- No Tailwind, Shadcn UI, CSS tokens, global stylesheet, component variants, icons, or component documentation are present.
- The current UNO page uses inline CSS and native buttons.
- `packages/ui` exports only the `UiStatus` type. It contains no reusable visual component.
- There are no implemented `GameCard`, `GameGrid`, avatar, badge, selector, dialog, card, dice, board, log, or result components.

#### Zustand stores

- Zustand is installed in the web package.
- The web page uses React `useState`, not a Zustand store.
- `packages/game-uno/src/store.ts` exposes a dependency-free, Zustand-shaped UNO slice factory with `uno`, `lastError`, `dispatch`, and `reset`; it is not wired to an actual Zustand store in the web app.
- No app-level session, identity, settings, room, connection, notification, or UI store exists.

#### Socket.IO and realtime

- There is no Socket.IO or WebSocket dependency or implementation in either app.
- No room gateway, matchmaking service, reconnect token, event contract, sequence number, state-version protocol, or Redis adapter exists.
- Server-authoritative multiplayer appears only as a future architecture plan in `docs/phase-0-architecture.md`.

#### Authentication and API

- There is no authentication implementation, JWT handling, refresh-token rotation, user model, session cookie, guard, or authorization policy.
- `apps/api` has a `nest start` script but does not declare NestJS dependencies and has no Nest module/bootstrap implementation. Its source exports only a descriptive string function.
- There is no Prisma schema, PostgreSQL integration, Swagger setup, DTO validation, rate limiting, security headers, or API route implementation.

#### Existing game-engine code

- `packages/game-core` defines generic engine, validation, transition, player, random-provider, history, replay, saved-game, bot difficulty, and bot personality contracts.
- It provides `MathRandomProvider`, `SeededRandomProvider`, and `MockRandomProvider`.
- `packages/game-uno` implements a pure TypeScript UNO engine, 108-card deck, deterministic shuffle, 2–4 player setup, action validation, immutable reduction, action-card effects, win detection, legal-action generation, serialization, replay helper, save envelope, save-version guard, EASY/NORMAL/HARD bots, IndexedDB persistence, and tests.
- Current UNO assumptions include seven-card hands, a number-only opening discard, always-legal Wild Draw Four, no UNO-call/challenge/scoring system, and no stacking/jump-in/seven-zero rules.
- The browser UI supports one named human and one bot, automatically chooses red for Wild cards, performs a short bot delay, and offers manual save/resume for a fixed save ID.
- Ludo, Monopoly, and Werewolf packages do not exist.

#### Audio and animation

- No audio manager, sound assets, mute/volume controls, haptic utility, animation library, motion tokens, reduced-motion implementation, or transition orchestration exists.
- The only timed presentation behavior is a 250 ms UNO bot delay.

#### Persistence

- UNO uses a direct IndexedDB object store named `uno-saved-games`; Dexie is not installed.
- The implementation does not yet provide the full planned database of settings, profile, recent games, action history, cosmetics, autosave policy, conflict handling, corruption quarantine, import/export, or multi-tab locking.

### 1.2 Conflicts and gaps against the master brief

| Brief expectation | Repository reality | Product/UX consequence |
|---|---|---|
| Platform home, catalog, details, setup, room, saves, profile, settings, progression | Only `/`, directly showing UNO | Information architecture and entry journeys are absent. |
| Tailwind + Shadcn reusable design system | Inline styles and native controls | Visual language, responsive behavior, accessibility patterns, and states are undefined. |
| Zustand app orchestration | React local state; unused slice adapter | State ownership is unclear and will become risky when rooms/reconnect are added. |
| Dexie offline database | Direct UNO-only IndexedDB wrapper | Cross-game saves, migration, recovery, and settings are not unified. |
| NestJS API | Placeholder TypeScript function | No account or online journey can be supported. |
| PostgreSQL + Prisma schema | Absent | No durable identity, match history, progression, rooms, or rewards. |
| JWT authentication and authorization | Absent | Guest/account boundaries remain conceptual. |
| Socket.IO online multiplayer | Absent | Private rooms, matchmaking, reconnect, invitations, and spectators are unimplemented. |
| Four initial games | UNO engine only | Catalog messaging must distinguish playable, planned, and unavailable games. |
| Shared UI package | Type-only placeholder | No reusable components currently exist. |
| Offline local multiplayer | Engine can model humans, UI exposes one hand | Pass-and-play privacy and handoff UX are not solved. |
| Private information security for Werewolf | No Werewolf or online projection model | Public/private state contracts must be defined before implementation. |
| Full save/recovery/replay UX | Basic fixed-ID save/resume | Users cannot manage multiple saves or recover corrupt/old records. |
| Audio, animation, reduced motion | Absent | Feedback and accessibility behavior require a later design phase. |
| Phase 0 documentation says UNO awaits approval | UNO is already implemented | Documentation status is stale and should be reconciled later, outside this phase. |
| Product name typography | Source and docs contain mojibake such as `Â·`/misencoded punctuation | Content encoding and localization quality need a cleanup policy. |

### 1.3 Assumptions used in this specification

- Launch sequence remains UNO first, followed by Ludo, Monopoly-like, and Werewolf.
- Guest users may play offline and join private rooms, but public competitive matchmaking and durable progression require an account unless product policy later relaxes this.
- “Local multiplayer” means pass-and-play on one device in the first release, not LAN or multiple controllers/devices.
- Online games are server-authoritative. The browser sends intents and renders authorized state projections.
- Commerce is included in the sitemap because the brief includes cosmetic inventory, but real-money purchases are not assumed for initial release.
- Spectating is opt-in per room/game and never exposes hidden information unavailable to a legitimate spectator role.
- A supported browser with IndexedDB is required for durable guest saves; private browsing may reduce reliability.
- Mobile web and desktop web are first-class. Native mobile apps are out of scope.

### 1.4 Unresolved decisions at repository-analysis level

- Whether guests may use public matchmaking and, if so, what anti-abuse identity is required.
- Whether guest data can be merged into an account and how conflicts are resolved.
- Whether offline saves synchronize automatically after sign-in or require explicit opt-in.
- Which games permit spectators and whether delayed spectating is required.
- Whether commerce ships at all in the first public release.
- Whether local multiplayer supports hidden-hand games on one device; UNO and Werewolf need explicit privacy solutions.
- Product naming and licensing strategy for UNO/Monopoly-like branded rules and assets.

## 2. Product vision

Game Store is an approachable, offline-first home for familiar board and card games. A player should be able to move from curiosity to a valid match in under a minute, play reliably against bots or people, leave without losing progress, and return on any supported device when signed in. The same trusted game rules should power offline play, bots, replay, and server-authoritative online matches.

The experience should feel like one coherent game platform—not four disconnected mini-sites—while allowing each game to retain its own board, hand, information-visibility, and pacing needs.

## 3. Product principles

1. **Play before paperwork.** Guest entry is prominent; account value is explained at moments of benefit, not used as an unnecessary gate.
2. **Rules are trustworthy.** Legal actions, randomness, turns, outcomes, and online rewards come from authoritative game logic.
3. **Offline is a complete mode.** Lack of network is a supported state with clear save and recovery behavior.
4. **Private means private.** Secret roles, cards, and hidden actions are projected only to authorized players.
5. **Every interruption is recoverable.** Saves, reconnect, resync, host transfer, and explicit exit states prevent ambiguous loss.
6. **One platform, game-specific clarity.** Navigation, setup, status, errors, and results are consistent while boards and controls remain game-appropriate.
7. **Accessible by default.** Keyboard operation, contrast, semantic labels, scalable text, reduced motion, non-color cues, and touch targets are baseline requirements.
8. **Explain unavailable behavior.** Users see why a mode is unavailable and what action can resolve it.
9. **No deceptive urgency.** Matchmaking, rewards, invitations, and commerce communicate real state and real costs.

## 4. Target user groups

| Group | Context | Primary goal | Sensitivity |
|---|---|---|---|
| Casual solo player | Short break, weak/absent network | Start quickly against bots | Setup friction, unclear rules |
| New board-game player | Little rules knowledge | Learn safely without embarrassment | Overload, punitive mistakes |
| Friends/family co-located | One shared tablet/laptop | Play locally together | Hidden-hand privacy, handoff friction |
| Remote friend group | Planned social session | Create/join a reliable private room | Codes, readiness, disconnects |
| Competitive public player | Repeated online sessions | Find fair matches and track progress | Queue time, cheating, rating trust |
| Returning progression player | Cross-device/account usage | Resume, see stats, unlock cosmetics | Data loss, sync conflict |
| Spectator/learner | Watching friends or completed play | Follow the match without interfering | Hidden information, unclear status |
| Accessibility-dependent player | Keyboard, screen reader, reduced motion, low vision | Complete all critical flows independently | Visual-only cues, time pressure |

## 5. User needs and pain points

- Understand which games and modes are playable now.
- Start with sensible defaults without understanding every rule variant.
- Learn legal actions in context and recover from invalid input without losing the turn.
- Configure bots by difficulty without needing to understand bot internals.
- Know whether progress is stored locally, synced to an account, or not saved.
- Share and enter room codes with low transcription error.
- Understand host powers and what happens when the host leaves.
- Know whether a disconnect is temporary, whether the clock continues, and whether a bot substitutes.
- Trust that opponents cannot see private cards/roles or forge outcomes.
- Resume offline games and reconnect online without duplicate actions or state jumps.
- Finish with a clear outcome, explanation, replay/rematch options, and next destination.
- Avoid accidental exposure of a local player's hand during pass-and-play.

## 6. Supported play modes

### 6.1 Mode-level behavior

| Mode | Entry point | Setup | Required data | Main actions | Exit and save | Recovery | Unavailable messaging |
|---|---|---|---|---|---|---|---|
| Offline single player with bots | Home Continue, game detail, `/games/[game]/setup?mode=solo` | Name, bots, difficulty/personality, rules, theme, sound | Game version, rule config, local player, bot profiles, random seed | Play, draw/roll/choose/vote, pause, save | Pause/exit offers save; autosave after accepted actions | Load latest valid snapshot; replay pending actions; quarantine corrupt save | “Offline mode is not available for this game yet” with supported-mode link |
| Offline local multiplayer | Game detail, `/games/[game]/setup?mode=local` | 2–N local players, names, turn privacy, rules | Player roster, device privacy capability, game config | Pass device, reveal private view, act, hide, hand off | Autosave locally; explicit quit confirms shared match abandonment | Resume at privacy handoff screen; never reveal next player’s secrets on load | Explain hidden-information limitations and recommend private online room when needed |
| Private online room | Game detail, Play menu, invitation | Host chooses game/rules/capacity/privacy; invitees ready | Auth or guest session, room code/token, compatible game version | Invite, join, ready, chat/emote if enabled, host start, play | Lobby leave is immediate; in-match leave follows reconnect/forfeit policy; server saves authoritative state | Rejoin with reconnect token; snapshot + sequence resync; host transfer policy | Network/auth/version/room-capacity reason plus retry or offline alternative |
| Public matchmaking | Game detail, global Play Online | Mode/rules region, optional preference; no opponent selection | Auth identity by default, rating/region, queue ticket | Queue, see estimate, cancel, accept match, ready, play | Cancel before match without penalty; leaving accepted/active match follows penalty policy | Queue ticket recovery; reconnect during ready/match; no client result trust | Explain account requirement, region outage, queue closure, or unsupported game |
| Spectator mode | Room link, friend activity, completed match/replay | Consent/privacy check; choose live or delayed view | Spectator identity, room policy, authorized projection | Watch, inspect public log, leave; no game actions | No game save; optional replay bookmark for accounts | Reconnect to latest public snapshot | “Spectating is disabled,” “match is private,” or “hidden-information game does not permit live spectators” |
| Reconnect after temporary disconnection | Automatic overlay or room/match deep link | Usually none; identity verification if token expired | Room ID, player ID, reconnect token, last sequence/state version | Wait, retry, continue after resync, abandon if allowed | Server match remains source of truth; no local overwrite | Handshake → authoritative snapshot/delta → private projection → resume | Clear countdown and consequence: bot replacement, AFK action, or forfeit |
| Guest play | Primary first-visit CTA | Display name and consent; optional local profile | Device-scoped guest ID; room-scoped identity online | Browse, offline play, eligible private-room play, local saves | Local saves only unless guest-room server state exists | Device-local recovery; room reconnect token; account upgrade prompt | Explain which account-only feature was selected and preserve current setup after sign-in |
| Authenticated play | Sign-in, account CTA, gated feature | Credentials/provider, profile, consent | User ID, secure session, cloud preferences/progression | All eligible modes, sync, history, achievements, inventory | Cloud records and server match history; offline sync policy applies | Token refresh/sign-in recovery, conflict resolution, support path | Explain account restriction, suspension, parental/privacy limits, or service outage |

### 6.2 Supported-play recommendation by game

| Game | Solo bots | Local pass-and-play | Private room | Public match | Spectator recommendation |
|---|---:|---:|---:|---:|---|
| UNO | Yes | Yes, with explicit hand-hiding handoff | Yes | Yes | Public-card/table view; hide hands |
| Ludo | Yes | Yes | Yes | Yes | Suitable; public board state |
| Monopoly-like | Yes | Yes | Yes | Later, after session-length policy | Suitable; hide private event cards if any |
| Werewolf | Yes only when bot behavior is stable | Conditionally; moderator/privacy UX required | Yes | Later, with conduct controls | No live unrestricted spectators; eliminated-player visibility policy required |

## 7. Guest-versus-account capability matrix

| Capability | Guest | Account | Recommendation |
|---|---:|---:|---|
| Browse catalog/details/rules | Yes | Yes | Public |
| Offline bots | Yes | Yes | Core no-sign-in promise |
| Local multiplayer | Yes | Yes | Device-local |
| Multiple local saves | Yes | Yes | Guest saves remain device-bound |
| Cloud save/sync | No | Yes | Offer upgrade after a successful save |
| Private room create | Yes, rate-limited | Yes | Guest room expires sooner |
| Private room join | Yes | Yes | Preserve invite after sign-in if policy requires account |
| Public matchmaking | Assumption: No | Yes | Unresolved; anti-abuse decision required |
| Friends/presence/direct invites | No | Yes | Share-link invites remain guest-compatible |
| Match history/statistics | Local recent list only | Durable cross-device | Label local versus synced clearly |
| Achievements/rewards | Preview only or local provisional | Durable | Do not promise guest reward recovery without merge policy |
| Inventory/equipped cosmetics | Default/local items | Durable owned items | Server validates online entitlements |
| Spectate public/linked room | Policy-dependent | Yes | Room privacy still controls access |
| Report/block/moderation | Limited room report | Full history, block list, appeals | Online safety design required |
| Purchases | No | Only if commerce approved | No guest purchases |

## 8. Core gameplay loops

### 8.1 Discovery loop

Discover game → understand players/modes/time/difficulty → inspect rules → choose mode → configure → start or enter lobby.

### 8.2 Offline loop

Create deterministic session → present current player and legal actions → submit action to local engine → render events → bot chooses from legal actions → autosave accepted transition → finish → result/history/rematch.

### 8.3 Online loop

Enter room/queue → establish identity and readiness → client sends action intent with idempotency key and expected sequence → server validates and reduces → server persists/snapshots → server sends authorized public/private projections → client renders → reconnect/resync when necessary → server declares result/rewards.

### 8.4 Progression loop

Complete eligible match → server validates result → update stats/achievements/rewards → show concise result summary → equip cosmetic or choose next/rematch. Offline guest outcomes must be labeled local and must not be treated as trusted competitive results.

## 9. New-player experience

- First screen explains the platform in one sentence and offers **Play as guest**, **Sign in**, and **Browse games**.
- A mode-aware game card shows availability, player count, typical duration, offline support, and learning difficulty.
- Setup defaults to the simplest supported rules, one NORMAL balanced bot, sound on, and reduced motion inherited from the OS.
- First match uses optional contextual teaching: highlight legal actions, explain action cards/board events once, and allow replay of the explanation.
- Invalid actions are prevented when possible and explained when not; no rule knowledge is assumed.
- Account prompts occur after value moments—saving, inviting, viewing progression—not before basic offline play.

## 10. Returning-player experience

- Home prioritizes **Continue playing**, recent games, pending invitations, and last-used setup.
- Offline saves show device/local status and last compatible version; online active matches show reconnect status.
- Signed-in users see synchronized progression and friend/room activity after session restoration.
- Stale or incompatible saves open a recovery screen, not a blank room.
- The platform remembers accessibility, sound, theme, language, and setup preferences separately from authoritative game state.

## 11. Complete route-level sitemap

Routes are recommendations for later implementation. None except `/` currently exists.

### 11.1 Public

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/` | Home, continue, featured/recommended/categories | Public | Continue or choose game | Active reconnect → `/rooms/[roomId]/game`; optional onboarding |
| `/about` | Platform explanation | Public | Browse games | None |
| `/help` | Help center | Public | Search help | Article route |
| `/help/[slug]` | Rules/platform help article | Public | Resolve issue | 404 if missing |
| `/legal/terms` | Terms | Public | Review/accept where required | Return URL |
| `/legal/privacy` | Privacy policy | Public | Review | Return URL |
| `/status` | Service status | Public | Retry affected service | Home/offline catalog |

### 11.2 Authentication

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/auth/sign-in` | Sign in | Signed-out | Authenticate | Safe `returnTo`, otherwise `/` |
| `/auth/register` | Create account | Signed-out | Register | Verification or `returnTo` |
| `/auth/verify` | Verify email/account | Token holder | Verify | Expired-token recovery |
| `/auth/forgot-password` | Request reset | Signed-out | Send reset link | Confirmation |
| `/auth/reset-password` | Set new password | Valid token | Reset | Sign-in |
| `/auth/guest-upgrade` | Convert/merge guest profile | Guest | Create/attach account | Conflict resolution or `returnTo` |

### 11.3 Game discovery

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/games` | Search/filter catalog | Public | Open game | None |
| `/games/[gameSlug]` | Details, modes, rules, availability | Public | Choose play mode | Unknown slug → 404 |
| `/games/[gameSlug]/rules` | Full rules and variants | Public | Start setup | Back to details |
| `/games/[gameSlug]/setup` | Mode-specific configuration | Public/conditional | Start or create room | Account gate preserving draft; unavailable screen |

### 11.4 Offline gameplay

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/play/offline/[gameSlug]/[sessionId]` | Active offline/bot/local match | Local session owner | Take legal action | Missing/corrupt save → recovery |
| `/saved-games` | List/manage local and cloud saves | Public; enhanced for account | Resume | Sign-in for cloud filter |
| `/saved-games/[saveId]` | Save details/recovery/export | Save owner | Resume/recover | Missing → saved-games empty/error |
| `/replays/local/[replayId]` | Local replay viewer | Local owner | Play replay | Invalid replay → recovery |

### 11.5 Online rooms

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/play/online` | Online mode chooser | Network; policy gate | Matchmake or create/join | Sign-in if required |
| `/rooms/create` | Private-room setup | Guest/account by policy | Create room | Sign-in/unsupported game |
| `/rooms/join` | Enter code/link | Public | Join | Room lobby, password, or error |
| `/rooms/[roomId]` | Lobby, seats, ready state, invites | Authorized member | Ready/start | Active game → game route |
| `/rooms/[roomId]/game` | Authoritative online match | Authorized player/spectator | Submit action intent/watch | Reconnect, lobby, result, unauthorized |
| `/rooms/[roomId]/result` | Match result/rematch vote | Match participant | Rematch/return | Lobby or history |
| `/matchmaking/[ticketId]` | Queue and acceptance | Eligible identity | Wait/cancel/accept | Room or online chooser |
| `/spectate/[roomId]` | Authorized spectator projection | Policy-authorized | Watch | Sign-in, denied, ended replay |

### 11.6 Social

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/friends` | Friends/presence | Account | Invite/view profile | Sign-in |
| `/invitations` | Pending invites | Account; link invites handled directly | Accept/decline | Room/sign-in |
| `/invite/[token]` | Deep-linked invitation | Public token holder | Accept | Sign-in if required, expired/room full |
| `/players/[playerId]` | Public player profile | Policy-visible | Invite/add/block | Sign-in for social action |

### 11.7 Progression

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/history` | Match history | Account; local subset for guest | Inspect result/replay | Sign-in for cloud history |
| `/history/[matchId]` | Match summary | Authorized/visibility policy | Replay/rematch | Unauthorized/expired |
| `/statistics` | Cross-game stats | Account | Inspect game breakdown | Sign-in |
| `/achievements` | Achievement progress | Account; preview public | Inspect/claim if applicable | Sign-in |
| `/leaderboards` | Future competitive rankings | Account/public view | Filter/rank | Unavailable until launched |

### 11.8 Commerce

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/store` | Cosmetic catalog if commerce approved | Account for purchase | Inspect item | Sign-in/unavailable region |
| `/store/[itemId]` | Cosmetic detail | Public/account | Purchase/equip | Inventory/sign-in/error |
| `/checkout` | Purchase confirmation if approved | Account | Confirm purchase | Store/success/failure |
| `/inventory` | Owned/unlocked cosmetics | Account; local defaults for guest | Equip | Sign-in for durable inventory |

### 11.9 Account

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/profile` | Own profile | Account; local guest profile variant | Edit/view | Sign-in or `/profile/local` |
| `/profile/local` | Device-local guest profile | Guest | Rename/upgrade | Account profile after merge |
| `/settings` | General settings hub | Public/local or account | Change preference | Section route |
| `/settings/accessibility` | Motion, contrast, text, input | Public/local or account | Save preferences | Settings |
| `/settings/audio` | Music/effects/voice controls | Public/local or account | Test/save audio | Settings |
| `/settings/privacy` | Presence, invites, data controls | Account | Save privacy | Sign-in |
| `/settings/account` | Credentials/session/delete/export | Account | Manage account | Re-auth/sign-in |

### 11.10 System and recovery

| Route | Purpose | Access | Primary action | Possible redirects |
|---|---|---|---|---|
| `/offline` | Network-unavailable landing | Public | Continue offline/retry | Intended online destination |
| `/reconnect/[roomId]` | Online reconnection/resync | Prior participant | Reconnect | Match/lobby/expired result |
| `/recovery/save/[saveId]` | Corrupt/incompatible save recovery | Save owner | Restore/export/delete | Saved games |
| `/sync/conflicts` | Resolve local/cloud conflicts | Account | Choose/duplicate version | Original destination |
| `/maintenance` | Planned outage state | Public | Retry/use offline | Home/status |
| `/forbidden` | Permission explanation | Public | Sign in/request access/go back | Safe destination |
| `/not-found` | Missing content fallback | Public | Search/go home | Home/catalog |

## 12. Navigation structure

### Global desktop navigation

- Primary: Home, Games, Play Online, Saved Games.
- Account/progression: History, Achievements, Inventory, Profile.
- Utility: Invitations, connection status, settings, help.
- Contextual “Resume match” indicator supersedes normal Play CTA while an online match is reconnectable.

### Global mobile navigation

- Bottom navigation: Home, Games, Play, Saves, Profile/Menu.
- Active-match mode removes nonessential global navigation and uses a pause/connection control.
- Invitations and reconnect warnings use a badge plus an accessible announcement, never color alone.

### In-game navigation

- Game header: exit/pause, game/room identity, turn/phase, connection/save status, rules/log.
- Main play surface: board/table/hand according to game.
- Secondary controls: player list, chat/emotes if enabled, accessibility shortcuts.
- Destructive exit always states the consequence: saved locally, reconnect window, bot takeover, or forfeit.

## 13. Screen hierarchy

```text
Platform shell
├─ Discovery
│  ├─ Home
│  ├─ Catalog
│  ├─ Game detail/rules
│  └─ Mode setup
├─ Offline session
│  ├─ Loading/migration
│  ├─ Game room
│  ├─ Pause/save/exit overlays
│  └─ Result/replay
├─ Online session
│  ├─ Matchmaking or room creation/join
│  ├─ Lobby/ready/invite
│  ├─ Game room + connection layer
│  ├─ Reconnect/resync
│  └─ Result/rematch/lobby
├─ Social/progression
│  ├─ Friends/invitations
│  ├─ History/statistics/achievements
│  └─ Inventory/store
└─ Account/system
   ├─ Authentication/profile/settings
   └─ Offline/error/maintenance/recovery/conflict
```

## 14. Entry points into each game

Every game may be entered through: catalog card; featured/recommended home card; recently played; continue save; game-detail primary CTA; saved-games row; rematch; private invitation; room code; matchmaking result; friend presence/invite; history/replay; and reconnect banner.

The entry resolver must retain intent (`game`, `mode`, `room/invite`, setup draft, and return route) across authentication or network recovery. If a game or mode is not implemented, the detail page remains useful and clearly labels “Planned,” offers rules/notification opt-in if available, and recommends playable alternatives.

## 15. State boundaries

| Boundary | Owns | Must not own | Persistence/authority |
|---|---|---|---|
| `DomainGameState` | Rules, turn/phase, board/deck, authoritative random outcomes, legal transition inputs, result | Dialogs, connection, route, animation | Local engine offline; server engine online |
| `RoomState` | Room ID/code, host/owner, seats, readiness, capacity, room rules snapshot, match status, spectator policy | Card/role secrets, transient UI | Server authoritative online |
| `GameUIState` | Selected item, open panels/dialogs, hints, focus, animation queue, local layout, pending intent display | Rule decisions, winner, authoritative timers | Client-local; disposable |
| `RealtimeConnectionState` | Socket lifecycle, latency, reconnect attempt, last acknowledged sequence, resync status | Room membership truth, game rules | Client observes; server confirms |
| `PlayerPrivateState` | Authorized hand, role, private choices, private prompts/knowledge | Other players’ secrets | Server-projected per recipient online; protected local view offline |
| `PlayerPublicState` | Display name/avatar, seat, ready/connected/AFK status, public score, hand count, eliminated status | Secret cards/roles/actions | Server authoritative online |

Online clients must not determine random results, legal actions, hidden information, turn transitions, winner, or rewards. A client may optimistically display a pending intent, but it must reconcile to the server transition. Werewolf projections must be constructed server-side per recipient; unauthorized clients must never receive secret role fields in a hidden DOM node, store, event payload, replay stream, log, or analytics event.

## 16. Major user journeys

Each journey uses the required format. “Loading” includes skeleton/progress behavior; “error” identifies failure presentation; “recovery” identifies the next safe action.

### 16.1 First visit

- **Entry condition:** No recognized account session and no established local profile.
- **User goal:** Understand the product and start confidently.
- **Main happy path:** Land on Home → see concise value proposition and playable games → choose Play as guest or Browse games → preferences initialize from OS/browser.
- **Decision points:** Guest versus sign-in; browse versus immediate recommended UNO setup.
- **Alternate paths:** Open invitation deep link; arrive offline; accessibility settings first.
- **Empty states:** No recent/continue content; show featured playable games instead.
- **Loading states:** Home shell and catalog-card skeletons; do not block guest CTA on recommendations.
- **Error states:** Catalog service unavailable; local app still offers installed/offline-capable games.
- **Recovery actions:** Retry online content, continue offline, open status/help.
- **Exit conditions:** Guest profile created, authentication started, or game detail opened.
- **Mobile considerations:** CTA above fold; compact cards; no autoplay media.
- **Desktop considerations:** Featured catalog and mode explanation may appear side by side.

### 16.2 Continue as guest

- **Entry condition:** Signed out with guest play available.
- **User goal:** Play without creating an account.
- **Main happy path:** Select Continue as guest → choose/confirm display name → create device-scoped guest identity → return to intended game/setup/invite.
- **Decision points:** Default or custom name; optional analytics/privacy consent.
- **Alternate paths:** Switch to registration; use an existing local guest profile.
- **Empty states:** No local profile; generate a neutral editable name.
- **Loading states:** Brief local profile initialization; no network dependency for offline play.
- **Error states:** Local storage unavailable or quota denied.
- **Recovery actions:** Continue session-only with explicit “progress may not persist” warning; open browser-storage help.
- **Exit conditions:** Guest session active or user chooses account path.
- **Mobile considerations:** Avoid keyboard reopening; large Continue action.
- **Desktop considerations:** Explain account benefits without modal obstruction.

### 16.3 Account sign-in

- **Entry condition:** Signed out; user voluntarily signs in or selects an account-gated action.
- **User goal:** Restore identity and account capabilities without losing intent.
- **Main happy path:** Open sign-in → authenticate → restore secure session → merge/retain setup draft and safe return route → surface sync status.
- **Decision points:** Credential/provider choice; guest-data merge if applicable.
- **Alternate paths:** Register, reset password, continue as guest where allowed.
- **Empty states:** No prior account; clear registration path.
- **Loading states:** Disable duplicate submit; announce verification progress.
- **Error states:** Invalid credentials, locked account, expired provider flow, service outage.
- **Recovery actions:** Retry, reset, support, or guest fallback without losing non-sensitive draft.
- **Exit conditions:** Authenticated return, guest continuation, or safe cancellation.
- **Mobile considerations:** Password-manager friendly; deep-link return works after app switch.
- **Desktop considerations:** Modal is acceptable only when URL/state remains recoverable; full route is preferred.

### 16.4 Browse games

- **Entry condition:** User opens Home category or Games.
- **User goal:** Find a suitable playable game and mode.
- **Main happy path:** Scan/filter cards → compare players, duration, mode, difficulty, availability → open detail.
- **Decision points:** Game, category, offline/online, player count, learning difficulty.
- **Alternate paths:** Search, continue recent, select planned game, clear filters.
- **Empty states:** No filter results; explain and reset filters. No online catalog; show cached core games.
- **Loading states:** Stable card skeletons preserving layout.
- **Error states:** Catalog refresh failed or availability stale.
- **Recovery actions:** Retry, use cached catalog, open known game URL.
- **Exit conditions:** Game detail, setup, save, or home.
- **Mobile considerations:** Filter sheet and single/two-column cards; preserve scroll.
- **Desktop considerations:** Persistent filters and denser grid; keyboard grid navigation.

### 16.5 Open game detail

- **Entry condition:** Valid game slug selected.
- **User goal:** Decide whether/how to play.
- **Main happy path:** Review summary, supported modes, player count, duration, rules, accessibility, status → choose mode.
- **Decision points:** Offline bots, local, private room, matchmaking, spectate/replay where supported.
- **Alternate paths:** Read full rules, resume save, view planned availability.
- **Empty states:** No recent saves or online population; omit empty modules or explain queue estimate unavailable.
- **Loading states:** Static game identity first; dynamic saves/queue data later.
- **Error states:** Unknown game, mode service unavailable, incompatible client version.
- **Recovery actions:** Catalog, refresh/update, offline alternative.
- **Exit conditions:** Setup, room flow, queue, rules, or catalog.
- **Mobile considerations:** Sticky primary Play action with accessible mode sheet.
- **Desktop considerations:** Summary and mode panel side by side; rules remain scannable.

### 16.6 Start offline match

- **Entry condition:** Offline-capable game selected; valid setup exists.
- **User goal:** Begin immediately and retain progress.
- **Main happy path:** Confirm defaults → engine validates config → deterministic session and save ID created → initial state persisted → room opens with turn guidance.
- **Decision points:** New versus resume; tutorial on/off; rules/theme/audio.
- **Alternate paths:** Add bots, switch local mode, duplicate previous setup.
- **Empty states:** No saves; show Start new only.
- **Loading states:** Deck/board initialization and save preparation with game art and cancel-safe boundary.
- **Error states:** Invalid config, unsupported browser storage, engine initialization failure.
- **Recovery actions:** Reset invalid option, session-only play, retry with default rules.
- **Exit conditions:** Active offline room or setup cancellation.
- **Mobile considerations:** Prevent accidental back navigation after creation; portrait/landscape guidance per game.
- **Desktop considerations:** Keyboard focus begins on primary legal action or board landmark.

### 16.7 Configure bots

- **Entry condition:** Bot-supported setup selected.
- **User goal:** Choose fair opponents without complexity.
- **Main happy path:** Set bot count → choose shared or per-bot difficulty/personality → inspect short behavior descriptions → validate total seats → start.
- **Decision points:** EASY/NORMAL/HARD initially; personality; duplicate bot names/avatar policy.
- **Alternate paths:** Recommended preset; mixed human/bot local setup.
- **Empty states:** Zero bots conflicts with solo mode; explain minimum.
- **Loading states:** None for local configuration; defer cosmetic thumbnails if needed.
- **Error states:** Unsupported difficulty/game combination or too many seats.
- **Recovery actions:** Apply recommended preset or reduce seats.
- **Exit conditions:** Valid setup saved or user returns to mode choice.
- **Mobile considerations:** Stepper/cards, not dense matrix; summary always visible.
- **Desktop considerations:** Per-seat configuration table with keyboard-operable selectors.

### 16.8 Create local match

- **Entry condition:** Local mode supported and 2+ people share a device.
- **User goal:** Configure people and preserve private turns.
- **Main happy path:** Add names/seats → choose privacy handoff mode → validate rules → start → show neutral “Pass to [name]” screen before each private view.
- **Decision points:** Number of players, bots mixed in, hand reveal confirmation, screen privacy.
- **Alternate paths:** Switch to private online room if hidden information cannot be protected.
- **Empty states:** Missing player names/seats; prompt add player.
- **Loading states:** Local initialization only.
- **Error states:** Game does not support safe one-device play or screen too small for required layout.
- **Recovery actions:** Use open-information variant, add bots, or create online room.
- **Exit conditions:** Active local session or setup cancellation.
- **Mobile considerations:** Full-screen handoff with blur and explicit reveal; block notification previews where possible only through guidance.
- **Desktop considerations:** Hot-seat handoff and fullscreen suggestion; avoid showing prior private hand in transitions.

### 16.9 Create private online room

- **Entry condition:** Online service available and user eligible under guest/account policy.
- **User goal:** Create a controlled session to invite others.
- **Main happy path:** Choose game/rules/capacity/privacy → create → receive room code/link → enter lobby as host → invite players.
- **Decision points:** Guest allowance, room visibility/password, spectator policy, bot fill, host migration, region.
- **Alternate paths:** Sign in while preserving setup, duplicate prior room, switch offline.
- **Empty states:** Empty lobby shows invite methods and bot-fill option.
- **Loading states:** Idempotent room creation; disable duplicate creation; show cancellation-safe progress.
- **Error states:** Network failure, rate limit, unsupported rules/version, service capacity.
- **Recovery actions:** Retry same idempotency key, adjust settings, use offline mode.
- **Exit conditions:** Room lobby, sign-in gate, or mode chooser.
- **Mobile considerations:** Native share sheet and copy code; code remains readable without horizontal scroll.
- **Desktop considerations:** QR code plus link/code copy; roster and settings visible together.

### 16.10 Join with room code

- **Entry condition:** User has a code and online service is reachable.
- **User goal:** Join the correct lobby quickly.
- **Main happy path:** Enter normalized code → resolve room → confirm identity/display name → pass password/eligibility check → join lobby.
- **Decision points:** Guest/account identity, spectator versus player if allowed, password.
- **Alternate paths:** Paste full invite link, scan QR, sign in preserving code.
- **Empty states:** Blank code field with format example; recent valid invitations if account.
- **Loading states:** Code lookup and join reservation with clear progress.
- **Error states:** Invalid/expired code, room full, match started, banned, incompatible version.
- **Recovery actions:** Re-enter, join as spectator if permitted, request new link, update client, return to online chooser.
- **Exit conditions:** Lobby/game/reconnect, or join screen with actionable error.
- **Mobile considerations:** Uppercase-friendly segmented or single field; paste/scan affordance.
- **Desktop considerations:** Keyboard submit and QR scanning optional, not required.

### 16.11 Accept invitation

- **Entry condition:** Valid invitation token from link or account inbox.
- **User goal:** Reach the intended room with minimal re-navigation.
- **Main happy path:** Open token → preview inviter/game/room status without leaking private data → accept → authenticate/guest-name if needed → join.
- **Decision points:** Accept/decline; player/spectator; sign-in/guest.
- **Alternate paths:** Room already active allows reconnect/spectate if authorized.
- **Empty states:** No pending account invites; offer create/join room.
- **Loading states:** Token validation and room reservation.
- **Error states:** Expired/revoked/full/finished invite, blocked inviter, version mismatch.
- **Recovery actions:** Ask for new invite, view result if authorized, browse game, update.
- **Exit conditions:** Lobby/game, invitation list, or safe expired state.
- **Mobile considerations:** Preserve token through app/browser authentication handoff.
- **Desktop considerations:** Room preview can show roster and rules before acceptance.

### 16.12 Public matchmaking

- **Entry condition:** Eligible authenticated user, supported game/playlist, healthy service.
- **User goal:** Find a fair match within a predictable time.
- **Main happy path:** Choose playlist/preferences → create queue ticket → see estimate/search expansion → match found → accept/ready → enter room.
- **Decision points:** Ranked/casual later, region, acceptable rules, queue expansion consent.
- **Alternate paths:** Practice against bots while waiting only if technically safe; private room; cancel.
- **Empty states:** No active playlist/population estimate; recommend bots or peak times.
- **Loading states:** Queue timer, estimated range, search status; never fake opponents.
- **Error states:** Ticket lost, queue service unavailable, version mismatch, eligibility restriction.
- **Recovery actions:** Restore ticket, retry, update, select offline/private mode.
- **Exit conditions:** Matched room, canceled ticket, timeout alternative, or error recovery.
- **Mobile considerations:** Background/tab behavior and notification permission explained; returning restores ticket.
- **Desktop considerations:** Queue remains visible in global shell; optional non-destructive browsing.

### 16.13 Cancel matchmaking

- **Entry condition:** Active queue ticket before committed match threshold.
- **User goal:** Stop searching without uncertainty or unfair penalty.
- **Main happy path:** Select Cancel → immediate pending state → server confirms ticket cancellation → return to online chooser.
- **Decision points:** If match already found, distinguish decline policy from queue cancellation.
- **Alternate paths:** Keep searching; switch playlist after cancel.
- **Empty states:** Ticket already expired/canceled; show resolved state.
- **Loading states:** Short “Canceling…” state blocks duplicate requests but allows app navigation only after policy-defined confirmation.
- **Error states:** Network loss during cancellation or race with match assignment.
- **Recovery actions:** Query ticket status; if matched, show accept/decline state; retry idempotently.
- **Exit conditions:** Confirmed canceled, match acceptance, or recoverable unknown-status screen.
- **Mobile considerations:** Browser back triggers the same explicit cancellation behavior.
- **Desktop considerations:** Escape key must not silently abandon the queue.

### 16.14 Ready-up flow

- **Entry condition:** User occupies a player seat in a private or matched lobby.
- **User goal:** Confirm readiness and understand what remains before start.
- **Main happy path:** Review rules/seat/device status → mark Ready → see immutable ready indicator → all required seats ready → host start or automatic countdown.
- **Decision points:** Unready before countdown lock; consent to custom rules; bot seats.
- **Alternate paths:** Host edits settings, which clears affected readiness; player changes seat.
- **Empty states:** Open seats show invite/bot-fill; no host action yet.
- **Loading states:** Ready acknowledgement pending; do not show ready until server confirms.
- **Error states:** Rule version mismatch, disconnected player, seat lost, unauthorized setting change.
- **Recovery actions:** Refresh authoritative lobby, reclaim seat, update, re-ready.
- **Exit conditions:** Start countdown/game, unready state, or leave lobby.
- **Mobile considerations:** Ready CTA sticky; roster statuses readable without hover.
- **Desktop considerations:** Keyboard shortcuts optional but must not cause accidental readiness.

### 16.15 Host starts match

- **Entry condition:** Host owns start permission and server reports start conditions met.
- **User goal:** Begin exactly one valid authoritative match.
- **Main happy path:** Host selects Start → confirmation only for consequential custom settings/open seats → server locks room, validates roster/config, initializes random state, broadcasts start snapshot.
- **Decision points:** Fill open seats with bots, wait, or reduce capacity; forced start policy.
- **Alternate paths:** Automatic start after all ready in matchmaking.
- **Empty states:** No/insufficient players; Start disabled with explanation.
- **Loading states:** Server initialization with idempotent start request and synchronized countdown.
- **Error states:** Player disconnected, readiness changed, invalid config, duplicate start, server failure.
- **Recovery actions:** Return to authoritative lobby state, re-ready, retry same start intent.
- **Exit conditions:** Active game for all authorized clients or lobby with clear failure.
- **Mobile considerations:** Prevent duplicate tap; keep screen awake guidance for host if relevant.
- **Desktop considerations:** Countdown and roster status visible simultaneously.

### 16.16 Player disconnects

- **Entry condition:** Active online player loses realtime connection or heartbeat.
- **User goal:** Remaining players understand status; disconnected player can return fairly.
- **Main happy path:** Server marks disconnected → room shows reconnect grace countdown → game pauses or applies game-specific timer policy → player returns and resyncs.
- **Decision points:** Pause versus continue, bot replacement, AFK default action, forfeit threshold.
- **Alternate paths:** Player intentionally leaves; grace expires; repeated disconnect policy.
- **Empty states:** Not applicable; status is represented in roster/turn indicator.
- **Loading states:** Remaining clients await authoritative policy decision, not local timers alone.
- **Error states:** Inconsistent presence, replacement fails, room service partition.
- **Recovery actions:** Server reconciliation, bot replacement, controlled abort/no-contest where fairness cannot be preserved.
- **Exit conditions:** Player reconnected, replaced, forfeited, or match terminated.
- **Mobile considerations:** Handle background suspension and network switching; prominent return-to-match notification.
- **Desktop considerations:** Nonblocking status panel unless the game must pause.

### 16.17 Host disconnects

- **Entry condition:** Host loses connection in lobby or active room.
- **User goal:** Preserve the room/match without arbitrary loss.
- **Main happy path:** Server starts grace period → transfers lobby ownership to eligible member under deterministic policy if grace expires; active gameplay authority remains server-side regardless of host.
- **Decision points:** Transfer order, host-only settings lock, room dissolution when empty.
- **Alternate paths:** Host reconnects before transfer; host intentionally leaves; no eligible successor.
- **Empty states:** Empty room expires after retention window.
- **Loading states:** “Host reconnecting” with countdown; controls reflect temporary lock.
- **Error states:** Simultaneous disconnects, transfer race, stale client claims.
- **Recovery actions:** Server selects owner by authoritative seat/join order; clients resync RoomState.
- **Exit conditions:** Host restored/transferred, room expired, or match continues unaffected.
- **Mobile considerations:** Ownership notification must be explicit and not rely on toast alone.
- **Desktop considerations:** New host actions appear only after server confirmation.

### 16.18 Reconnect and resync

- **Entry condition:** Prior participant has room identity/reconnect token but connection is stale.
- **User goal:** Return to the exact authorized state without duplicate actions or secret leakage.
- **Main happy path:** Open reconnect overlay/route → authenticate token → send last acknowledged sequence/state version → server returns snapshot or deltas plus recipient-specific private projection → client discards stale pending UI → acknowledge → resume.
- **Decision points:** Resume seat versus spectator if replacement became permanent; abandon.
- **Alternate paths:** Token refresh/sign-in; match already finished; lobby returned.
- **Empty states:** No reconnectable match; show history/home, never infinite spinner.
- **Loading states:** Connection, authentication, snapshot download, validation, render-ready stages.
- **Error states:** Expired token, seat forfeited, version mismatch, corrupt payload, server unavailable.
- **Recovery actions:** Retry with backoff, update, reauthenticate, view result, support/reference ID.
- **Exit conditions:** Active synchronized room, result/lobby, or explicit unrecoverable state.
- **Mobile considerations:** Survive app background and network handoff; concise data use.
- **Desktop considerations:** Multi-tab ownership policy prevents two tabs submitting for one seat.

### 16.19 Finish match

- **Entry condition:** Authoritative engine reports terminal result.
- **User goal:** Understand outcome and what happens next.
- **Main happy path:** Freeze inputs → resolve final events → show winner/rank/reason → persist result → show stats/rewards eligibility → offer rematch, replay, lobby/home.
- **Decision points:** Rematch, replay, report player, share result, leave.
- **Alternate paths:** Draw, abandonment, no-contest, offline local result.
- **Empty states:** No rewards for guest/offline/aborted match; explain rather than blank panel.
- **Loading states:** Result persistence/reward calculation shown separately from already-known outcome.
- **Error states:** Reward/history persistence fails while result remains authoritative.
- **Recovery actions:** Retry background sync; provide receipt/reference; never replay match to regenerate result.
- **Exit conditions:** Rematch vote, replay, lobby, history, or home.
- **Mobile considerations:** Outcome first; secondary statistics collapsible; respect reduced motion.
- **Desktop considerations:** Board can remain visible behind summary with keyboard focus trapped appropriately in dialog/screen.

### 16.20 Rematch

- **Entry condition:** Finished match and rematch is supported.
- **User goal:** Replay quickly with understood roster/rules.
- **Main happy path:** Select Rematch → server records vote → all required players accept → new match/session ID and fresh authoritative random state → start.
- **Decision points:** Same rules/roles, rotate first player, replace leavers with bots, return to lobby to edit.
- **Alternate paths:** Partial acceptance; invitation to replacement; offline immediate rematch.
- **Empty states:** No other eligible players; offer bots/new matchmaking/home.
- **Loading states:** Vote status and expiry countdown.
- **Error states:** Player left, room expired, eligibility/version changed, duplicate creation.
- **Recovery actions:** Return to lobby, create new room, queue again.
- **Exit conditions:** New match, lobby, or result screen expiration.
- **Mobile considerations:** Avoid accidental rematch from double tap; clear new-game boundary.
- **Desktop considerations:** Display each participant’s vote status without pressuring private decline reasons.

### 16.21 Return to lobby

- **Entry condition:** Private-room match ended and room retention policy permits reuse.
- **User goal:** Reconfigure or socialize without recreating the room.
- **Main happy path:** Choose Return to lobby → server clears match-specific state, preserves eligible members/room identity → all clients receive lobby projection → readiness resets.
- **Decision points:** Keep/change rules, seat, bots, spectators.
- **Alternate paths:** Host closes room; individual leaves; rematch directly.
- **Empty states:** Only one member remains; show invite and bot options.
- **Loading states:** Match-to-lobby transition with authoritative room version.
- **Error states:** Room expired/closed, ownership transfer pending.
- **Recovery actions:** Create replacement room with copied settings or return home.
- **Exit conditions:** Lobby ready flow, new invitation, or room exit.
- **Mobile considerations:** Clear that game private view is gone before lobby appears.
- **Desktop considerations:** Preserve lobby chat only if retention/moderation policy allows.

### 16.22 Save and resume offline match

- **Entry condition:** Active offline match and persistent storage is available or requested.
- **User goal:** Leave safely and continue exactly later.
- **Main happy path:** Autosave each accepted transition plus periodic snapshot → pause/exit confirms saved timestamp → Saved Games lists local badge → resume validates envelope/version/checksum, migrates, replays pending actions, opens room.
- **Decision points:** Autosave on/off only if product permits; overwrite versus duplicate; account sync.
- **Alternate paths:** Manual save slot, export replay/save, session-only play.
- **Empty states:** No saves; explain autosave and start new match.
- **Loading states:** Save write, migration, replay verification; progress for large histories.
- **Error states:** Quota, denied storage, corrupt JSON, unsupported version, failed migration, conflicting tabs/cloud copy.
- **Recovery actions:** Retry, free space, export raw record, restore previous snapshot, duplicate conflict, delete only with confirmation.
- **Exit conditions:** Confirmed saved exit, resumed active match, recovery route, or explicit unsaved continuation.
- **Mobile considerations:** Autosave on visibility change; warn that browser data clearing removes guest saves.
- **Desktop considerations:** Multi-tab lease/lock and “open in another tab” resolution.

## 17. Permissions and visibility model

### 17.1 Roles

| Role | Core permissions | Restrictions |
|---|---|---|
| Anonymous visitor | Browse public content, enter auth, open invite preview | No room/game state without authorized identity |
| Guest player | Offline/local play; policy-approved private room actions; local saves | No durable social/progression; rate-limited online actions |
| Account player | Eligible rooms/matchmaking, social, durable progression/inventory | Subject to room seat, moderation, and entitlement policies |
| Room host/owner | Configure lobby, invite, manage bots, start when valid, transfer/close under policy | Cannot alter active authoritative game or inspect secrets |
| Room member/player | Occupy seat, ready, submit action intent when authorized | Cannot start/configure unless role permits |
| Spectator | Receive spectator-safe public projection and public log | No player actions or hidden state |
| Moderator/support | Policy-defined moderation/audit tools | Secret game data access should be minimized, audited, and purpose-bound |
| Server | Validate identity/actions, own room/game state, generate randomness, project private/public views, determine result/rewards | Must not broadcast unrestricted full state |

### 17.2 Visibility rules

- UNO: each player receives their own hand; opponents/spectators receive hand counts only. Drawn card identity is private unless played.
- Ludo: board/piece/dice results are public; server generates dice results online.
- Monopoly-like: cash/property/position are public if product rules say so; private event choices/cards remain recipient-only.
- Werewolf: roles, investigation results, night choices, and role-specific knowledge are private projections. Public state contains only permitted phase, alive/eliminated status, public votes/logs, and announced outcomes.
- Replays inherit visibility policy. A full-information replay is available only after a policy-defined reveal point and never by default for hidden-role games.
- Analytics, logs, crash reports, and client caches must exclude unauthorized private state.

## 18. Failure and recovery framework

| Failure | User-facing state | Recovery |
|---|---|---|
| Offline during discovery | Cached/offline catalog and mode badges | Continue offline or retry |
| Offline during room create/join/queue | Preserve form/code/ticket identity | Reconnect and retry idempotently; offer offline mode |
| Invalid/expired room code | Specific non-sensitive explanation | Re-enter/request link/browse |
| Room full or started | Current room status | Spectate if allowed, waitlist not assumed, request new room |
| Client/server version mismatch | Update-required screen | Refresh/update; preserve room intent |
| Stale action | Keep authoritative board; explain state advanced | Apply snapshot/delta and let player act again if still eligible |
| Duplicate action | No duplicate effect | Return original acknowledged result by idempotency key |
| Realtime disconnect | Persistent reconnect overlay with consequences | Automatic backoff, manual retry, abandon under policy |
| Host loss | Grace/transfer status | Restore or transfer server-side |
| Server match failure | Pause/recovery/no-contest status | Restore snapshot; abort fairly if integrity cannot be proven |
| IndexedDB unavailable | Session-only warning before play | Enable storage/use supported browser/export when possible |
| Corrupt/incompatible save | Recovery route; preserve raw data | Previous snapshot, migrate, export, duplicate, delete |
| Local/cloud conflict | Side-by-side metadata, never silent overwrite | Keep local/cloud/both; user or deterministic policy |
| Auth expiry | Non-destructive reauthentication | Refresh/re-sign-in and return to exact intent |
| Reward write failure | Outcome succeeds; reward pending | Background retry/reference ID |
| Private-state projection error | Security-first session halt | Discard payload, reauthenticate/resync; incident logging without secret leakage |

## 19. End-game and rematch behavior

- Results distinguish win, draw, forfeit, abandonment, and no-contest.
- Online result authority is server-only; offline results are local and labeled accordingly.
- Reward eligibility and calculation are separate from the visible outcome.
- Rematch creates a new match ID and random seed; it never resets the old state in place.
- Private rooms may return to a persistent lobby; matchmaking generally returns to a rematch vote or queue.
- A participant who declines rematch can leave silently; no coercive messaging.

## 20. UX metrics and success criteria

Metrics must avoid collecting hidden cards/roles or sensitive room content.

| Objective | Metric | Initial success criterion |
|---|---|---|
| Fast first play | Median first visit → offline match start | ≤60 seconds; P90 ≤120 seconds |
| Setup clarity | Setup completion without validation error | ≥90% |
| Guest accessibility | Guest starts without auth detour | ≥95% of eligible attempts |
| Discovery | Game detail → setup conversion | Baseline, then ≥35% for playable titles |
| Offline reliability | Accepted actions followed by successful autosave | ≥99.9% |
| Resume reliability | Compatible offline saves resumed successfully | ≥99% excluding user-cleared storage |
| Room join | Valid invite/code → lobby success | ≥98% |
| Matchmaking | Queue starts resulting in match or explicit cancel | ≥95%; unknown ticket state <0.1% |
| Ready/start clarity | Eligible lobbies start without support/error | ≥98% |
| Online integrity | Duplicate/stale actions causing incorrect transition | 0 |
| Reconnect | Temporary disconnects recovered within grace period | ≥90%; median resync ≤5 seconds after network return |
| State accuracy | Client/server desync requiring full reload | <0.1% of online matches |
| Completion | Started matches reaching valid terminal state | Track by game/mode; target ≥85% casual sessions |
| Rematch value | Finished private matches starting rematch | Baseline; target ≥25% |
| Accessibility | Critical flows keyboard/screen-reader completable | 100% audited flows; zero critical WCAG blockers |
| Error recovery | Errors with actionable recovery selection | ≥80% for recoverable errors |
| Privacy | Unauthorized secret-state exposure | 0 incidents |

Qualitative validation should include first-time users, families sharing one device, weak-network mobile users, keyboard/screen-reader users, and experienced board-game players.

## 21. Open product decisions

1. Guest eligibility for public matchmaking, ratings, reports, and rewards.
2. Guest-to-account merge scope: saves, settings, local stats, achievements, cosmetics, and conflict rules.
3. Online disconnect policy per game: pause, timer, default action, bot replacement, forfeit, and grace duration.
4. Host transfer order and whether hosts have moderation/kick powers.
5. Spectator availability, consent, capacity, delay, and post-elimination behavior.
6. Local hidden-information solution for UNO and especially Werewolf; whether some combinations are declared unsupported.
7. Matchmaking playlists: casual/ranked, rule variants, region, rating, queue expansion, and penalties.
8. Social scope: friends, recent players, chat, emotes, block/report, parental controls.
9. Commerce launch scope, currencies, refunds, regional/age restrictions, and whether cosmetics affect game readability.
10. Offline outcome progression: purely local, provisional sync, or ineligible for server rewards.
11. Save retention, slot limits, cloud quota, autosave frequency, and conflict policy.
12. Replay visibility and retention, especially full-information Werewolf replays.
13. Supported languages at launch and product terminology for Vietnamese game names.
14. Branding/licensing for UNO and Monopoly-like content.
15. Exact rule variants for all games, including unresolved UNO challenge/stacking/UNO-call behavior.
16. Accessibility commitments for turn timers and competitive fairness accommodations.

## 22. Risks and mitigations

| Risk | Impact | Recommended mitigation |
|---|---|---|
| Platform breadth before core shell stability | Fragmented UX and slow delivery | Ship shared discovery/setup/session/recovery patterns with UNO before adding games |
| Hidden-state leakage | Severe trust/security failure | Server-side recipient projections, contract tests, payload audits, no full-state client object |
| Client authority accidentally retained online | Cheating/desync | Intent-only client protocol; server engine/randomness/result/reward authority |
| Offline/online models diverge | Duplicate logic and inconsistent rules | Reuse framework-free engine with distinct authority/persistence adapters |
| Save corruption/version drift | Lost progress | Versioned envelopes, checksums, snapshots, migrations, quarantine/export, compatibility tests |
| Local multiplayer privacy failure | Exposed hands/roles | Neutral handoff screens, explicit reveal, supported-mode restrictions |
| Host-centric architecture | Match loss on host disconnect | Server owns room/match; host is a permission role only |
| Reconnect race/duplicate actions | Incorrect state | Idempotency key, action sequence, state version, stale rejection, snapshot/delta resync |
| Weak initial design system | Inconsistent inaccessible screens | Approve tokens/components/states in Phase 2 before expanding routes |
| Mode ambiguity | Users enter unsupported flow | Availability matrix and reason-specific disabled states on card/detail/setup |
| Low online population | Long queues | Private rooms and bots first; launch playlists narrowly; honest estimates |
| Harassment/abuse in social play | User harm | Limit initial communication, account gates, report/block/moderation design |
| Branded-game licensing | Legal/release risk | Legal review; use configurable generic branding where required |
| Current prototype/document drift | Wrong assumptions propagated | Add ADR/status ownership in a later documentation phase |
| Mojibake/localization defects | Reduced trust and Vietnamese-language errors | UTF-8 content pipeline and localization QA before UI content expansion |

## 23. Recommended order for later design phases

1. **Phase 2 — Design System:** brand foundations, semantic color/type/spacing/motion/audio tokens, accessibility rules, responsive grid, component states, game-surface primitives, and content style.
2. **Phase 3 — Platform information architecture and wireframes:** Home, catalog, game detail, setup, global navigation, saves, profile/settings, and unavailable states.
3. **Phase 4 — Offline UNO experience:** tutorial, setup, game room, Wild color choice, pause/autosave, save management, recovery, result, replay, and local multiplayer handoff.
4. **Phase 5 — Online room and connection UX:** create/join/invite, lobby, ready/start, authoritative pending action, reconnect/resync, host transfer, result/rematch.
5. **Phase 6 — Authentication, guest upgrade, and data sync UX:** sign-in, account conversion, cloud saves, conflicts, history, privacy, security messaging.
6. **Phase 7 — Matchmaking and social safety:** queue, cancellation, acceptance, rating/playlist explanation, friends/invites, report/block/moderation.
7. **Phase 8 — Progression and optional commerce:** statistics, achievements, inventory, rewards, store/checkout only after business approval.
8. **Phase 9 — Game-specific UX expansions:** Ludo, Monopoly-like, then Werewolf with a dedicated hidden-information threat model and research round.
9. **Phase 10 — Validation and hardening:** usability studies, accessibility audit, weak-network/reconnect tests, localization, privacy/security review, and analytics verification.

## 24. Approval checkpoint

Phase 1 defines product scope, UX journeys, route recommendations, state boundaries, permissions, metrics, risks, and open decisions. It does not authorize route/component implementation or architecture changes.

Approval should confirm at minimum:

- Guest and account boundaries.
- Initial online/private-room scope.
- Local hidden-information policy.
- Spectator policy by game.
- Reconnect/host-transfer principles.
- Commerce inclusion or deferral.
- The proposed route taxonomy and later-phase order.

**Explicit gate:** Approval is required before beginning Phase 2 — Design System.
