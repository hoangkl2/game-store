# Game Store — Phase 3 Global Screens Specification

Status: implementation-ready; scope is global screens and one offline discovery vertical slice only. Phase 4 game-room work is explicitly excluded.

## 1. Repository audit and Phase 2 acceptance

### Confirmed facts

- The web app is Next.js 15 App Router with React 19, strict TypeScript, Tailwind 4, Shadcn-compatible aliases, and a root layout.
- The pre-Phase-3 `/` route is a client UNO prototype; it has no platform shell, catalog, loading/error boundaries, or route groups.
- Phase 2 provides semantic CSS variables in `packages/ui/src/styles.css`, Tailwind mappings in `app/globals.css`, a ThemeProvider, Be Vietnam Pro body typography, light/dark/system/high-contrast modes, reduced-motion CSS, player identities, and accessible Button/Input/Card/Badge/Avatar/Progress/Skeleton primitives.
- Phase 2 validation is green: typecheck, lint, unit tests, and Playwright preview smoke. The audit additionally corrected contrast, high-contrast precedence, visible focus, disabled/loading behavior, Vietnamese mojibake, and non-color player indicators.
- There is no Auth, Socket.IO, backend room, navigation state store, game catalog API, audio engine, or global loading/error boundary. Zustand is installed but no application store is implemented.
- UNO engine, bot, persistence adapter, and tests are framework-independent. They remain outside this phase.

### Reusable now / missing

| Reuse now | Add in Phase 3 vertical slice | Deferred |
|---|---|---|
| ThemeProvider, tokens, Button, Input, Card, Badge, Avatar, Progress, Skeleton, `cn`, Lucide | AppShell, header/nav, page headers, GameCard/Grid, PlayModeCard, empty/error/loading states, local catalog adapter, settings navigation shell | Auth form, dialogs/sheets, menus, notifications, social, room lobby, networking, analytics client, commerce |

### Conflicts, assumptions, decisions

- **Conflict:** the existing `/` UNO prototype conflicts with the product home. Preserve it at `/play/uno`; this is a route relocation only, not a rules/UI rewrite.
- **Temporary assumption:** catalog data is local, clearly labelled prototype data; only UNO is playable. Property Empire, Royal Race, Color Clash, and Moon Village are planned entries.
- **Unresolved:** guest public-match eligibility, guest-to-account merge, regional matchmaking, spectator policy per game, commerce launch, social moderation, and real game artwork licensing.

## 2. Information architecture, state boundaries, and navigation

### Global navigation model

Desktop AppShell: brand → Home, Games, Play, Friends, Leaderboard, Rewards, Shop; right utility area → connection status, notifications, profile, settings. Mobile bottom navigation exposes Home, Games, Play, Friends, Profile; secondary destinations move to the profile menu or labelled More drawer. Active route uses text, icon, selected surface, and `aria-current="page"`; unread count has a text alternative. Online-only destinations remain visible but disabled with a reason and account/offline recovery path.

Keyboard: Skip link is first focusable element; Tab follows visual reading order; Enter/Space activates controls; Escape closes future menus/sheets; route changes focus the page H1; a closing modal returns focus to its opener. Connection state uses a polite live region and never conveys gameplay secrets.

### State boundaries

| State group | Ownership / examples | Must not contain |
|---|---|---|
| AuthState | session status, account ID, entitlement summary | game state or credentials in UI storage |
| GuestProfileState | device guest ID, display name, local-only marker | cloud authority |
| NavigationState | current route UI, drawer/menu open state | server room state |
| GameCatalogState | public metadata, availability, cached fetch status | game rules/state |
| SocialState / NotificationState | public profile summaries, invitation metadata | private chat or secret roles |
| SettingsState | theme, contrast, motion, text/control preferences | authoritative match settings |
| CommerceUIState | product listing/loading/confirmation UI | purchase authority |
| RealtimeConnectionState | transport status, retry stage, quality | legal actions or winners |
| SavedGameMetadataState | local save IDs, titles, timestamps, corruption state | full DomainGameState in navigation stores |

Online gameplay stays server-authoritative. Client global UI never chooses randomness, legal actions, hidden data, turn transitions, results, or rewards.

## 3. Route map

