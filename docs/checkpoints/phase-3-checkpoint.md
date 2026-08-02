# Phase 3 checkpoint

## Completed

- Repository and Phase 2 foundation reviewed; Phase 2 validation baseline is accepted.
- Global-screen specification created at `docs/ux/phase-3-global-screens-specification.md`.
- Allowed local-data vertical slice implemented: guest Home, responsive AppShell, game library, reusable game detail, route loading/error states, and `/play/uno` handoff.
- Existing UNO engine/rules were not changed; its prototype was relocated from `/` to `/play/uno` so `/` can serve the platform home.

## Deliberately not implemented

Authentication, online rooms, matchmaking, invitations, social systems, shop, payments, backend/API changes, Socket.IO, game rooms, game boards, and Phase 4 work.

## Validation status

- `pnpm typecheck`: passed after the vertical-slice implementation.
- `pnpm lint`, `pnpm test`, `pnpm --filter @game-store/web build`, and `pnpm exec playwright test` subsequently passed after the intentional UNO route relocation to `/play/uno`.

## Approval gate

Do not begin Phase 4 Game Room work until Phase 3 validation is complete and this checkpoint is explicitly approved.
