# Game Store — Phase 2 Design System Specification

Status: Draft implemented as a minimal foundation; approval required before Phase 3.  
Scope: Visual-language, accessibility, interaction, and implementation conventions. No authentication, realtime, database, API, route expansion, or game-specific screen implementation is authorized here.

## 1. Scope, repository baseline, and compatibility

### Confirmed baseline

- `apps/web` is a Next.js 15.5 App Router app using React 19 and strict TypeScript.
- Only `/` exists and directly hosts a small client-side UNO prototype.
- The prototype uses inline styles and native buttons; it has no current design-system dependency.
- `packages/ui` currently exports only a `UiStatus` type.
- Tailwind, Shadcn UI, global CSS, token files, visual components, icons, motion utilities, and audio utilities do not exist.
- Existing UNO engine, bot, IndexedDB adapter, and tests are framework-independent and must remain unchanged.

### Phase 2 implementation contract

- Preserve the App Router and existing `/` page behavior.
- Add only Tailwind/Shadcn-compatible global foundations, not a catalog, setup flow, game room redesign, authentication, Socket.IO, Prisma, NestJS, or other Phase 3+ feature.
- Import global styles through the root layout. This is the only intended change to the UNO page’s environment; it must not change engine state, bot behavior, saving, or user actions.
- Keep `packages/ui` framework-light at this stage: token metadata and types are allowed; component construction is deferred until route and component priorities are approved in Phase 3.

## 2. Design-system vision

Game Store should feel warm, lucid, and game-table capable: familiar enough for casual players, structured enough for strategic play, and calm enough that status, rules, and private information remain understandable under pressure. The system uses a neutral platform shell with game-specific accents layered only where they improve recognition. It must never use decoration, animation, color, or sound as the sole carrier of rules, turn ownership, connectivity, or private information.

### Product design principles

1. **Clarity before spectacle.** Board state, available action, turn/phase, and connection/save state outrank decoration.
2. **Semantic, not page-specific.** A token represents an intent such as `primary`, `danger`, or `surface`, rather than “UNO red button.”
3. **Accessible by default.** Contrast, focus, touch targets, motion, and non-color cues are part of each component contract.
4. **System shell, game character.** The platform controls typography, spacing, overlays, navigation, and feedback; games provide constrained theme accents and table surfaces.
5. **Progressive density.** New players see the next meaningful action; experienced players can expose logs, rules, statistics, shortcuts, and advanced settings.
6. **Truthful feedback.** Pending, saved, reconnecting, failed, and authoritative states have distinct presentations.
7. **Private information stays deliberately private.** Visual hierarchy must not accidentally reveal hidden cards, roles, selections, or spectator-restricted data.

## 3. Brand expression and content tone

### Visual personality

- Inviting, tactile, and modern—not casino-like, childish, or corporate-dashboard cold.
- Deep ink/navy foundations support long sessions and colorful game pieces.
- Warm paper/surface colors make reading and table play comfortable in light mode.
- Accent colors are reserved for action, game identity, and intentional status—not decoration everywhere.
- Shapes are softly rounded and functional. Shadows define layers, not “floating cards” by default.

### Voice and microcopy

- Use concise, direct verbs: “Start offline match,” “Copy room code,” “Reconnect,” “Save game.”
- Explain system state in plain language: “You’re back in the room. Your game is synced.”
- Use neutral language for failure and moderation; never blame the player for network or server faults.
- State irreversible consequences before the action: “Leave match and forfeit your seat?”
- Use one primary CTA per decision surface. Secondary paths are links or secondary buttons.
- Support English and Vietnamese-ready content. Keep game titles configurable; avoid embedding mojibake-prone punctuation in source text.

## 4. Foundations

### 4.1 Color system

The canonical palette uses semantic CSS variables in OKLCH. Tokens are defined for light and dark modes. Game-specific colors may decorate a card, board, or game mark, but platform actions must use the platform semantic tokens.

| Token family | Semantic use | Light intent | Dark intent |
|---|---|---|---|
| `background` / `foreground` | Application canvas and primary text | Warm near-white / ink | Deep navy / soft white |
| `surface` / `surface-foreground` | Cards, panels, dialogs | Elevated paper | Elevated slate |
| `muted` / `muted-foreground` | Secondary surface/text | Quiet gray-blue | Quiet slate |
| `primary` / `primary-foreground` | Single most important action, selected control | Calm indigo-blue | Bright accessible indigo |
| `secondary` | Low-emphasis action/selection | Soft blue-gray | Deep blue-gray |
| `accent` | Informational highlight/hover | Amber-gold tint | Warm amber tint |
| `destructive` | Destructive action, invalid/critical state | Accessible red | Lightened red |
| `success`, `warning`, `info` | Status only with icon/text | Green, amber, blue | Contrast-adjusted counterparts |
| `border`, `input`, `ring` | Delineation, form field, focus | Low-contrast boundary / visible ring | Equivalent dark boundary / bright ring |

Requirements:

- Standard body text must meet WCAG AA 4.5:1; large text and non-text boundaries must meet their applicable WCAG requirements.
- Status color is always paired with text and, where relevant, an icon or pattern.
- Destructive red is not used for UNO card identity. Game colors require a secondary label, symbol, or shape when they carry meaning.
- Color themes are data-driven per game, but may only map to approved `game-*` accent variables; they may not override platform destructive/focus/connection colors.

