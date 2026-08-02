# Phase 4 — Reusable Game Room Specification

Status: implemented only as a local mock lobby vertical slice. This document reuses Phase 1 product journeys, Phase 2 tokens/accessibility, and Phase 3 AppShell/navigation. It does not define game rules or a production realtime service.

## Goals and room types

Rooms move a configured group safely to an authoritative game-session handoff. Critical state—owner, slots, ready requirements, settings impact, connection, and start progress—is always visible, text-labelled, and recoverable.

| Room type | Purpose | Authority / availability |
|---|---|---|
| `OFFLINE_BOT_SETUP` | one local human configures bots/rules and starts immediately | local engine adapter; no transport |
| `LOCAL_MULTIPLAYER_SETUP` | names/order/pass-and-play privacy acknowledgement | local adapter; hidden-info warning required |
| `PRIVATE_ONLINE_ROOM` | invite/code-based lobby, bot slots, ready, host controls | server authoritative when implemented |
| `PUBLIC_ROOM` | future discoverable room | not approved/implemented |
| `MATCHMAKING_STAGING_ROOM` | short accept/compatibility confirmation | future server-authoritative flow |

## Boundaries and contracts

`RoomState` is public lobby/session metadata only; `GameSetupState` is the submitted game configuration; `DomainGameState` belongs solely to an engine/server game session; `GameUIState` contains drawers, focus and pending UI; `RealtimeConnectionState`, `ChatState`, and `VoiceState` are independent non-authoritative concerns. No room state contains cards, roles, legal actions, random values, or a winner.

```ts
type RoomStatus = "CREATING" | "WAITING" | "READY_CHECK" | "STARTING" | "IN_GAME" | "FINISHED" | "CLOSED" | "EXPIRED";
type RoomType = "OFFLINE_BOT_SETUP" | "LOCAL_MULTIPLAYER_SETUP" | "PRIVATE_ONLINE_ROOM" | "PUBLIC_ROOM" | "MATCHMAKING_STAGING_ROOM";
type ReadyStatus = "NOT_READY" | "READY" | "PENDING" | "NOT_ELIGIBLE";
type PlayerConnectionStatus = "CONNECTED" | "UNSTABLE" | "DISCONNECTED" | "RECONNECTING" | "TIMED_OUT";
interface RoomPlayer { playerId: string; userId?: string; displayName: string; playerType: "HUMAN" | "BOT"; slotIndex: number; readyStatus: ReadyStatus; connectionStatus: PlayerConnectionStatus; isHost: boolean; isGuest: boolean; botConfig?: { difficulty: "EASY" | "NORMAL" | "HARD" | "EXPERT"; personality?: "RANDOM" | "PASSIVE" | "BALANCED" | "AGGRESSIVE" | "DEFENSIVE" }; }
interface RoomState { roomId: string; roomCode: string; roomType: RoomType; gameSlug: string; status: RoomStatus; visibility: "PRIVATE" | "PUBLIC"; hostPlayerId: string; players: RoomPlayer[]; spectators: { spectatorId: string; displayName: string }[]; settings: Record<string, unknown>; permissions: Record<string, boolean>; version: number; createdAt: string; expiresAt?: string; }
interface RoomCommand<T> { requestId: string; roomId: string; expectedRoomVersion: number; type: string; payload: T; }
```

For online rooms every join/leave/slot/host/ready/bot/rule/kick/start/reconnect command carries a request ID and expected room version. Server acknowledgement returns accepted/rejected, current version, safe code/message and snapshot/patch when required. The UI may show a pending state; it never trusts itself for permission, capacity, start, host identity, or session creation.

## Routes and layout

| Route | Purpose / access | refresh, invalid/reconnect, mobile |
|---|---|---|
| `/rooms/create` | choose configured game and create private room; guest allowed by policy | retain draft locally; offline explains unavailable; stacked form |
| `/rooms/join` | code/invite entry | invalid/full/password/version states without private leak; large code input |
| `/rooms/[roomCode]` | lobby snapshot | snapshot/refetch online; expired→home, reconnect→overlay; slots then sticky action |
| `/rooms/[roomCode]/settings`, `/invite`, `/reconnect` | contextual drawer/deep-link targets | permission/room-version checked; sheets on mobile |
| `/matchmaking/ready` | future confirmation only | no editable lobby |
| `/play/offline/[gameSlug]/setup`, `/play/local/[gameSlug]/setup` | local setup | reload keeps draft only; explicit privacy warning |

Desktop: header with back/game/code/connection/settings/leave; player slots and configuration in main column, chat/invites optional side panel, sticky requirements/start footer. Tablet collapses chat/settings. Mobile prioritises room code, vertical slots, requirements and sticky Ready/Start; settings/invite/chat are labelled sheets. No miniaturised slots.

## Components

