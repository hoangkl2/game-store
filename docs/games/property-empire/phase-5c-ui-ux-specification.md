# Phase 5C - Property Empire UI/UX Specification

Status: implementation specification; Phase 5B is approved. Phase 1 product/state boundaries, Phase 2 tokens/accessibility, Phase 3 AppShell, Phase 4 authority/handoff, and Phase 5B deterministic offline-session conventions are reused by reference.

## 1. Product goal

Property Empire is an original economic route game in which players travel a growing city, acquire district sites, collect rent, respond to public events, and protect enough liquidity to outlast rivals. Phase 5C ships one honest offline slice against bots and documents, but does not claim to implement, advanced economic systems.

Repository facts: no property-game prototype, economic engine, generic board renderer, timer, zoom/pan, audio adapter, or reconnect overlay exists. Stable reuse is limited to `GameEngine`, injected randomness, AppShell, design tokens/primitives, route handoff, IndexedDB/replay patterns, and accessibility conventions. Royal Race components remain game-local because Property Empire needs selectable tiles, finance panels, pending economic decisions, and transaction history rather than token-selection/home-path APIs.

## 2. Core gameplay loop

| Step | Visible information and action | Validation, feedback, and recovery |
| --- | --- | --- |
| Observe | Active player, cash, estimated net worth, ownership, position, hold/bankruptcy state. | Public snapshot only; reconnect replaces it authoritatively. |
| Roll | Enabled only for the active eligible player in `ROLL`. | Engine commits two dice; Enter/Space activates; no fabricated result. |
| Move | Token follows engine `pathTileIds`; passing Founders' Gate may grant salary. | UI animates the committed destination, not movement rules; reduced motion jumps. |
| Resolve | Property offer, rent, levy, public event, rest, or transit hold. | Engine computes eligibility, payment, event result, and bankruptcy. |
| Decide | Buy or decline only when an engine purchase decision exists. | Price/projected cash come from domain state; rejection retains authoritative state. |
| End turn | End Turn becomes legal after required resolution. | Engine skips bankrupt players, checks remaining players/turn limit, then changes turn or finishes. |

Touch uses 44px controls and a sticky action bar. Keyboard uses Tab, Enter/Space, arrow tile navigation, Escape, L for transactions, and P for pause. Live announcements summarize dice, destination, payment, ownership, hold, bankruptcy, turn, and result without narrating every path step.

## 3. Supported modes

| Mode | Contract |
| --- | --- |
| Offline bots | Implemented: quick two-player and standard four-player presets, configurable bot difficulty/presentation speed, local versioned saves. |
| Local multiplayer | Future pass-and-play adapter; finance is public but device handoff and confirmations require design. |
| Private room / matchmaking | Future Phase 4 handoff. Server owns random values, actions, finance, events, bankruptcy, and winner. |
| Reconnect | Future versioned server snapshot; pending local commands and stale animations are discarded. |
| Spectator | Future public finance/board/transactions only; no economic actions. |

## 4. Game-state boundaries

- `PropertyEmpireDomainState`: players, cash, position, hold/bankruptcy state, property ownership, phase, committed dice, pending purchase, transactions, turn, versions, and ranking.
- `PropertyEmpireUIState`: selected/focused tile, open property/transactions/pause panels, and interaction lock.
- `PropertyEmpireAnimationState`: committed event queue and playback speed.
- `PropertyEmpireAudioState`: mute/caption preferences and future mapping only.
- `GameSessionState`: save ID/status, action history, rules/bot configuration, random snapshots, and safe preferences.
- `RoomState` / `RealtimeConnectionState`: Phase 4; not embedded in domain or offline UI state.
- A future `TradeDraftState` is UI-only and never authoritative.

React may render engine helpers and submit intents. It must not derive movement, landing effects, prices, rent, payments, legal actions, event results, hold transitions, bankruptcy, net worth, ranking, or rewards.

## 5. MVP rules and deferrals