### 4.2 Typography

Use the system sans-serif stack in Phase 2 to avoid font-loading risk. A branded display face is a later approval decision.

| Role | Token | Size / line-height | Weight | Usage |
|---|---|---|---|---|
| Display | `text-display` | clamp(2rem, 4vw, 3.5rem) / 1.05 | 700 | Marketing hero only |
| H1 | `text-3xl` | 30px / 36px | 700 | Page title |
| H2 | `text-2xl` | 24px / 32px | 700 | Primary section |
| H3 | `text-xl` | 20px / 28px | 600 | Panel/board section |
| Body | `text-base` | 16px / 24px | 400 | Default reading text |
| Body small | `text-sm` | 14px / 20px | 400 | Metadata, helper text |
| Label | `text-sm` | 14px / 20px | 600 | Inputs, controls, status labels |
| Caption | `text-xs` | 12px / 16px | 500 | Timestamps, compact metadata |
| Numeric/turn data | `tabular-nums` | Contextual | 600 | Scores, timers, room codes |

Rules:

- Never set body copy below 14px; game-critical mobile controls use 16px minimum.
- Use sentence case for UI labels; reserve all caps for compact game-card labels only when legible.
- Room codes use grouped, copyable, tabular characters and never rely solely on case distinction.
- Do not use text color alone for disabled state; pair it with reduced contrast and interaction semantics.

### 4.3 Spacing, sizing, and rhythm

The base unit is 4px. Tailwind’s default spacing scale is the source implementation scale.

| Intent | Token/value | Typical use |
|---|---|---|
| Hairline | 1px | Borders/dividers |
| Tight | 4–8px | Icon-to-label, card internal micro-gap |
| Control | 10–12px | Button/input padding |
| Standard | 16px | Card/panel padding, form rhythm |
| Section | 24–32px | Between meaningful content groups |
| Page | 40–64px | Major page separation |
| Touch target | 44×44px minimum | Mobile interactive controls |
| Desktop control | 36px minimum | Dense noncritical controls only |

### 4.4 Shape, borders, and elevation

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 6px | Small chips, compact inputs |
| `radius-md` | 10px | Buttons, standard controls |
| `radius-lg` | 14px | Cards, setup panels |
| `radius-xl` | 20px | Dialogs, feature panels |
| `radius-full` | 9999px | Avatar, pill badge |
| `shadow-sm` | subtle | Selected/hovered surface only |
| `shadow-md` | moderate | Popover/dropdown |
| `shadow-lg` | strong | Modal/dialog; use sparingly |

Surfaces use borders first, shadows second. Interactive elevation changes must not be the only hover/focus signal.

### 4.5 Responsive layout and breakpoints

| Viewport | Layout rule |
|---|---|
| <640px | One-column shell; persistent bottom navigation where applicable; game room prioritizes board/hand; 16px horizontal page padding |
| 640–1023px | Two-column content when it improves scanning; setup summary can become sticky |
| 1024–1279px | Desktop shell; optional left navigation and right contextual panel |
| ≥1280px | Maximum content container 1200–1280px; game board receives remaining central space, not unconstrained full width |

Use a 12-column desktop grid and a 4-column mobile grid. Main content must work at 200% browser zoom and 320 CSS-pixel width. Landscape mobile layouts are game-specific and must preserve escape/pause, turn, and private-state cues.

### 4.6 Iconography, imagery, and data visualization

- Use Lucide icons as the default interface icon set. Icons clarify, not replace, a visible label for unfamiliar or high-consequence actions.
- Use 16px icons inside compact controls and 20px icons in normal controls; use 24px only for emphasis/navigation.
- Decorative game art receives empty alt text; informative artwork has concise contextual alt text.
- Avatar fallback is initials plus a stable generated color that meets contrast requirements.
- Charts/statistics use labeled values, patterns/markers, and accessible table alternatives.
- No new bitmap or AI-generated art is part of Phase 2.

### 4.7 Motion, reduced motion, and feedback

| Motion tier | Duration | Allowed use |
|---|---:|---|
| Instant | 0–100ms | Focus, hover, press |
| Standard | 150–200ms | Menu, tooltip, control state |
| Emphasis | 220–320ms | Dialog/panel entry, result acknowledgement |
| Game event | Game-specific | Visualizes a transition already decided by engine/server |

Rules:

- Use opacity and transform only for standard UI motion; do not animate layout for essential controls.
- Respect `prefers-reduced-motion: reduce`: remove nonessential transitions, confetti, shake, parallax, autoplay, and looping attention effects.
- Animation never determines card dealing, dice result, hidden-information reveal, action validity, or turn advancement.
- Pending online actions use a stable status treatment, not an invented optimistic outcome.

### 4.8 Audio and haptics

No audio implementation is authorized in Phase 2. The design contract is:

- Separate master, effects, music, and voice settings.
- Start muted only if browser policy requires it; otherwise honor the stored user choice.
- Every audio cue has a visual equivalent.
- Haptics are optional and mobile-only; provide a system-respecting toggle.
- Critical warnings (disconnect, turn timer) must never depend solely on audio/haptics.

## 5. Accessibility and inclusive-interaction standard