`GameRoomShell` composes public lobby data; `RoomHeader` owns code copy/share feedback; `PlayerSlotGrid`/`PlayerSlot` render empty, reserved, joining, human, ready, bot, disconnected, reconnecting, kicked, spectator, locked without colour-only cues; `BotPlayerSlot` exposes permitted configuration; `RoomRequirementsList` explains start readiness; `ReadyControl` and `StartGameControl` show pending/disabled reason; `RoomSettingsDrawer`, `InvitePlayersDrawer`, `LeaveRoomDialog`, `KickPlayerDialog`, `TransferHostDialog`, `RoomChatPanel`, `EmotePicker`, `VoiceStatusBadge`, `ReconnectOverlay`, `GameStartingOverlay`, and `RoomErrorState` are all game-agnostic. Dialogs and sheets require focus trap/return; all actions retain 44px targets and visible focus.

## Permissions and ready/start rules

| Capability | Host | player/guest | spectator | bot | moderator/system |
|---|---:|---:|---:|---:|---:|
| edit room/rules, bots, capacity, visibility | yes | no | no | no | yes |
| invite / send chat-emote / local mute-report | yes | policy / yes / yes | policy / yes / yes | no | yes |
| ready / leave | yes / yes | yes / yes | no / yes | no | yes |
| kick, transfer host, cancel, start | yes | no | no | no | yes |

Material settings changes (rules, player count, bot/teams/color conflicts, version) revoke ready with an announcement. Start requirements: host permission, waiting/ready-check status, min/max roster, eligible humans ready, valid configuration/bots/team/colors, compatible version/assets and stable server connection. The mock demonstrates this explanation but does not claim server validation.

## Rules, bots, identity, invites and moderation

Game capabilities declare supported bot count/personality, spectators, voice, timer, teams and hidden information. Rule metadata uses labelled BOOLEAN/NUMBER/SELECT/MULTI_SELECT/DURATION/RANGE fields, presets and invalid-combination validation; important summary stays visible and details live in a settings drawer. Player identity uses label, icon/pattern and slot number in addition to colour; unavailable/conflicting selection has a textual reason.

Invite UI exposes friends/recent/code/link/share, pending/accepted/declined/expired/full/started states, cooldown and duplicate prevention. Preview reveals only safe public fields until authorization. Kick needs confirmation and server response; kicked players receive reason where allowed plus Home/report-host path. Block/report remains an account moderation handoff.

Chat is public lobby content with pending/failed/rejected/rate-limited/disconnected states; no automatic readout for every message, configurable polite summaries, local mute and keyboard-safe input. Emotes have label/cooldown/mute/reduced-motion alternative. Voice is UI-only: unavailable/disabled/muted/active/speaking/permission denied/device/server-muted/local-muted, not WebRTC.

## Recovery and handoff

Disconnect retains slot for policy grace period and shows a labelled state; it does not immediately kick. Reconnect: transport → authentication → membership → snapshot/version compare → discard stale commands → restore slot → recompute ready → announce outcome. Host migration is server-selected: connected eligible authenticated human, longest eligible connection, never spectator/bot unless system-managed; broadcast new host then permissions. Game start: request → server validate → lock → create authoritative session/initial state → send handoff; clients preload non-optional assets and navigate. Failure leaves the lobby/retry path. No client creates game state.

## Feedback, accessibility and analytics

Use component-level pending UI for joining, bot/rule/ready updates and chat; full skeleton only for room snapshot. Empty states offer Invite players/Add bot/Configure rules; errors include title, safe retry, fallback Home, diagnostic code and safe-retry status for creation/join/code/password/permission/stale version/bot/rule/ready/start/reconnect/version/chat/voice errors. Announce joins, ready reset, disconnect, host change and code-copy politely; do not over-announce transient quality changes. High contrast, reduced motion, text scaling and non-colour signals inherit Phase 2.

Recommended privacy-safe events: `room_create_started|created|create_failed`, `room_join_started|joined|join_failed`, `room_code_copied`, `invitation_sent|accepted`, `bot_added|removed|difficulty_changed`, `room_rule_changed`, `player_ready_changed`, `room_start_requested|succeeded|failed`, `player_disconnected|reconnected`, `host_migrated`, `room_left`, `player_kicked`. Never log passwords, tokens, private chat, hidden game state, or sensitive data.

## Mock vertical slice and risks

Implemented: an explicitly labelled local mock private lobby with room-code copy, host/guest/bot slots, ready toggle, difficulty update, add/remove bot, requirements, loading/error/empty examples and game-start handoff message. It uses isolated local UI state and contains no Socket.IO, auth, invitation delivery, chat persistence, voice or game engine.

Risks/open decisions: guest room policy, password/room-code format, invite expiry/rate limits, lobby persistence, public-room approval, host migration grace/eligibility, bot capability per game, voice/spectator policy, full rule schemas and server error codes. Phase 5 readiness requires a server-authoritative game-session API, stable room capabilities and handoff contract; player order/identity/bot/rule/color and reconnect state are specified, but no game UI begins here.
