# Phase 5D - Moon Village Social Deduction UI/UX Specification

Status: implementation specification  
Scope: one offline human-versus-bots vertical slice; no Phase 6 or production realtime services

## 1. References and repository fit

This specification reuses by reference the approved Phase 1 product/state boundaries, Phase 2 tokens and accessibility behavior, Phase 3 global routes, Phase 4 room authority/handoff, and Phase 5A-5C implementation checkpoints. It does not repeat their route, token, room, save, or generic loading/error tables.

Confirmed repository facts:

- Next.js 15 App Router and React 19 are used in `apps/web`; pure engines live in isolated packages and implement `@game-store/game-core` contracts.
- Moon Village has catalog metadata but no route, engine, state projection, assets, or tests.
- No production authentication, private projection service, Socket.IO backend, moderation service, voice system, or stable generic timer/audio/reconnect component exists.
- Shared shells, semantic tokens, controls, IndexedDB patterns, deterministic random providers, engine events, and route handoffs are stable enough to reuse. Royal Race and Property Empire do not justify generalizing a social-deduction table or private prompt.

Recommendation: add `packages/game-moon-village` and game-local web features. Do not alter existing game engines or extract speculative shared social-deduction infrastructure.

## 2. Product intent and vertical slice

Moon Village is an original moonlit social-deduction game. Dawn-aligned villagers try to identify the hidden Dusk Prowlers; Dusk wins by reaching parity. The slice supports one local human and five deterministic bots, a protected role reveal, role-specific night decisions, bot discussion statements, public voting, elimination, results, save, and resume.

Primary loop:

`Private role reveal -> ordered night prompts -> public dawn report -> discussion -> vote -> resolution -> win check -> next night`

The slice is explicitly offline. “Discussion” is structured bot dialogue plus a Continue action, not voice chat. There is no local pass-and-play because one shared display cannot satisfy the approved privacy model without a separate-device/handoff decision.

## 3. Original world and role set

The visual direction is midnight blue, moonlit amber, mist, rounded village silhouettes, constellation marks, and text-first symbols. No Werewolf branding, copied rule prose, artwork, logos, sounds, or cards are used.

| Moon Village role | Team | Private ability |
| --- | --- | --- |
| Hearth Tender | Dawn | No night action; reasons and votes by day. |
| Dusk Prowler | Dusk | Selects one non-Dusk resident for the night attack; knows living Dusk allies. |
| Star Reader | Dawn | Learns whether one resident is Dusk-aligned. Results remain reader-private. |
| Gate Warden | Dawn | Protects one resident; cannot protect the same resident on consecutive nights. Self-protection is allowed. |
| Dew Brewer | Dawn | Once per game may restore the attacked resident and once per game may mark another resident for elimination; may pass either choice. The current attacked resident is brewer-private. |
| Bell Ranger | Dawn | If eliminated, immediately marks one living resident to leave with them. |

Six-player composition: one of each role, including one Dusk Prowler. Configurable engine compositions support 5-8 players: five excludes Bell Ranger; seven adds a second Hearth Tender; eight adds a second Dusk Prowler.

## 4. Rules and assumptions