- Target WCAG 2.2 AA for all platform-critical journeys.
- Maintain visible `:focus-visible` rings with a 2px semantic ring and offset; no focus removal.
- Provide logical keyboard order, skip link, landmarks, dialog focus management, Escape dismissal where appropriate, and return focus on close.
- Use native HTML controls before custom ARIA patterns. Custom controls need keyboard, role, state, name, and error semantics.
- Touch targets are 44px minimum unless an accessible alternative is present.
- All game-critical color signals require labels/icons/patterns; support color-blind-safe game themes.
- Dynamic updates such as room readiness, save success, reconnect, and turn changes require restrained `aria-live` announcements. Do not announce hidden information to screen readers outside the authorized player view.
- Timed modes must expose the timer textually and support pause/extended-time policies where product rules permit.
- Respect user text scaling, forced colors, contrast preferences, and reduced motion.

## 6. Component taxonomy and contracts

Phase 2 defines the contracts; only tokens/utilities are scaffolded. Components are created in Phase 3 after route priorities are approved.

### 6.1 Primitives

| Primitive | Variants | Required states | Accessibility contract |
|---|---|---|---|
| Button | primary, secondary, outline, ghost, destructive, link | default, hover, active, focus, disabled, loading | Native button; loading retains accessible label; destructive label explicit |
| Icon button | neutral, ghost, destructive | same as button | Requires `aria-label`/tooltip; 44px target on touch |
| Input | text, numeric, room code, password | default, focus, filled, invalid, disabled, loading validation | Label, description, error association; no placeholder-only label |
| Select/combobox | single, multi, searchable | closed/open, selected, invalid, disabled, loading | Prefer native select where enough; full keyboard model otherwise |
| Checkbox/switch/radio | standard | checked, unchecked, mixed where valid, disabled, invalid | Semantic native control or equivalent ARIA behavior |
| Badge/status | neutral, success, warning, danger, info, game | static, live | Text plus non-color status signal |
| Card/surface | flat, interactive, selected, elevated | default, hover, focus-within, disabled | Interactive card has one clear keyboard target, not nested controls |
| Dialog/sheet/popover | modal, nonmodal, destructive confirmation | open, loading, error | Focus trap only for modal; accessible title/description |
| Toast/alert | success, info, warning, error | appearing, action, dismissing | Live region, persistent critical errors, no auto-dismiss critical state |
| Skeleton/empty/error state | page, card, panel, game surface | loading/empty/error | Preserve structure, explain recovery, avoid fake controls |

### 6.2 Platform composites

| Composite | Purpose | Core data/state |
|---|---|---|
| App shell | Global navigation and session notices | current route, reconnect badge, active match, profile state |
| Game card/grid | Discovery and comparison | availability, players, modes, duration, difficulty, image fallback |
| Game setup form | Configure offline/local/online modes | validation, saved preset, compatibility constraints |
| Player avatar/seat | Public player identity | name, avatar, readiness, connected/AFK, host, bot |
| Room code/invite | Join/share private room | copy, QR/share, expiry, privacy state |
| Connection banner | Reconnect/resync communication | connection phase, retry, consequence, help link |
| Save status/control | Local/cloud persistence feedback | saved/pending/error/conflict, timestamp, recovery action |
| Result dialog/screen | Terminal match outcome | winner/rank, reason, reward eligibility, rematch/lobby/replay |
| Rules/help dialog | Contextual learning | game/version/rule variant, keyboard support |

### 6.3 Game-surface primitives

These are reusable visual primitives, not rule engines. They consume authorized state and emit user intents.

| Primitive | Purpose | Constraints |
|---|---|---|
| Turn indicator | Current player/phase/timer | Uses name, icon, and text; never color only |
| Player rail | Participants and public status | Must not reveal private hand/role data |
| Game card | UNO-like physical card presentation | Supports face-down/redacted state, keyboard selection, no game logic |
| Board tile | Ludo/Monopoly-like space | Visual state is data-driven and labelable |
| Dice/result display | Authoritative result visualization | Cannot generate outcome or imply client authority |
| Game log | Public/authorized event history | Recipient projection controls visibility |
| Private reveal shield | Local pass-and-play/hidden information handoff | Neutral, full-screen capable, explicit reveal action |
| Action tray | Legal action controls | Receives allowed actions only; cannot invent valid action |
| Pause/exit overlay | Safe interruption | Displays actual save/reconnect/forfeit consequences |

## 7. State-to-UI visual mapping

The design system must preserve the Phase 1 state boundaries.

| State boundary | Visual responsibilities | Prohibited visual behavior |
|---|---|---|
| `DomainGameState` | Board, card/piece display, phase, public result, legal action availability supplied by engine | Infer or mutate rules from animation/control state |
| `RoomState` | Lobby, seat list, host/ready status, room code, capacity, room configuration | Show secrets or decide membership locally |
| `GameUIState` | Selected card, open panel, tutorial hint, animation queue, focused control | Store authority, winner, or hidden role |
| `RealtimeConnectionState` | Connection banner, pending intent, resync progress, stale control treatment | Present local state as confirmed server transition |
| `PlayerPrivateState` | Own hand, private role/prompt, personal choice | Render to spectator/opponent DOM, logs, analytics, or shared store |
| `PlayerPublicState` | Name, seat, ready, connected, public score/count/status | Imply secret information through labels, layout, or aria text |

