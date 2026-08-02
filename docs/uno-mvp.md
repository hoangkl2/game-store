# UNO MVP assumptions and state machine

## Rules used

- Standard 108-card UNO deck: one zero and two 1–9 cards per color, two Skip/Reverse/Draw Two per color, four Wild, and four Wild Draw Four.
- Two to four players are supported. The first player is the first configured player.
- Each player starts with seven cards. The initial discard is forced to a number card so no opening action-card effect is ambiguous.
- A card is playable when its color matches, its number/action type matches, or it is wild. Wild Draw Four is always playable in this MVP; challenge rules are not included.
- Playing a Wild requires a chosen color. The chosen color applies immediately.
- Draw One draws exactly one card. If it is playable, the player may play it; otherwise the player passes. Drawing does not automatically end the turn.
- Draw Two and Wild Draw Four immediately deal the penalty to the next player and skip that player's turn.
- Skip skips the next player. Reverse changes direction; with two players it behaves as Skip.
- Empty draw piles are replenished by shuffling all discard cards except the top card with the injected random provider.
- The player who empties their hand wins immediately. There is no score aggregation or challenge/UNO-call rule yet.
- `PASS_TURN` is legal only after drawing, preventing a player from passing a playable turn.

## State machine

```text
ACTIVE
  PLAY_CARD -> ACTIVE | FINISHED
  DRAW_CARD -> ACTIVE (same player, one card available to play/pass)
  PASS_TURN -> ACTIVE (next turn)
FINISHED
  no actions accepted
```

The reducer validates every action before creating a new state. It never mutates an input array or object. The random provider is owned by the engine instance, so initial deals and draw-pile reshuffles are reproducible in tests and replays.

## Implementation plan

Files added: `packages/game-uno/src/index.ts`, `packages/game-uno/src/engine.ts`, `packages/game-uno/src/bot.ts`, `packages/game-uno/src/storage.ts`, `packages/game-uno/src/store.ts`, and engine/bot tests. The web app contains a minimal playable room with bot turns and save/resume controls. `IndexedDbUnoSaveStore` stores versioned `SavedGame` envelopes; future schema changes must pass through a migration function before deserialization.