- Roles are shuffled by injected randomness. The first night starts after the local player acknowledges their private role.
- Ordered phases are `ROLE_REVEAL`, `NIGHT_PROWLER`, `NIGHT_READER`, `NIGHT_WARDEN`, `NIGHT_BREWER`, `DAY_ANNOUNCEMENT`, `DAY_DISCUSSION`, `DAY_VOTING`, `RANGER_RETALIATION`, and `FINISHED`. Empty/dead-role phases auto-skip in the engine.
- Night resolution priority is Warden protection, Brewer restoration, Prowler attack, then Brewer mark. A protected/restored attack survives. A separately marked target is eliminated. Duplicate targets produce one elimination.
- Night causes and role identities are not announced. Dawn reports only who left or that the village was quiet.
- Every living resident votes for another living resident. Votes are private while collecting and become public only when resolved. A top-count tie eliminates nobody.
- Bell Ranger retaliation happens after any elimination source and before a win check. The Ranger may not select an already eliminated resident.
- Dawn wins when no living Dusk Prowler remains. Dusk wins when living Dusk players equal or outnumber living Dawn players. Win checks follow complete night/vote/retaliation resolution.
- Eliminated players take no actions. The human remains an observer but receives no additional secret roles.
- A 12-round safety limit resolves by living-team majority; an exact tie is a draw. This prevents indefinitely tied bot matches.
- Bots use structured suspicion/trust, public vote and accusation history, private known-role information, contradictions, and alliance likelihood. Dialogue is template-based; no LLM determines rules or actions.

## 5. State and authority boundaries

| Boundary | Owns | Must never own or expose |
| --- | --- | --- |
| `MoonVillageDomainState` | Complete offline authoritative roles, actions, phase, priority resolution, votes, elimination, win result | React dialogs, focus, animation, audio, connection |
| `MoonVillagePublicProjection` | Phase-safe round, alive/eliminated residents, resolved vote result, dawn outcome, public log/result | Roles, pending votes, night targets, investigations |
| `MoonVillagePlayerPrivateProjection` | Recipient role/team, own legal actions, own submitted choice, own ability usage and knowledge | Any unauthorized player's role/action/knowledge |
| `MoonVillageTeamPrivateProjection` | Authorized Dusk teammate identities and team prompt | Dawn roles or other private actions |
| `MoonVillageModeratorProjection` | Policy-gated audit projection for a future trusted server | Client-generated access, ordinary UI/store/analytics |
| `MoonVillageUIState` | Reveal cover, selected target, panels, pause, focus, local explanation | Legal targets, phase changes, winner |
| Animation/audio state | Presentation queue, reduced-motion mode, muted/caption preferences | Rule timing or authoritative transitions |
| Room/session/connection state | Phase 4 room envelope, offline save metadata, future transport lifecycle | Role secrets or legal resolution |

The engine creates projections. React is not passed `MoonVillageDomainState`. The offline session adapter holds domain state in a closure and emits only the local viewer projection. IndexedDB holds an authoritative offline snapshot because the browser is the offline authority; it is never treated as an online projection or transmitted. Future online saves/replays must be generated and redacted server-side.

Online clients must never receive unauthorized roles through DOM attributes, CSS-hidden nodes, Zustand, Socket.IO payloads, logs, replay history, telemetry, errors, or cached snapshots. Client-selected audience IDs are not authorization. Future projection requires authenticated server recipient context.

## 6. Screens and interaction hierarchy

Routes:

- `/games/moon-village`: existing game detail; advertises only Offline/Bots when playable.
- `/games/moon-village/setup`: six-resident roster, difficulty/speed, privacy statement, role summary, start.
- `/games/moon-village/play`: protected reveal, moon table, public chronology, private role panel, action controls, pause/save/resume, and result.

The table uses resident cards in a responsive two-column/mobile or three-column/desktop grid. Every resident combines number, name, symbol, status text, and border treatment; role imagery is not shown publicly. Phase and round are persistent. The private panel is visually distinct and names the authorized viewer.

Role reveal starts covered. “Reveal my role” shows only the local role; “I understand - begin” enters play. Screen-reader announcements never include more than the local authorized projection. Target controls are generated from `legalActions`; React does not recalculate target eligibility.

## 7. Phase behavior

- Night: use a calm phase banner, private prompt, legal resident targets, and Submit/Pass. Other role phases auto-resolve through bots/engine and never display their targets.
- Dawn: reveal only public casualties or quiet-night outcome, then acknowledge.
- Discussion: show template statements already committed as public events. Continue is an engine action.
- Voting: the local living player selects a legal target; bots submit through the engine. The tally appears only after resolution. Eliminated humans observe automatic bot progression.
- Ranger: if the local Ranger is eliminated, show engine-projected legal retaliation targets. Bot Ranger resolves automatically.
- Results: show winning team and all roles only after `FINISHED`; rematch and setup actions are available. Post-game role reveal is an explicit engine result projection.