## 8. Theming model

### Platform themes

- Light and dark themes are first-class semantic-token overrides.
- Theme preference order: explicit user choice → operating-system preference → light default.
- Theme switching changes semantic values, not component-specific hardcoded colors.

### Game themes

- Each game may define a limited accent palette, table texture, and piece/card visual set through data/configuration.
- The platform theme maintains typography, status colors, focus ring, dialogs, navigation, and accessibility guarantees.
- Game themes must pass contrast checks against both light and dark platform surfaces.
- Cosmetic themes cannot obscure symbols, alter rule meaning, or make player distinction color-only.

## 9. Tailwind and Shadcn implementation conventions

### Approved minimal foundation

- Tailwind CSS v4 supplies utility generation and responsive/dark-mode ergonomics.
- CSS custom properties in `packages/ui/src/styles.css` are the canonical semantic token values.
- `apps/web/src/app/globals.css` imports Tailwind and the token stylesheet, maps semantic variables into Tailwind theme names, and supplies base accessibility styling.
- `components.json` configures Shadcn-compatible aliases, CSS variable usage, and the New York component style. It does not install or generate components in Phase 2.
- `apps/web/src/lib/utils.ts` exports the standard `cn` class-composition utility for future Shadcn-compatible components.
- `packages/ui/src/tokens.ts` exports token names/types for non-CSS consumers and documentation; it is not a duplicate visual-value source.

### Conventions for later components

- Use `cn()` for class composition and semantic Tailwind classes such as `bg-background`, `text-foreground`, and `border-border`.
- Use CSS variable tokens over arbitrary hex values. Arbitrary values are permitted only for game-rendering geometry or measured assets and require a comment/owner.
- Use `data-state`, `aria-*`, and semantic variants for component state. Do not style by route name or game type where a semantic variant exists.
- Keep components presentational: engine actions, room protocol, privacy projection, and persistence remain outside `packages/ui`.
- Use the app alias `@/` only inside `apps/web`; cross-workspace imports use package names.

## 10. Minimum scaffold contents

| File | Phase 2 purpose | Does not do |
|---|---|---|
| `apps/web/postcss.config.mjs` | Enables Tailwind processing | Configure gameplay |
| `apps/web/components.json` | Shadcn-compatible component conventions | Generate components or add Radix UI |
| `apps/web/src/app/globals.css` | Imports Tailwind/tokens; base theme, focus, selection, reduced-motion rules | Implement screens |
| `apps/web/src/lib/utils.ts` | Provides `cn()` utility | Create a component library |
| `apps/web/tsconfig.json` | Adds `@/*` alias for future components | Changes routes/state |
| `apps/web/src/app/layout.tsx` | Imports global CSS and applies semantic body classes | Modify UNO logic/UI flow |
| `packages/ui/src/styles.css` | Canonical light/dark semantic token values | Include game-specific visual components |
| `packages/ui/src/tokens.ts` | Type-level token names | Duplicate CSS values |
| `packages/ui/src/index.ts` | Exports token metadata/types and existing status type | Export premature UI components |

## 11. Validation and quality gates

- Typecheck, lint, unit tests, and existing Playwright test must continue to pass.
- Confirm the existing UNO route renders and its button/action semantics are unchanged.
- Verify light/dark variables compile without hardcoded page-specific colors in the foundation.
- Test keyboard focus visibility, `prefers-reduced-motion`, text selection, and default body contrast in a browser.
- Future component PRs require state matrices, responsive behavior, keyboard behavior, screen-reader labels, contrast review, and loading/empty/error states.
- Future game-surface PRs require explicit confirmation that private information is not rendered outside an authorized state projection.

## 12. Open design decisions

1. Final brand name mark, logo, illustration style, and whether a custom font is worth performance/localization cost.
2. Initial light-versus-dark default and user-facing theme naming.
3. Which game themes/cosmetics launch first and their accessibility review process.
4. Whether the initial app shell uses top navigation, side navigation, or a hybrid on desktop.
5. Final icon license/asset pipeline beyond Lucide interface icons.
6. Audio cue vocabulary, volume defaults, and haptic policy.
7. Whether chat/emotes exist in the first online release and their moderation visual language.
8. Exact local pass-and-play privacy shield behavior for each hidden-information game.
9. Localization copy review process, English/Vietnamese language switch placement, and font coverage.

## 13. Phase 3 handoff and approval gate

Phase 3 may use this foundation to design platform information architecture and wireframes for Home, Catalog, Game Detail, Setup, Saves, and navigation. It must not silently resolve the open product decisions above.

Approval should confirm:

- The warm neutral/indigo platform palette and semantic-token model.
- System-font-first typography and accessibility baseline.
- Tailwind v4 plus Shadcn-compatible conventions.
- Deferral of concrete UI components and game-room redesign until Phase 3.
- The scoped Phase 2 file list and the principle that UNO gameplay remains unchanged.

**Explicit gate:** Stop after Phase 2 and obtain approval before beginning Phase 3 — Platform Information Architecture and Wireframes.

---

## 14. Governing-brief addendum: Phase 2 completion specification