- Two dice, 20 configuration-driven route tiles, pass salary, starting cash, and 2-4 players.
- Original tile types: Founders' Gate, district sites, public dispatches, civic levies, rest spaces, and Transit Hold.
- Unowned affordable sites create `PURCHASE_DECISION`; Buy transfers engine-defined price, Decline leaves it available. Auctions are deferred.
- Landing on another solvent player's site pays configured base rent automatically. No buildings or mortgage modifiers exist in this slice.
- Original dispatch cards adjust cash or send a player to Transit Hold. Hidden draw order is never rendered.
- Transit Hold lasts at most one failed roll: doubles release and move; otherwise the player serves the turn and is released. Paid release/cards are deferred.
- Insolvent mandatory payment causes immediate basic bankruptcy, releases owned sites to the city, and removes the player from turns. Liquidation/trade recovery is deferred.
- One solvent player wins immediately. A configurable turn limit otherwise ranks by engine-computed net worth, then cash, then stable player order.
- No auction, trade, mortgage, building/hotel, free-parking jackpot, doubles extra turn, three-doubles rule, complex creditor transfer, or optional debt management is implemented.

## 6. Board information architecture and layout

The original board is a four-row, five-column serpentine transit map rather than a perimeter property board. Twenty numbered route tiles visibly connect left-to-right, down, right-to-left, and repeat. Each tile exposes sequence, type, name, amount where public, ownership initials/pattern, current tokens, destination state, and keyboard selection.

District groups use original names and pattern labels: Harbor Works/waves, Garden Guild/leaves, Arts Quarter/hatch, and Innovation Belt/dots. Ownership combines player initial, numbered token, border, icon text, and player color. The centerless route keeps every tile readable and avoids copying established board composition.

Desktop uses finance rail + board + selected-property/transaction rail. Tablet stacks finance cards and board with collapsible details. Mobile uses compact finance cards, a full-width adaptive route, selected details below it, and a sticky required-action bar; it does not scale a desktop canvas. Zoom/pan is deferred because this DOM route fits supported widths.

## 7. Player-finance UX

Each panel shows name, human/bot, current cash, engine-estimated net worth, site count, hold state, bankruptcy/rank, and active turn. The implemented slice has no buildings, debt draft, mortgage value, or pending liquidation; those fields are labelled unavailable rather than shown as zero-capability features. During purchase, domain state supplies price and projected cash. During rent/tax, committed transactions show payer, recipient/bank, basis, amount, and actual post-payment balance.

## 8. Token and movement UX

Tokens use player number plus original markers (`V`, `K`, `A`, `N`) and patterns. `TOKEN_MOVED` supplies source, destination, and path IDs. A short destination pulse is presentation-only; reconnect/reduced motion jumps to the committed cell. Multiple tokens may share a tile and remain individually labelled.

## 9. Dice UX

The engine commits `[dieOne, dieTwo]`. Roll is disabled outside `ROLL`, during pause, for bots, bankruptcy, and future pending server acknowledgement. The UI shows both values, total, and a polite result announcement. Doubles have no extra-turn effect in this MVP except release from Transit Hold.

## 10. Property-card UX

The selected tile panel shows site name, group/pattern, purchase price, base rent, owner, ownership marker, and engine-provided eligibility or unavailable reason. Future fields—rent tiers, mortgage/unmortgage, structures, trade availability—are documented placeholders only and are not rendered as active controls.

## 11. Purchase flow

Engine landing resolution opens a domain `PURCHASE_DECISION` with site ID, price, current cash, and projected cash. Buy/Decline are generated legal actions. Accepted Buy commits payment, ownership, transaction, and `PROPERTY_PURCHASED`; Decline commits `PROPERTY_DECLINED`. Stale/insufficient/incorrect-site actions fail without optimistic cash or ownership changes. The next required action is End Turn.

## 12. Auction flow - deferred

Future authoritative auction state requires auction ID/version, eligible bidders, leader, acknowledged highest bid, minimum increment, active bidder or deadline, passed bidders, and no-bid outcome. Bid/Pass remain pending until server acknowledgement; duplicate/stale requests are idempotently rejected. Reconnect restores the current auction snapshot and never replays obsolete bid celebrations. Declining a property does not start an auction in Phase 5C.

## 13. Rent-payment flow

The engine resolves owner, base-rent basis, amount, payer balance, recipient balance, and bankruptcy. `RENT_PAID` and transaction entries display the committed transfer. If funds are insufficient, the basic slice transfers only available cash, marks bankruptcy, releases the payer's sites, and records the shortfall; advanced asset recovery is deferred.

## 14. Trade flow - deferred