Loading uses neutral skeleton/status text. Invalid/stale actions retain the latest projection and explain that the phase advanced. Save errors preserve the game in memory. Unsupported saves fail closed with Start new/Return actions.

## 8. Bots

EASY chooses legal targets randomly and emits simple neutral observations. NORMAL updates suspicion from votes, accusations, survival patterns, and private knowledge. HARD applies stronger role/team knowledge, protects or investigates high-information residents, coordinates Dusk targets, and avoids obvious repeated voting patterns. Bots never inspect information unavailable to their role/team projection.

All bots submit actions to the engine. Difficulty changes strategy, never legality, phase priority, or win checks.

## 9. Save, resume, replay, and privacy

- Save envelope versions: game, state, projection-policy, and save schema.
- Offline authoritative saves include domain state, action history, bot-memory state, and random snapshots. The web adapter never renders or logs their raw JSON.
- Resume validates every role, player, action, phase, knowledge entry, and version before replacing the live session. Temporary UI/animation/audio state is reset.
- Full replay is authoritative-only during a live hidden-role match. Player replays are recipient-projected. A full role/action reveal is allowed only after `FINISHED` and must be explicitly labelled.
- No analytics payload includes role, investigation, protection, potion, attack target, pending vote, or team knowledge.

## 10. Responsive, accessibility, motion, and audio

- All controls have at least 44px targets, visible focus, text labels, and disabled/loading explanations. Native buttons preserve Enter/Space behavior; arrow keys move among legal target buttons.
- Focus enters reveal/action dialogs, remains trapped where modal, returns to the invoking control, and moves to the phase heading after committed transitions.
- Live regions announce public changes and the authorized player's own prompt only. Public announcements never leak another role or night target.
- High contrast uses borders, symbols, status text, and patterns. Team/role meaning never depends on color. Vietnamese-capable typography and wrapping reuse Phase 2.
- Reduced motion commits event queues immediately and replaces mist/fade movement with state text. Audio is muted by default in this slice; caption/event labels exist, but no production sound assets or voice chat are claimed.

## 11. Validation strategy

Unit tests cover composition/shuffle, phase skipping, each role action, night priority, private projections, legal-action redaction, vote/tie resolution, Ranger retaliation, wins, round limit, bots, suspicion memory, strict serialization, save versions, replay, and random restoration.

Frontend tests assert no unauthorized role text is rendered, covered/revealed role behavior, legal target semantics, public resident identity, and post-game reveal boundaries. Playwright covers detail/setup/start, protected reveal, keyboard target submission, day/vote progression, pause/save/resume, deterministic finish, mobile, reduced motion, and forced colors.

Repository commands: `pnpm typecheck`, `pnpm lint`, package/frontend/full tests, production build, and configured Playwright.

## 12. Risks, unresolved decisions, and Phase 6 boundary

Open product decisions: larger role compositions; simultaneous multi-Prowler consensus; Warden self/repeat policy; Brewer knowledge and priority; Ranger timing; vote secrecy; eliminated-player chat; local multi-device privacy; spectator timing; post-game replay reveal; moderation access; bot dialogue variety; phase timers; disconnect defaults; conduct/voice policies.

Risks: offline browser authority necessarily holds the authoritative snapshot; this architecture must not be copied into online clients. Bot deduction may become predictable. Hidden-information regressions require projection-focused tests, not CSS audits alone. Discussion without human chat is intentionally limited.

Phase 6, production realtime, voice, matchmaking, moderation, analytics, and server projection infrastructure are not part of Phase 5D. Explicit approval is required after the Phase 5D checkpoint.
