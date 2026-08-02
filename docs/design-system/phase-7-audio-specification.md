# Phase 7 - Audio System Specification

Status: implementation specification  
Scope: shared, offline-safe audio foundation, preferences, captions, development tones, and one safe event mapping per approved game. This extends the approved Phase 1-6 specifications by reference; it does not change game rules, room authority, animation ownership, or begin Phase 8.

## 1. Repository fit and principles

Confirmed repository facts: Next.js 15 App Router, React 19, the Phase 2 semantic token system, and the Phase 6 pure `@game-store/animation-core` package are present. The four game routes contain only local `muted`/`captionsEnabled` presentation placeholders; there is no audio package, Web Audio/Howler use, asset registry, audio preference store, caption controller, or production voice system. Existing engines emit committed events; Moon Village already exposes a public projection boundary.

The audio system is one shared client presentation service. It reacts after a committed public event or viewer-authorized projection, never before it. It is optional, quiet by default until an intentional browser unlock, useful without hearing, bounded in CPU/memory/network use, and never an authority source.

## 2. State and authority boundaries

| State | Owns | Must not own |
| --- | --- | --- |
| `DomainGameState` | rules, random results, legal actions, hidden state, winner, emitted committed events | audio selection, volume, browser runtime |
| `GameUIState` | selection, dialogs, focus, local visual feedback | authoritative events or runtime audio |
| `AnimationState` | disposable Phase 6 command queue | sound timing/instances |
| `AudioPreferenceState` | persisted master/music/SFX/voice toggles and volumes, captions, inactive/reduced-sensory policy | `AudioContext`, nodes, sockets, game decisions |
| `AudioPlaybackState` | disposable unlock/playback/caption/pending-command status | saved game data or authority |
| `RoomState` | public lobby/session metadata | game audio authority, voice runtime |
| `RealtimeConnectionState` | transport and resync status | audio nodes or secret data |
| `VoiceConnectionState` | future placeholder only | WebRTC implementation in this phase |

For online play, server events/projections are authoritative. The client may request playback only after receiving a committed event. It cannot decide random outcomes, legal moves, turn changes, winner, rewards, or which private audience is entitled to a cue.

## 3. Preferences and persistence

`AudioPreferenceState` defaults to master/music/SFX/voice enabled with volumes `0.8/0.45/0.7/0.7`, captions enabled, inactive policy `PAUSE`, and reduced-sensory mode disabled. Values are clamped to `[0, 1]`; unknown or corrupt local storage falls back safely to defaults. Master mute is a gain gate, not a loss of captions. `voiceEnabled` is retained only for the future voice boundary and causes no network/device access.

Preferences are stored under `game-store-audio-preferences`; playback state, queues, `AudioContext`, pending captions, and active nodes are never persisted or placed in Zustand. Save games remain audio-free. A route or room may provide a disposable session override later, but this phase implements no game-specific override UI.

## 4. Command model, categories, and control

```ts
type AudioCommand = {
  id: string; category: "UI" | "ROOM" | "GAMEPLAY" | "MUSIC" | "AMBIENT" | "SYSTEM";
  priority: "CRITICAL" | "NORMAL" | "DECORATIVE";
  assetId: AudioAssetId; sourceEventId: string; sourceEventSequence?: number;
  volume?: number; loop?: boolean; interruptGroup?: string;
  authorizedAudience: "PUBLIC" | "VIEWER"; caption?: string; createdAt: number;
};
```

The pure queue validates commands, preserves insertion order, suppresses duplicate IDs and duplicate noncritical source-asset pairs, and supports take/complete, group stop, route cleanup, obsolete sequence clearing, reconnect reset, and discarding decoration before unlock. The runtime can play, stop, pause, resume, fade/replace a music group, duck/restore music, and clear obsolete groups. This small implementation uses original generated oscillator tones, no downloaded or copyrighted files; an asset registry describes only category, frequency, duration, and lazy loading intent.

Concurrency policy: one foreground SFX at a time in the development runtime; a replacement music group may have one loop; ambient is absent until a route opts in. Critical system cues replace lower-priority pending cues. Browser work is lazy, no audio context/nodes are created until an explicit interaction, and all nodes are stopped on route cleanup/unmount.

## 5. Autoplay, inactive tabs, and recovery

The browser unlock occurs only through the labelled **Enable sound** control or a direct preference interaction. Until unlocked, normal/critical commands wait in memory and decorative commands are discarded; enabling sound does not replay stale decoration. Initial enable is intentionally quiet. If browser support or resume fails, audio stays off, captions remain available, and the UI explains that sound can be retried.