Future `TradeDraftState` holds target, offered/requested sites and cash, validation display, and review UI. Submitted trades become authoritative objects with ID/version/status/expiry. Server validation covers ownership, cash, mortgage/building constraints, bankruptcy, stale state, accept/reject/counter/withdraw, and atomic transfer. Drafts are not persisted or exposed to spectators by default. No trade controls are active in Phase 5C.

## 15. Mortgage flow - deferred

Future panels show eligible site, principal, rent suspension, group restrictions, unmortgage fee, projected balance, and confirmation. The engine/server alone determines eligibility and amount. Mortgaged sites require text/icon/pattern board state. Phase 5C has no mortgage state or actions.

## 16. House and hotel flow - deferred

Future building management requires engine-provided complete-group eligibility, even-building rule, supply, cost, current/next rent, sell value, and valid target level. Original structure naming/art is required. Phase 5C uses base rent only and exposes no building affordance.

## 17. Jail / Transit Hold UX

Transit Hold is original terminology. Entry announces source and destination. On the held player's next turn, Roll explains that doubles release and move; a failed roll serves the turn and releases the player. Panels show held/free status and no unsupported fee/card controls. Future advanced choices require engine legal actions and disabled reasons.

## 18. Event-card UX

Original Market Signal and Civic Dispatch cards use package-defined IDs/titles/effects. The engine chooses a card with injected randomness and commits public title/summary plus cash/hold effects. UI may reveal the committed card, never deck order or a speculative draw. Required-choice cards are deferred.

## 19. Bankruptcy UX

The basic committed panel states required amount, paid amount, shortfall, released-site count, and ranking impact in neutral language. Future recovery would enumerate only engine-valid mortgage/build/trade liquidation options and permit bankruptcy confirmation only after no recovery remains. That recovery system is not represented as complete.

## 20. Transaction history

Domain transactions cover salary, purchase, rent, levy, dispatch cash, and bankruptcy. Entries contain stable ID/turn/type/actors/tile/amount/balance summary; animation queues are separate. UI uses a compact ordered list and empty state. Filters/virtualization are deferred until actual volume requires them.

## 21. Player ranking

The engine ranks an immediate survivor or resolves turn-limit standings by net worth, cash, then stable order. Results distinguish cash from estimated net worth and show owned sites. Client-only XP/rewards are never generated.

## 22. Bot behavior visualization

Bots visibly enter a thinking state and then submit one legal engine action. EASY chooses a valid action with controlled randomness; NORMAL protects a cash reserve and considers price/rent; HARD additionally values district completion and game phase. Private scores/future choices are not shown. Fast/normal/relaxed delay affects presentation only.

## 23. Pause, save, and exit

Offline pause cancels bot scheduling and offers Resume, Save, Resume saved, Save and exit, and Exit without saving. Saves include all required versions, serialized domain, action history, board/rules/player/bot configuration, game/bot random snapshots, timestamps, and safe speed preference. Selection, panels, animations, temporary inputs, and focus are excluded. Resume validates, restores random streams, clears stale presentation state, restores the required action, and auto-save may occur after the next committed transition in a later persistence enhancement.

## 24. Reconnect and resynchronization

Future online reconnect keeps the board visible, disables commands, reauthenticates, requests an authoritative versioned snapshot, drops pending/stale intents, and restores identity/turn. It handles movement, purchase, auction, trade, rent, structures, hold, bankruptcy, completion, removal, and version mismatch. Obsolete animations are skipped.

## 25. Spectator mode

Future spectators see public board, ownership, finance summaries, turn, transactions, and ranking. They cannot roll, buy, bid, trade, mortgage, build, or access private drafts. The mode is explicitly labelled and follows Phase 4 projection permissions.

## 26. Results and rematch

Results show winner, full ranking, final cash/net worth, site counts, and public transactions. Advanced statistics—rent collected, auctions, trades, buildings, duration, rewards—appear only when authoritative data exists. Offline Race Again creates a fresh engine/session; online rematch returns to Phase 4 room voting.

## 27. Responsive behavior

Priority: board, required action, active player, finance, selected site, dice, transaction feedback, then secondary panels. The serpentine route changes cell density at breakpoints rather than using canvas scaling. Sticky mobile controls respect bottom navigation/safe area; text wraps at 200% without obscuring actions.

## 28. Accessibility