This addendum supersedes preliminary token values in sections 1–13 where they conflict with the approved Phase 2 brief. It preserves the existing App Router, engine, and UNO prototype, and it does not authorize any product screen beyond a development-only token preview.

### 14.1 Repository comparison and recommended changes

| Category | Confirmed fact | Gap or conflict | Phase 2 decision |
|---|---|---|---|
| Next.js | 15.5.22 App Router | Compatible | Preserve App Router and root layout. |
| Tailwind | 4.3.3 with PostCSS plugin | Base mapping is incomplete | Extend semantic token mappings; retain Tailwind v4. |
| Shadcn | `components.json`, New York style, aliases | No generated primitives | Use Shadcn-compatible conventions; build only thin local primitives. |
| Themes | Light/dark CSS variables only | No system or high-contrast handling | Add a small theme provider with light, dark, system, HC light, HC dark modes. |
| Typography | System stack only | No Vietnamese/English brand typography | Configure three bounded `next/font` families: Be Vietnam Pro, Fredoka, Space Grotesk. |
| UI package | Token metadata and CSS only | No player/game/status token contract | Add typed semantic, player, gameplay-status, and theme metadata. |
| Components | None | No accessible common primitive | Add Button, Badge, Card, Input, Avatar, Progress, Skeleton only; defer dialogs/toasts/tooltips to Phase 3. |
| Icons | Lucide installed | No usage standard | Use Lucide as the only interface icon set. |
| Animation/audio | No utility | No motion or audio visual state model | Add tokens/specification only; no engine or sequence. |
| UNO prototype | Inline-styled `/` page | It is not a component-system consumer | Do not rewrite it. Global base styles and fonts are the only compatibility layer. |

Reusable assets are the existing CSS variable mechanism, Tailwind v4/PostCSS setup, Shadcn alias configuration, `cn()` utility, Lucide dependency, `packages/ui` token package, and the semantic behavior of native controls in the UNO prototype. There are no reusable illustrations, visual components, audio assets, or animation assets to preserve.

### 14.2 Brand personality and goals

Game Store is playful, contemporary, premium, friendly, and legible under competitive pressure. It pairs a deep indigo core with warm surfaces and restrained high-chroma status accents. The result should resemble a considered tabletop lounge rather than a casino, a children’s app, or a glass-heavy dashboard.

Goals: make the next action obvious; establish a shared visual grammar for marketing, account, dashboard, catalog, lobby, matchmaking, gameplay, profile, rewards, commerce, settings, and recovery; maintain game-specific personality through extension variables; support pointer, touch, keyboard, assistive technology, light/dark/system/high-contrast modes, Vietnamese, and English.

### 14.3 Primitive palette and semantic color mapping

`#2D2765` is the light-theme primary base. Components consume semantic variables only; raw palette values are restricted to the token stylesheet and game-asset definitions.

| Family | Base | Hover | Active | Subtle | Foreground |
|---|---|---|---|---|---|
| Primary | `#2D2765` | `#241F54` | `#1C1842` | `#ECEBFA` | `#FFFFFF` |
| Secondary | `#50657D` | `#405369` | `#334556` | `#EEF2F6` | `#FFFFFF` |
| Accent | `#A56512` | `#874F0A` | `#6B3E08` | `#FFF3D8` | `#1F1607` |
| Success | `#16794D` | `#10613E` | `#0B4C31` | `#DCF7E9` | `#FFFFFF` |
| Warning | `#A85D00` | `#874A00` | `#6A3A00` | `#FFF0D2` | `#221507` |
| Danger | `#B4233C` | `#921C31` | `#741625` | `#FDE7EB` | `#FFFFFF` |
| Info | `#1466B8` | `#105493` | `#0C4274` | `#E2F0FF` | `#FFFFFF` |

| Neutral semantic token | Light mapping | Dark mapping | High-contrast requirement |
|---|---|---|---|
| Background | `#F8F8FC` | `#121124` | Near-black/near-white canvas |
| Surface | `#FFFFFF` | `#1A1930` | 3:1 boundary against canvas |
| Surface elevated | `#FFFFFF` | `#24233D` | Strong border plus elevation |
| Surface overlay | `rgba(255,255,255,.92)` | `rgba(26,25,48,.94)` | Opaque fallback |
| Border / divider | `#D9D9E6` / `#E9E9F0` | `#45445B` / `#35344B` | Visible 3:1 control boundary |
| Muted / disabled | `#F0F0F6` / `#A5A4B8` | `#2D2C43` / `#77768D` | Disabled state also uses semantics, not color alone |
| Text primary / secondary / muted | `#191827` / `#565469` / `#77758A` | `#F7F5FF` / `#C8C6D8` / `#A09EB3` | Primary and secondary normal text meet AA |
| Inverse text | `#FFFFFF` | `#171624` | Meet AA on primary/status surfaces |

All families expose `--{family}`, `--{family}-hover`, `--{family}-active`, `--{family}-subtle`, and `--{family}-foreground`. The established `--destructive` alias remains as a backwards-compatible alias to `--danger`.

### 14.4 Theme and contrast model