When hidden, `PAUSE` pauses playback; `MUTE` uses a runtime gain gate; `CONTINUE` is available only as a future explicit preference choice. On route exit, dialog close, room leave, game end, or unmount, owner groups stop and queued work is cleared. Reconnect cancels stale work, applies the newest authority snapshot, announces resynchronization, and permits at most one new recovery/system cue—never a historical audio replay.

## 6. Accessibility and inclusive feedback

Every meaningful cue carries a concise text caption; captions remain available with master mute, an unavailable context, high contrast, reduced motion, or reduced-sensory mode. Captions use polite live status and never make sound, colour, or motion the only carrier of a rule, disconnect, turn, result, or privacy-relevant event. Controls are native labelled buttons with visible focus, pressed/disabled/loading states, 44px targets, and Vietnamese-safe `Be Vietnam Pro` typography inherited from Phase 2. Reduced sensory disables decorative cues and shortens/omits noncritical feedback; it does not hide critical status. Player identity continues to use names/patterns/slot labels, not a sound or colour alone.

## 7. Music, ambient, UI, room, and system behavior

Music is route-scoped, replaceable, duckable beneath critical system cues, and off when music is disabled. This phase registers no automatic game music to avoid unexpected playback. Ambient is lazy and route-scoped; no ambient loop is started in the vertical slice. UI examples are enabled sound, accepted/blocked choice, and save confirmation. Room examples are public join/ready/start/reconnect only; mocked-room sounds are explicitly non-production. System examples are audio unavailable, reconnect, and result. Future voice controls are visual/preference-only and never request microphone permission.

## 8. Event mappings and privacy

| Source | Public/authorized committed trigger | Asset / caption | Recovery |
| --- | --- | --- | --- |
| Room | public ready/start/reconnect acknowledgement | `room-ready`, `room-start`, `system-resynced` / concise public status | cancel stale room group; one resync caption |
| Color Clash | UNO `CARD_PLAYED`, `GAME_WON` | `color-card-played`, `game-result` / “Card played”, “Match complete” | discard historical cards; render current hand/discard |
| Royal Race | `DICE_ROLLED`, `GAME_FINISHED` | `royal-die-settled`, `game-result` / committed die/result | current board only |
| Property Empire | `TOKEN_MOVED`, public `EVENT_CARD_DRAWN` | `property-token-arrived`, `property-dispatch` / arrival/dispatch | current board and ledger only |
| Moon Village | `MoonVillagePublicProjection` day transition/finished only | `moon-public-transition`, `game-result` / “Village phase changed”, “Match complete” | public latest projection only |

Moon Village adapters accept neither `MoonVillageDomainState` nor private event types. No role, team-private action, target, investigation, vote detail, asset name, URL, preload, command payload, caption, or timing branch is introduced for unauthorized clients. Future authorized private cues require server- or engine-generated viewer projections and a separate privacy review.

## 9. Component and utility architecture

- `@game-store/audio-core`: pure types, preferences, registry, and deterministic command queue.
- Web-local `BrowserAudioEngine`: lazy Web Audio runtime using generated development tones; runtime instances stay in refs/private fields.
- `AudioProvider`/`useAudio`: persists preferences, owns disposable playback state, visibility, route cleanup, unlock, command submission, and captions.
- `AudioCaption` and `EnableSoundControl`: accessible, optional primitives.
- `adapters.ts`: safe event/projection-to-command functions only; no reducers.
- `/dev/audio`: development-only preference, unlock, queue, caption, and reconnect preview. It is unavailable in production.

## 10. Testing, risks, and Phase 8 readiness

Tests cover immutable preference normalization, invalid data fallback, queue ordering/duplicate suppression/group cleanup/reconnect/locked decoration handling, asset registry, unlock fallback, visibility/cleanup, adapters, captions while muted, and Moon public-only safety. Full workspace typecheck, lint, unit tests, production build, and Playwright are required.

Open decisions: final original sound direction/licensing and loudness targets; user-facing audio settings surface; music/ambient per-game direction; haptics policy; inactive-tab default; server event sequencing/deduplication; authorized Moon private-cue delivery; spectators and voice moderation/device policy; analytics consent. Risks are excessive cue density, browser policy inconsistency, mobile battery use, and accidental secret metadata; mitigations are strict queue caps, quiet opt-in unlock, route cleanup, generated placeholders, public-projection typing, and tests that reject secret payload terms.

Phase 8 readiness depends on product approval of the final sound library/licensing, settings information architecture, online authority transport, and Moon authorized-audience delivery. Phase 8 is not started by this work.