| Group | Route | Access | Primary action | Redirect / unavailable behavior | Mobile navigation |
|---|---|---|---|---|---|
| Public | `/` | all | Start / continue play | guest dashboard fallback when no session | Home tab |
|  | `/games` | all | Browse/select game | cached catalog or offline-only filter | Games tab |
|  | `/games/[slug]` | all | context-aware play action | unknown → not found; unavailable mode explains why | Games tab |
|  | `/leaderboard` | all, data may need account | choose scope | offline cached explanation | More |
|  | `/maintenance`, `/update-required` | all | retry/update | system route only | system full-screen |
| Auth | `/auth`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/callback` | public | continue/sign in | authenticated → `/`; offline → guest option | full-screen |
| Entry | `/play`, `/play/offline`, `/play/local`, `/play/online`, `/guest-profile` | mode dependent | select game/mode | account/network gate retains selection | Play tab |
| Online | `/rooms/create`, `/rooms/join`, `/matchmaking`, `/invitations`, `/friends` | network; account where required | create/join/queue/respond | offline → `/offline`; restricted → auth explanation | Friends tab / More |
| Player | `/profile`, `/profile/[userId]`, `/achievements`, `/daily-rewards`, `/inventory`, `/shop`, `/match-history`, `/saved-games` | mixed | view/manage | guest limitation state | Profile / More |
| Settings | `/settings` and `/settings/{general,audio,graphics,gameplay,accessibility,privacy}` | all | change local preference | unsupported controls explain capability | Profile / More |
| Recovery | `/offline`, `/connection-lost`, `/reconnecting`, `/session-expired`, `/error` | all | retry, continue offline, sign in | destructive actions confirm | system full-screen |
| Existing handoff | `/play/uno` | all | play existing offline UNO | no save → normal new match | not in global primary nav |

## 4. Shared layouts and components

| Layout | Header/nav | width and responsive behavior | loading/error |
|---|---|---|---|
| PublicMarketingLayout | compact logo, sign-in, guest CTA | readable max; stacked mobile | route skeleton/system error |
| AuthLayout | minimal logo/back | narrow form panel; no app navigation | inline auth error |
| AppDashboardLayout | full AppHeader + desktop sidebar / mobile bottom nav | content max token, responsive sections | retain cached shell and replace only body |
| FullWidthDiscoveryLayout | app shell + search/filter bar | full bleed hero, contained grid; filters become sheet | grid skeleton/no-results |
| DetailPageLayout | breadcrumbs + contextual action | two-column desktop, action sticky below hero on mobile | hero/action skeleton |
| SettingsLayout | app shell + settings side nav | sidebar ≥1024, stacked links below | section skeleton/error |
| SocialLayout | app shell + section tabs | list/detail split ≥768 | list skeleton/retry |
| SystemStateLayout | minimal header, no distracting nav | centered readable panel | explicit diagnostic/recovery |
| MobileBottomNavigationLayout | 5 primary destinations | fixed safe-area bottom bar, desktop hidden | shell remains interactive |

Core component contracts: AppShell composes layout and skip/live regions; AppHeader exposes brand, context, connection and utility actions; DesktopSidebar/MobileBottomNavigation expose labelled route links; PageHeader provides one H1 and actions; GameCard receives public metadata and play/details callbacks; GameGrid owns responsive list semantics; FeaturedGameHero and ContinuePlayingCard use public metadata only; PlayModeCard describes availability and restriction; EmptyState/ErrorState/LoadingState/PageSkeleton preserve heading and useful recovery; SearchInput/FilterBar/SortControl announce result changes; SettingsRow uses labelled native controls. All interactive targets are ≥44px on touch, retain focus, and have a non-color state cue.

## 5. Cross-screen behavior

### Responsive groups

| Viewport | Composition |
|---|---|
| 320–374 | one column, condensed header, 44px controls, bottom nav; low-priority metadata deferred |
| 375–767 | one column, horizontal card rails when useful, filters in sheet |
| 768–1023 | two-column discovery/grid where scanning improves; side panels may become drawers |
| 1024–1439 | sidebar AppShell, 2–3 card grid, persistent detail actions |
| 1440–1919 | 3–4 card grid within content max, optional contextual rail |
| 1920+ | wider gutters only; preserve readable text and card widths |

### Loading, empty, and error strategy

- Use route skeleton only when no cached structure exists; use section skeleton for dashboard/catalog cards; inline spinner only for a single pending action; show meaningful stages for boot/reconnect.
- Empty states: no recent/saved games → browse games; no invitations → invite friends; no friends → explain account requirement/search; no achievement/inventory/history/data → relevant discovery action; no online mode/internet → offline play.
- Errors include title, plain explanation, safe retry status, fallback, diagnostic ID, and whether retry is safe. Cover network, authorization, unavailable service, version mismatch, unsupported browser, storage failure/corruption, maintenance, update-required, rate limit, and unexpected error.

### Analytics recommendations

Events: `app_opened`, `continue_as_guest_selected`, `login_started`, `game_library_viewed`, `game_detail_viewed`, `play_mode_selected`, `offline_game_started`, `room_creation_started`, `room_join_submitted`, `matchmaking_started`, `matchmaking_cancelled`, `invitation_accepted`, `daily_reward_claimed`, `shop_item_viewed`, `settings_changed`, `reconnect_started`, `reconnect_succeeded`, `reconnect_failed`.

Each records timestamp, anonymous/session-safe actor type, route, public game slug/mode, UI outcome, and coarse capability/network state only. Never record cards, roles, room passwords/codes, private chat, raw user content, precise location, or unapproved identifiers. Analytics is recommendation-only in this phase.

## 6. Required global screen specifications

All screens use one H1, PageHeader where applicable, visible focus, labelled controls, polite loading/error announcements, and focus restoration. `Guest` means device-local identity; `Account` means authenticated durable capability.

| Screen | Goal, hierarchy, primary / secondary actions | States, access, and responsive notes | Events / decisions |
|---|---|---|---|
| Splash / boot | Brand, short readiness stage, then immediate route handoff. | First visit checks assets/version/offline; returning session checks saved metadata; corrupt local state → recovery. Reduced motion uses static progress. | `app_opened`; boot/version policy unresolved. |
| Login and guest access | Guest CTA first; sign in/register second; terms/privacy links. | Guest offline remains available; account limits shown at selection, not as a gate. Narrow AuthLayout on all sizes. | `continue_as_guest_selected`, `login_started`; guest merge unresolved. |
| Home dashboard | Greeting/status → Continue playing → featured/recent → bots/private room/join/queue → invitations/friends/rewards. | Guest hides social/progression with useful upgrade explanation; no history uses featured offline play. Mobile one-column priority order. | `home_viewed`; personalization policy unresolved. |
| Game library | Search, filters, sort, featured, game grid. | Offline filter preserves locally playable games; no results offers clear filters; mobile filters are bottom sheet. | `game_library_viewed`; catalog source/versioning unresolved. |
| Game detail | Hero → description/rules/modes → accessibility → contextual action. | Continue save > offline > bots > create room > find match based on available context. Planned games show waitlist/unavailable explanation. | `game_detail_viewed`, `play_mode_selected`; art licensing unresolved. |
| Create room entry | selected game then privacy/rules/capacity/bots/timer/spectator/voice/region. | Auth/network policy shown before submit; no private info leaks. Mobile uses sections and sticky Create. | `room_creation_started`; room fields/region/voice unresolved. |
| Join room | room-code input/paste → authorized preview → password if needed; invitations/recent rooms. | Invalid/full/expired/version/restricted each give retry or offline option; deep links never reveal private metadata pre-auth. | `room_join_submitted`; QR/deep-link policy unresolved. |
| Matchmaking | game/mode/rank/player/region → queue status → confirmation. | One active queue maximum; unstable/offline disables queue without losing selection; background behavior is explicit. | start/cancel; guest ranked eligibility unresolved. |
| Friends | online/in-game/offline/pending/recent lists and search. | Guests receive account requirement panel; account actions have confirm/report/block paths. Mobile list-first. | social events; moderation policy unresolved. |
| Invitations | room/friend/match cards with expiry and accept/decline. | During gameplay, passive notification only; expired/full/started state explains failure and restores focus. | accept/decline; invite expiry unresolved. |
| Profile | identity, level/XP, favorites, stats/activity/achievements/rank, privacy/social actions. | Guest profile marks device-local data and account upgrade value; private sections follow viewer permission. | profile viewed; privacy matrix unresolved. |
| Achievements | categories, unlocked/in-progress/hidden, rarity/progress/reward. | New user empty state starts a game; hidden details do not leak. Mobile filters as sheet. | achievement viewed; guest durability unresolved. |
| Leaderboard | scope tabs, rank table, current-user position, season explanation. | Clearly labels casual vs competitive; cached data marked stale; pagination/virtualization for long lists. | leaderboard viewed; ranking/region policy unresolved. |
| Daily rewards | calm calendar, streak, today, claim, future/missed policy. | Guest restriction and offline claim status are clear; reward animation handoff obeys reduced motion. | claim; reward economics unresolved. |
| Shop | cosmetic-first categories, balance, preview, owned/locked, confirmation. | No real-money flow; guest sees account requirement; error never charges optimistically. | shop item viewed; commerce approval unresolved. |
| Inventory | owned/equipped filters, preview/equip/unequip. | Empty inventory links shop/achievements; unsupported version explains non-destructive recovery. | inventory viewed; duplicate policy unresolved. |
| Settings hub | General, account, audio, graphics, gameplay, accessibility, notifications, privacy, storage, about/legal. | Sidebar desktop, stacked links mobile; controls are capability-aware and persist only local UI preferences. | settings changed; persistence strategy unresolved. |
| Audio settings | volume/mutes/notifications/devices/captions/autoplay notice. | Show unsupported controls as explanatory disabled state; no audio engine implementation. | settings changed; device support unresolved. |
| Graphics settings | quality/effects/glass/performance/frame/fullscreen recommendation. | Never offer unavailable runtime controls; reduced-motion remains accessibility-owned. | settings changed; capability detection unresolved. |
| Accessibility settings | contrast/motion/color-blind/text/control size/keyboard hints/live announcements/captions/timer/vibration/reset. | Preview changes; all cues have text/pattern alternatives. | settings changed; color-blind presets unresolved. |
| Connection lost | in-context overlay preserves board; state/retry/offline-safe choices/diagnostics. | Online actions disabled, offline continuation only when compatible; no board removal. | reconnect started; disconnect policy unresolved. |
| Reconnect / resync | stage labels: reconnecting, authenticating, room, snapshot, visual replay, ready/failed. | Covers room expired, match complete, bot replacement, kicked, invalid session; focus returns to match on success. | reconnect succeeded/failed; bot substitution policy unresolved. |
| Maintenance | explanation, known availability only, retry, offline games, status/support. | Never fabricate ETA; cache local play where safe. | maintenance viewed; status page unresolved. |
| Update available | optional/required distinction, summary, update/temporary continue/save status/failure. | Explain refresh vs service worker vs incompatible client. | update prompt; release policy unresolved. |

## 7. Allowed vertical slice and file plan

Implement only Home → Games → Game detail → Offline-play handoff, plus shared navigation, loading/empty/error states, and settings navigation. Use local catalog data; only UNO action is live. No auth, social, online, room, gameplay change, or Phase 4 implementation.

Proposed files: `app/page.tsx`, `app/games/page.tsx`, `app/games/[slug]/page.tsx`, `app/play/uno/page.tsx`; `components/layout/{app-shell,app-header,desktop-sidebar,mobile-bottom-navigation}.tsx`; `components/game-catalog/{game-card,game-grid,play-mode-card}.tsx`; `components/feedback/{empty-state,error-state,page-skeleton}.tsx`; `components/settings/settings-navigation.tsx`; `features/game-catalog/catalog-data.ts`; `app/games/loading.tsx`; `app/games/error.tsx`; tests for the slice and this checkpoint. Existing UNO logic is relocated intact.

## 8. Phase 4 readiness checklist

- [x] Game entry, offline handoff, create-room/join-room/matchmaking/invitation concepts defined.
- [x] Shared navigation, global components, recovery and connection states defined.
- [x] State boundaries keep DomainGameState out of global state.
- [x] Room handoff and private-information constraints are documented.
- [ ] Room lobby readiness, host transfer, chat/voice, spectator projection, and authoritative protocol require Phase 4 decisions.

Phase 4 begins only after explicit approval of this specification and checkpoint.