| Mode | HTML contract | Behavior |
|---|---|---|
| Light | `data-theme="light"`, no `.dark` | Default light semantic mapping |
| Dark | `data-theme="dark"`, `.dark` | Dark semantic mapping and dark color-scheme |
| System | persisted mode `system`; resolved theme reflected in `data-theme` | Reads `prefers-color-scheme`, reacts to changes |
| High-contrast light | `data-theme="light" data-contrast="high"` | Strong black/white boundaries and 7:1 critical text target |
| High-contrast dark | `data-theme="dark" data-contrast="high"`, `.dark` | Near-black surface, white text, high-visibility focus ring |

The active user preference is persisted client-side. The first render uses semantic defaults; the provider resolves the system preference after hydration without changing domain, room, or private game state. High contrast changes token values, never component markup.

### 14.5 Game-theme extension model

Global semantic tokens remain authoritative. Game themes may set only `--game-*` extension variables, each with a semantic fallback.

| Theme | Game | Direction | Extension examples |
|---|---|---|---|
| `property-empire` | Property trading board game | Deep emerald, brass, paper board | game board, property highlight, currency accent |
| `royal-race` | Ludo / Cờ cá ngựa | Saturated royal player lanes, clean ivory track | game board, player lanes, active turn |
| `color-clash` | Color-matching card game | Bright but controlled card accents on neutral table | game background, valid action, selection |
| `moon-village` | Werewolf / Ma sói | Midnight blue, moonlit amber, restrained mist | game background, phase highlight, secret prompt |

Required extension variables: `--game-background`, `--game-surface`, `--game-board`, `--game-highlight`, `--game-active-turn`, `--game-valid-action`, `--game-invalid-action`, `--game-selection`, and decorative variables as needed. Each defaults to a global semantic status or surface value. Game themes cannot replace `--focus-ring`, `--danger`, connection, or accessibility tokens.

### 14.6 Player identity model

Eight player identities are available. Every player color has base, foreground, subtle, border, number, symbol, and pattern identifier. Rendering uses at least two of: color, number, symbol, avatar border, pattern, and text label.

| Player | Base | Symbol | Pattern | First-four Ludo suitability |
|---|---|---|---|---|
| 1 | `#D92D45` | circle | diagonal stripes | Red home/lane |
| 2 | `#16794D` | triangle | dots | Green home/lane |
| 3 | `#1466B8` | square | grid | Blue home/lane |
| 4 | `#A56512` | diamond | crosshatch | Yellow/gold home/lane |
| 5 | `#7D3AC1` | star | waves | Extended player |
| 6 | `#B44D1C` | hexagon | chevron | Extended player |
| 7 | `#087A7A` | plus | vertical stripes | Extended player |
| 8 | `#A83A78` | crescent | checker | Extended player |

Color-blind modes remap player base/border variables and elevate symbol, number, and pattern. UNO cards and Ludo tokens must render their color name/symbol or player number in all critical contexts.

### 14.7 Typography system

| Token | Family | Desktop | Mobile | Weight / tracking | Use |
|---|---|---|---|---|---|
| Display large | Fredoka | 56/60 | 40/44 | 600 / -0.03em | Marketing hero |
| Display | Fredoka | 44/50 | 34/40 | 600 / -0.02em | Game feature title |
| H1 | Be Vietnam Pro | 36/44 | 30/38 | 700 / -0.02em | Page title |
| H2 | Be Vietnam Pro | 28/36 | 24/32 | 700 / -0.015em | Section title |
| H3 | Be Vietnam Pro | 22/30 | 20/28 | 650 / -0.01em | Panel heading |
| H4 | Be Vietnam Pro | 18/26 | 17/24 | 650 / normal | Subsection |
| Body large | Be Vietnam Pro | 18/28 | 17/27 | 400 / normal | Lead copy |
| Body | Be Vietnam Pro | 16/24 | 16/24 | 400 / normal | Default content |
| Body small / label / caption | Be Vietnam Pro | 14/20 / 14/18 / 12/16 | same | 400–650 | Metadata and controls |
| Button | Be Vietnam Pro | 14/20 | 14/20 | 650 / normal | Control labels |
| Score large / score / timer / currency | Space Grotesk | 32/36 / 20/24 / 20/24 / 16/20 | 28/32 / 18/22 / 18/22 / 16/20 | 650 / tabular | Scores, timers, money |
| Code/room code | Space Grotesk | 16/24 | 16/24 | 650 / 0.12em | Fixed-length codes |

`next/font` configures only Be Vietnam Pro, Fredoka, and Space Grotesk. Vietnamese-capable Be Vietnam Pro is the interface default; fallbacks remain system sans/monospace for resilience.

### 14.8 Spacing, layout, breakpoints, radius, and depth

The 4px scale is: `0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` mapped to `0, .25rem, .5rem, 1rem, 1.5rem, 2rem, 3rem, 4rem, 5rem, 6rem` as applicable. Semantic layout variables are `--page-padding`, `--section-gap`, `--card-padding`, `--dialog-padding`, `--hud-gap`, `--mobile-action-bar-height`, `--sidebar-width`, `--sidebar-width-compact`, `--content-max`, and `--readable-max`.

| Layout group | Range | Tailwind mapping | Page gutter |
|---|---|---|---|
| Mobile small | 320–374 | base | 12px |
| Mobile | 375–767 | base / `sm` begins at 640 | 16px |
| Tablet | 768–1023 | `md` | 24px |
| Laptop | 1024–1439 | `lg`, `xl` at 1280 | 32px |
| Desktop | 1440–1919 | custom `2xl` usage at 1440 where needed | 40px |
| Large desktop | 1920+ | custom container/media query when needed | 48px |

