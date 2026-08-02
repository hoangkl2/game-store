# Phase 5A — Color Clash UI/UX

Color Clash is an original platform card-game presentation. It reuses the Phase 1 state boundaries, Phase 2 tokens/accessibility, Phase 3 AppShell, and Phase 4 offline setup/handoff contract by reference. It does not reuse UNO branding, names, artwork, logos, backs, or text.

## Goal, modes and boundaries

The offline slice lets a guest start a two-player Color Clash match, select/play valid cards, draw, choose a Wild colour, observe a bot, save/resume, and see a result. Local pass-and-play and future room/matchmaking/reconnect are specified handoffs only.

`ColorClashDomainState` is supplied by the reusable deterministic shedding-engine adapter; it alone decides cards, legal actions, turns, effects, current colour, winner and draws. `ColorClashUIState` contains selected/focused card, picker/log/pause/rules visibility and interaction lock. `ColorClashAnimationState` is an event queue; `ColorClashAudioState` holds preferences/captions; `GameSessionState` owns the offline save metadata; Phase 4 `RoomState` and `RealtimeConnectionState` remain external and absent in offline play.

Compatibility: the existing tested offline engine is used as a temporary Color Clash rules adapter. Its supported effects are Skip, Reverse, Draw Two, Wild and Draw Four; Call/Final Card and Draw Four challenge are unavailable rather than fabricated. A dedicated original Color Clash domain package is a later rule-product decision.

## Interaction and layout

Desktop: compact game header → opponent panel and central draw/discard/current-colour area → player hand → sticky action bar. Tablet keeps hand dominant and uses a log drawer. Mobile uses compact opponent count, visible piles, horizontally scrolling hand and bottom action bar. The priority is hand, piles, turn/colour, draw, then secondary controls.

Cards are original: colour plus label, corner value, central glyph and pattern: Crimson/circle, Azure/diagonal stripe, Verdant/triangle, Gold/diamond; Shift cards use a four-part pattern. A card has a stable aspect ratio, text label and keyboard-visible outline; valid cards receive label + outline, invalid cards remain readable but subdued. No drag-only interaction.

Player loop: observe turn/colour → Arrow keys or click select a card → Enter/Space submits a valid selection → Wild opens labelled picker and submits one complete action → Draw requests one engine transition → committed events update status and bot presentation. Invalid intent shows the engine validation message. Screen readers receive current turn, current colour and committed result—not animation frames or opponents' cards.

## Effects, save and feedback

Skip names the skipped player; Reverse updates direction; Draw effects state target/count; Wild shows the accessible colour picker. Bot thinking is presentation-only before its valid engine action. Events map to short transform/opacity feedback: play/draw 150–200ms, direction/colour 200ms, penalty 300ms, turn 150ms, result 300ms; reduced motion uses instant state change. Audio mapping is documentation-only: draw/play/effect/turn/result all require caption equivalents and respect future settings.

Pause provides resume, save, rules and exit. Save uses the existing versioned SavedGame envelope/action history and excludes picker, selection, animation and audio UI. Resume validates through the adapter. Future online reconnect follows Phase 4: disable action → authoritative snapshot/version → discard stale requests → render final state without replaying obsolete effects.

Results show winner, card counts, play again, return home and local log. No client rewards, ranked result or rematch authority is claimed.

## Components and tests

`ColorClashGameShell`, `ClashCard`, `PlayerHand`, `OpponentPanel`, `DrawPile`, `DiscardPile`, `CurrentColorIndicator`, `WildColorDialog`, `GameActionBar`, `BotThinkingIndicator`, `PausePanel`, `ResultPanel`, and `GameLog` are presentation-only. Engine adapter owns reduce/validate/save/bot calls. Test valid/invalid rendering, keyboard selection, draw, picker, bot legality, save/resume, responsive action bar, high contrast and reduced motion.

## Risks and Phase 5B readiness

Open decisions: original Color Clash deck/rules, final-card call, challenge, scoring, bot personalities, visual assets, local hidden-hand privacy and authoritative online adapter. The slice provides reusable header/hand/opponent/pile/turn/pause/save/result accessibility patterns but does not start Royal Race or establish a reusable game-rule package.