Semantic route grid/list labels expose tile number/type/name/owner/tokens. Keyboard arrows move among tiles; Enter opens details; all economic actions are native buttons. Focus is visible; pause traps and restores focus. Ownership and players use text/marker/pattern plus color. Touch targets are at least 44px. High contrast inherits semantic/player tokens. Reduced motion makes committed effects immediate. Audio mappings always have text captions. Announcements cover turn, dice total, destination, offer, purchase, rent/tax, event, hold, bankruptcy, and result.

## 29. Animation-event mapping

| Event | Presentation | Normal / reduced / reconnect |
| --- | --- | --- |
| Dice, movement, arrival | settle then destination pulse | 120-280ms / immediate / final tile only |
| Purchase/ownership | tile border and owner marker commit | 200ms / immediate / snapshot only |
| Rent/levy/cash/event | finance delta and transaction emphasis | 180-240ms / immediate / latest balances |
| Hold/bankruptcy/turn/result | status/panel transition | 200-320ms / immediate / current status only |

## 30. Audio-event mapping

Future original sounds map to dice, movement, purchase, payment/gain/loss, dispatch, hold, warning, bankruptcy, turn, victory/defeat, and reconnect. Master/SFX/mute/autoplay/inactive-tab policy and captions apply. No audio asset is included in this slice.

## 31. Component architecture

`PropertyEmpireGameShell` adapts engine/session/events. `PropertyEmpireBoard`, `PropertyTile`, and `PlayerToken` render package data. `PlayerFinancePanel`, `PropertyDetailPanel`, `DiceControl`, `GameActionBar`, `TransactionHistory`, `BotThinkingIndicator`, `PausePanel`, and `ResultPanel` are presentation-only. Future Auction/Trade/Mortgage/Build/Hold/Bankruptcy dialogs consume authoritative props and submit intents. Components derive display formatting only; expensive finance/legal selectors remain engine helpers. Shared extraction requires a proven second consumer and compatible props.

## 32. State-management plan

The compact offline route uses React state for separate domain, UI, animation, audio, session, and connection values; Zustand is unnecessary. A future trade draft may use focused local/form state. Online state uses the Phase 4 adapter, never stores sockets in UI/domain state, and never merges room or connection lifecycle into game state.

## 33. Testing plan

Package tests cover board configuration, deterministic dice/events, movement/pass salary, offer/buy/decline, rent/tax, event cards, hold/release, bankruptcy/winner, turn-limit ranking, immutable transitions, legal actions, bot legality/difficulty, serialization, replay, save versions, and random restoration with at least 90% engine coverage. Browser tests cover catalog/detail/setup, keyboard tile focus, roll/purchase/end-turn, bot turn, pause focus trap, IndexedDB save/resume, deterministic quick result, and mobile board/action reachability. Full typecheck, lint, repository tests, build, and Playwright are required.

## 34. Allowed implementation scope and file plan

Create `packages/game-property-empire` with board, engine, bot, random, storage, and tests; `apps/web/src/features/property-empire/types.ts`; setup/play/loading/error routes; a Playwright flow; this specification; and the Phase 5C checkpoint. Modify only web dependency/lockfile, catalog/detail handoff, and scoped gameplay CSS. Do not add production transport/backend, shared generic board/timer/zoom/audio/reconnect, advanced economy implementations, or Phase 5D files.

## 35. Risks and unresolved decisions

- Final economy tuning, turn limit, salaries, site/rent values, event distribution, and statistics.
- Auction timing, bid increments, trade visibility/expiry, mortgage interest, structure rules/supply, creditor transfer, debt recovery, and advanced hold choices.
- Local pass-and-play, online timeout/AFK/bot replacement, spectator/chat, server persistence cadence, rewards, and rematch policy.
- DOM board density on very narrow devices and whether later visual art creates a genuine zoom requirement.

## 36. Phase 5D readiness checklist

Ready references after validation: game-core adapter, configuration-driven route, finance summary, pending-decision pattern, transaction log, bot/pause/save/replay/results patterns, responsive action rail, accessibility announcements, and Phase 4 authority envelope. Not generalized: board renderer, timer, zoom/pan, audio adapter, reconnect overlay, economic dialogs, or hidden-information projection. Moon Village must separately solve secret roles/private state and must not inherit public-economic assumptions.
