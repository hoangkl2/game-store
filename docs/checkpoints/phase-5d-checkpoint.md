# Phase 5D Checkpoint - Moon Village

Status: **READY FOR APPROVAL**  
Date: 2026-08-02  
Scope gate: Phase 5D complete; Phase 6 not started.

## Repository findings and reuse

- The approved pnpm/Turborepo, Next.js 15 App Router, React 19, strict TypeScript, `@game-store/game-core`, design-system, global-route, Phase 4 room, and Phase 5A-5C foundations remain intact.
- Moon Village previously had catalog metadata only. No engine, route, player-specific projection, hidden-information persistence policy, or tests existed.
- Stable shell, semantic-token, engine-contract, deterministic-random, IndexedDB, setup/detail handoff, accessibility, pause, and result patterns were reused.
- Board, timer, zoom/pan, audio, reconnect, and social-deduction components were not generalized. Royal Race, Property Empire, and Moon Village have materially different geometry, authority, and privacy requirements.
- This workspace has no Git metadata, so the inventory below records the scoped changes directly rather than using `git diff`.

## Deliverables

- Specification: `docs/games/moon-village/phase-5d-ui-ux-specification.md`
- Checkpoint: `docs/checkpoints/phase-5d-checkpoint.md`
- Pure TypeScript engine: `packages/game-moon-village`
- Route handoff: `/games/moon-village` -> `/games/moon-village/setup` -> `/games/moon-village/play`
- Offline playable slice: one local human, deterministic bots, role reveal, ordered night actions, dawn, discussion, vote, elimination, result, save, and resume.

## Files created

- `packages/game-moon-village/package.json`
- `packages/game-moon-village/tsconfig.json`
- `packages/game-moon-village/vitest.config.ts`
- `packages/game-moon-village/src/index.ts`
- `packages/game-moon-village/src/engine.ts`
- `packages/game-moon-village/src/bot.ts`
- `packages/game-moon-village/src/random.ts`
- `packages/game-moon-village/src/session.ts`
- `packages/game-moon-village/src/storage.ts`
- `packages/game-moon-village/src/__tests__/engine.test.ts`
- `packages/game-moon-village/src/__tests__/bot-session-save.test.ts`
- `apps/web/src/features/moon-village/types.ts`
- `apps/web/src/features/moon-village/components.tsx`
- `apps/web/src/features/moon-village/components.test.tsx`
- `apps/web/src/app/games/moon-village/setup/page.tsx`
- `apps/web/src/app/games/moon-village/play/page.tsx`
- `apps/web/src/app/games/moon-village/play/loading.tsx`
- `apps/web/src/app/games/moon-village/play/error.tsx`
- `apps/web/tests/moon-village.spec.ts`
- `docs/games/moon-village/phase-5d-ui-ux-specification.md`
- `docs/checkpoints/phase-5d-checkpoint.md`

## Files modified

- `apps/web/package.json` - Moon Village workspace dependency.
- `pnpm-lock.yaml` - workspace link resolution.
- `apps/web/src/features/game-catalog/catalog-data.ts` - truthful Offline/Bots playable status and original description.
- `apps/web/src/app/games/[slug]/page.tsx` - Moon Village setup handoff.
- `apps/web/src/app/globals.css` - scoped moonlit theme, contrast-safe light/dark accent, forced-colors, and reduced-motion behavior.
- `apps/web/tests/property-empire.spec.ts` - explicit setup-navigation wait to remove a parallel Playwright race.
- `apps/web/tests/royal-race.spec.ts` - explicit setup-navigation wait to remove the same regression-suite race.

No existing game engine or Phase 5A-5C gameplay behavior was modified.

## Engine and supported rules

The engine is React-, Zustand-, and NestJS-independent. Transitions are immutable, randomness is injected and snapshot-capable, actions are strictly validated against engine-generated legal actions, and state serialization/replay are versioned.

Supported original roles:

- Hearth Tender / Dawn resident.
- Dusk Prowler / team attack and living Dusk ally knowledge.
- Star Reader / recipient-private alignment investigation.
- Gate Warden / protection with no consecutive target.
- Dew Brewer / one restoration and one mark per match, with pass.
- Bell Ranger / engine-controlled retaliation after elimination.

Supported flow and resolution:

- Deterministic 5-8 resident role composition; the playable presets use five or six residents.
- Protected local role acknowledgement.
- Ordered Prowler, Reader, Warden, and Brewer night phases with dead/missing-role skipping.
- Warden protection and Brewer restoration before attack; Brewer mark resolves separately and duplicate targets are eliminated once.
- Public dawn outcomes without role/cause disclosure.
- Template-based bot discussion, private vote collection, public resolved tally, no-elimination ties, Ranger retaliation, Dawn/Dusk team wins, and round-limit result.
- Public chronology and committed engine events; React contains no phase, role, legal-target, vote-resolution, priority, or winner logic.

## Privacy and state-boundary status

- `MoonVillageDomainState` remains inside the pure engine/offline session authority. Production React source does not import or store it.
- React receives only `MoonVillagePlayerProjection`, containing a public projection and the authorized local resident's private projection.
- Public projections exclude role fields, unresolved votes, attack/protection/mark targets, investigations, team knowledge, and pending night state.
- Dusk teammate knowledge and Reader results exist only in authorized player projections. Other bot strategies receive their own projections, not the domain state.
- Complete role reveal appears in the public projection only after `FINISHED`.
- Moderator projection has a separate type and a module-private trusted-server grant. A caller-provided symbol is rejected; the browser route cannot authorize itself.
- UI, animation, audio, offline room, session/save, and connection states have separate types and lifecycles.
- Raw authoritative offline snapshots are used only because the browser is the offline authority. They are not rendered, logged, transmitted, or represented as safe online-client projections. Future online gameplay requires authenticated server-side per-recipient projection.

## Bots, save, replay, and resume

- EASY, NORMAL, and HARD bots choose only their projected legal actions.
- Bot memory models suspicion, trust, resolved vote history, accusation history, authorized known alignments, contradiction counts, and alliance likelihood.
- Bot dialogue is deterministic/template-based. No LLM controls rules, actions, priority, or results.
- Save envelopes version the game, domain schema, projection policy, and save schema. They include authoritative offline state, action history, bot memory, preferences, and game/bot random snapshots.
- Deserialization validates composition, roles, phases, players, maps, knowledge, votes, ability use, sequence, rounds, action history, and random snapshots.
- Restore rejects bot memory containing knowledge outside that bot's authorized projection, preventing save tampering from granting secret information.
- Resume clears transient UI/animation state and restores the local projection and deterministic future behavior.

## UI, responsive, and accessibility status

- Original moonlit village presentation uses text-first lantern/constellation identities and no Werewolf branding or copied assets.
- Detail, setup, protected reveal, responsive resident circle, private role/action panel, public chronicle, discussion, vote, pause/save/resume, and result flows are complete.
- Mobile uses a two-column resident grid; desktop uses a three-column grid and public/private side panel. A desktop/mobile visual audit found no layout blocker.
- Native Enter/Space controls and arrow-key target navigation are supported. Pause traps focus, autofocuses Resume, and restores focus.
- Live regions announce public changes and the authorized local prompt only. Resident number, symbol word, status text, and borders provide color-independent identity.
- Light/dark accent contrast, visible focus, disabled/loading controls, forced-colors behavior, reduced-motion immediate commits, and 44px controls are present.
- Audio is muted by default and represented as separate presentation state. No production sound library, voice chat, or copied sound is claimed.

## Severity audit

Fixed blocker/high findings:

- Full authoritative domain state could have been passed directly to React; a projection-only offline session boundary now prevents that integration pattern.
- Public state/replay surfaces needed explicit redaction; public and recipient projections now have separate schemas and tests.
- Tampered saved bot memory could inject unauthorized role knowledge; restore now rejects any knowledge not present in that bot's engine projection.
- An eliminated Bell Ranger initially could not receive a retaliation action because normal dead-player validation ran first.
- Strict deserialization initially accepted incomplete maps/compositions and unsafe round configuration.
- Ranger retaliation changed public status without a corresponding public chronology entry.
- The first light-theme moon accent was too light for text, and the catalog referenced a game-scoped token outside its scope. Both were corrected without changing the approved moonlit direction.
- Bot/animation scheduling could overlap interaction; projected actions remain disabled while the presentation commit or bot action is in progress.
- Six-resident generation initially omitted Bell Ranger even though the engine supported the role; the standard composition now contains all six roles.
- Parallel full-suite runs exposed unsynchronized setup navigation in Royal Race and Property Empire tests; both now wait for the destination URL without changing gameplay.

No blocker or high-severity issue remains.

Tracked medium/low findings:

- Offline authority necessarily holds the complete snapshot in browser memory/IndexedDB. This is not an acceptable architecture for future online clients.
- Template dialogue is intentionally repetitive and does not yet model free-form human discussion.
- Multi-Prowler consensus currently resolves deterministic plurality/tie ordering; production online timing and disconnect rules remain open.
- No historical save schema yet requires a migration chain; unsupported versions fail closed.
- Audio, phase timers, reconnect, spectator, moderation, and local multi-device privacy require later dedicated work.

## Exact validation report

Final commands executed from `C:\code\game-store`:

| Command | Result |
| --- | --- |
| `pnpm.cmd typecheck` | PASS - 9/9 workspace packages. |
| `pnpm.cmd lint` | PASS - 9/9 workspace packages. Repository lint scripts currently run strict TypeScript checks. |
| `pnpm.cmd --filter @game-store/game-moon-village test` | PASS - 2 files, 14 tests; 96.42% statements/lines, 87.36% branches, 98.11% functions. |
| `pnpm.cmd --filter @game-store/web test` | PASS - 4 files, 10 frontend tests. |
| `pnpm.cmd test` | PASS - all 9 workspace tasks, including Moon Village and all prior-game regressions. |
| `pnpm.cmd build` | PASS - API and Next.js production build; 15 routes generated, including Moon Village setup/play. |
| `pnpm.cmd exec playwright test` | PASS - 10/10 browser tests, including private reveal, keyboard action, save/resume, deterministic finish, mobile, reduced motion, forced colors, and all previous game/room/design-system flows. |

Focused Moon Village Playwright runs were also used while fixing strict-locator and setup-navigation test issues. A full-suite rerun exposed and fixed two existing setup-navigation races; the final 10-test run passed. Temporary desktop/mobile audit screenshots were removed before completion.

## Risks and unresolved decisions

- Final role composition and balance for each player count.
- Multi-Prowler consensus, tie, timeout, and disconnect behavior.
- Warden self-protection and repeat-target policy; Brewer knowledge/priority; Ranger timing.
- Public versus secret voting and discussion/accusation retention.
- Eliminated-player chat/knowledge, spectator delay, post-game reveal, and replay policy.
- Local multi-device or privacy-handoff support; shared-screen local play remains unavailable.
- Moderator access, audit retention, reporting, conduct, and voice policy.
- Production phase timers, AFK defaults, reconnect/resynchronization, and server bot takeover.
- Bot balance, dialogue variety, and target-duration tuning.

## Phase 6 readiness checklist

| Foundation | Readiness |
| --- | --- |
| Phase 5D specification, engine, projections, bots, offline route, save/resume, tests | Ready. |
| Approved product/design/global/room/game checkpoints | Preserved and referenced. |
| Public/player-private/team-private/UI/animation/audio/room/session/connection boundaries | Implemented for the offline slice. |
| Moderator policy and production trusted projection service | Defined as a boundary; not implemented. |
| Production authentication, cloud sync, backend authority, Socket.IO, matchmaking, moderation, voice | Not implemented; requires explicit later authorization. |
| Phase 6 files or features | Not started. |

## Approval gate

Phase 5D is complete and stopped at this checkpoint. Explicit approval is required before **Phase 6** begins.