Tailwind’s default breakpoints are retained to avoid an architecture conflict; layout groups are documentation and CSS/container contracts rather than business-logic device checks. Use responsive CSS and capabilities, not device names in application logic.

Radius variables: `none: 0`, `control: 6px`, `input: 10px`, `button: 10px`, `card: 16px`, `elevated: 20px`, `dialog: 24px`, `gameplay-panel: 28px`, `pill: 9999px`, `circle: 50%`.

| Depth | Token | Typical use |
|---|---|---|
| 0 | `--shadow-0` | Flat board/background |
| 1 | `--shadow-1` | Standard card |
| 2 | `--shadow-2` | Interactive card |
| 3 | `--shadow-3` | Popover/menu |
| 4 | `--shadow-4` | Dialog |
| 5 | `--shadow-5` | Critical overlay |

Additional effects: `--shadow-inset`, `--shadow-active`, `--focus-glow`, `--valid-action-glow`, `--selected-item-glow`, and `--danger-glow`. Light and dark mappings use the semantic `--shadow-color`; no global glow is permitted.

### 14.9 Glass, surface hierarchy, icons, and asset direction

Glass variants are opt-in: subtle (82% surface opacity, 8px blur), elevated (88%, 14px), and gameplay HUD (90%, 12px). All use a visible border, a semantic shadow, and an opaque `@supports not (backdrop-filter)` fallback. They are forbidden behind long-form text and may be disabled by low-performance settings.

| Surface level | Background | Border | Depth | Radius | Use |
|---|---|---|---|---|---|
| App | background | none | 0 | none | Canvas |
| Section | muted/subtle | divider | 0 | none | Section grouping |
| Standard card | surface | border | 1 | card | Static content |
| Interactive card | surface | border strong on selection | 2 | card | Selectable item |
| Elevated panel | surface elevated | border | 2 | elevated | Sidebar/settings |
| Popover | popover | border strong | 3 | elevated | Menus/details |
| Dialog | surface elevated | border strong | 4 | dialog | Focused decision |
| Critical overlay | surface overlay/scrim | border strong | 5 | dialog | Reconnect/exit |
| Gameplay HUD | glass HUD/surface | border | 2 | gameplay panel | Status controls |
| Game board | game board fallback | game/strong border | inset/0 | gameplay panel | Board area |

Lucide is the sole interface icon set: 1.75px default stroke, 16px small, 20px standard, 24px large, 28px gameplay. Active state uses semantic color plus a selected container/label; it does not mix unrelated filled icon families. Icons assist navigation, actions, statuses, rewards, currency, connection, microphone, room, and gameplay actions; unfamiliar icons always retain text or tooltip access.

Original art direction: stylized 2.5D, rounded geometry, clean silhouettes, subtle texture, premium tabletop lighting, and readable small-size forms. Use SVG for icons/scalable UI assets; AVIF/WebP for illustrations; transparent PNG only where required; Lottie/Rive only after performance justification. Do not use copyrighted Monopoly, UNO, Ludo, or Werewolf assets.

### 14.10 Component specifications and interaction behavior

All component APIs use semantic variants, `className`, accessible labels, refs where appropriate, and discriminated props such as `variant="primary" size="lg" status="loading"`; never conflicting boolean variant flags.

| Component | Variants and sizes | Required visual/behavioral states |
|---|---|---|
| Button | primary, secondary, accent, success, warning, danger, outline, ghost, link, game action, icon, floating, segmented; compact–xl | default, hover, active, focus-visible, disabled, loading, selected; 44px touch target unless dense desktop context; loading preserves width |
| Input | text, password, search, number, room code, currency, chat, compact gameplay | default, hover, focus, filled, disabled, read-only, success, warning, error; label, description, prefix/suffix, clear action, validation, count |
| Room code input | fixed-length alphanumeric group | uppercase normalization, paste, clear error, accessible group label; mobile keyboard follows actual code format |
| Card | game, feature, player, bot, room, achievement, reward, property, statistic, settings, selection | default, hover, selected, focused, disabled, locked, loading, error, active turn |
| Dialog | standard, confirmation, destructive, action, result, reward, mobile full-screen, settings, reconnect, pause | constrained width/height, internal scroll, backdrop, focus trap, Escape policy, explicit destructive placement; deferred implementation |
| Tooltip / popover | standard, gameplay, shortcut, disabled explanation, status; menu/player/rules/emote/settings/property | keyboard/touch reachable; not hover-only; deferred implementation |
| Toast | neutral, success, info, warning, danger, achievement, connection, event | stacked, actionable, screen-reader aware; no auto-dismiss of critical states; deferred implementation |
| Badge | online/offline/guest/host/ready/bot/difficulty/rank/rarity/connection/player | semantic color plus text/icon; compact but readable |
| Avatar | image, initials, generated, bot/host/online/speaking/disconnected/active-turn/eliminated | player label remains available; color is supplemental |
| Progress | linear, circular, countdown, XP, download, matchmaking | value readable textually; low/critical timer tokens |
| Skeleton | game card, dashboard, player slot, room list, profile, leaderboard, shop, game loading, HUD | keeps layout stable; no false affordances |

Shared interaction states: hover (pointer-capable only), pressed, selected, focus-visible, dragging, drop target, disabled, loading, pending server confirmation, optimistic local display, rejected server action. Online controls distinguish local selection → pending server validation → accepted/reconciled → rejected with explanation → timed out/retry. The UI never labels an optimistic action as authoritative.

Gameplay status tokens include active turn, waiting, ready, not ready, bot thinking, valid/invalid/selected action, targeted/protected/eliminated/disconnected player, spectator, winner/second/third, low/critical time, unstable connection, and reconnecting. Components consume `--status-*` variables, never raw status colors.

### 14.11 Loading, empty, error, keyboard, motion, and audio visual states

Use immediate local acknowledgement for selection, skeletons for content sections, spinner only for short indeterminate work, progress for longer operations, and full-screen loading only when the route cannot continue. Game asset loading, matchmaking, reconnect, and resync each have persistent text status and a cancellation/recovery path. Avoid full-screen spinners for card, seat, or small control updates.

Every empty state has a short title, useful description, optional original illustration, one primary action, and optional secondary action. Required templates: no recent/saved games, friends, invitations, achievements, inventory, shop results, leaderboard data, empty room, chat, and history.

Every error surface provides user message, recovery action, fallback action, optional technical details, and a support/logging identifier where appropriate. Required templates: generic failure, offline, connection/reconnect loss, invalid/full/expired room, permission denied, version mismatch, saved-game corruption, asset failure, payment failure, update required, and maintenance.

Keyboard standard: Skip to content; Tab/Shift+Tab sequential navigation; Enter/Space activation; Escape close for dismissible overlays; arrow-key roving only for menus/tabs/segmented controls/card grids where documented; announced turn/connection updates with restrained live regions. Use `:focus-visible` and never remove the replacement ring.

Motion variables: `--duration-instant`, `--duration-fast`, `--duration-standard`, `--duration-deliberate`, `--duration-celebration`; `--ease-standard`, `--ease-enter`, `--ease-exit`, `--ease-emphasized`, `--ease-spring`. Do not use `transition: all`. Reduced motion removes looping, celebratory, parallax, shake, and nonessential transform motion while preserving state changes.

Audio visual-state variables: master/music/SFX/voice muted, microphone muted/active/unavailable, player speaking, browser audio blocked, and audio loading. Every cue has a visual equivalent. No audio engine is implemented in Phase 2.

### 14.12 CSS-variable, Shadcn, and component architecture

The adapted repository structure remains compact:

```text
packages/ui/src/styles.css      primitive, semantic, layout, motion, status, player, theme variables
packages/ui/src/tokens.ts       typed token names, player identifiers, component/status contracts
apps/web/src/app/globals.css    Tailwind v4 bridge, base rules, accessibility mode rules
apps/web/src/providers/         client-only theme behavior
apps/web/src/components/ui/     thin Shadcn-compatible primitives
apps/web/src/app/dev/design-system/  development-only preview
```

Conceptual layers are primitive palette → semantic tokens → component tokens → gameplay status tokens → game-theme overrides → accessibility overrides. This is intentionally one stylesheet during the small foundation stage; split files only when token ownership or build tooling requires it.

Shadcn strategy:

- Use without structural changes later: Button, Input, Card, Badge, Avatar, Progress, Skeleton, Separator, Tabs.
- Visually extend through token classes: Dialog, Tooltip, Popover, Dropdown Menu, Toast/Sonner, Select, Command.
- Wrap with project behavior: `AppButton`, `GameActionButton`, `AppDialog`, `GameDialog`, `AppTooltip`, `PlayerAvatar`, `StatusBadge`.
- Avoid using generic Shadcn components directly for gameplay-critical action selection, card targeting, secret reveals, timers, or board interactions; create purpose-built accessible wrappers with engine-provided action data.

### 14.13 Phase 3 readiness checklist, risks, and open decisions

- [x] #2D2765 is represented as the primary base and semantic states are specified.
- [x] Light, dark, system, high-contrast light, high-contrast dark, reduced-motion, player, game-theme, and gameplay status contracts are defined.
- [x] Typography supports Vietnamese and English through bounded font families.
- [x] Shared primitive variants, interaction, loading, empty, error, keyboard, and accessibility contracts are defined.
- [x] Shadcn extension and CSS-variable architecture are documented.
- [ ] Brand mark, custom illustrations, and final asset library require creative/legal approval.
- [ ] Theme persistence scope (guest device versus account sync) remains a product decision.
- [ ] Dialog/toast/tooltip choice and underlying accessibility library are deferred.
- [ ] Color-blind mode UI and game asset variants require user testing.
- [ ] Game-theme asset kits require accessibility and licensing review.

Risks: font network/loading cost; high-contrast themes masking game art; token proliferation; visual inconsistency if feature code bypasses semantic tokens; glass lowering text contrast/performance; player colors being treated as identity alone; and accidental secret-state announcements. Mitigations are system-font fallbacks, semantic token lint/review, opaque fallbacks, component contracts, non-color identity markers, and private-state accessibility tests.

**Phase 3 gate:** The foundation and specification are ready for approval. Do not begin global screens until the product owner explicitly approves Phase 3 — Global Screens.
