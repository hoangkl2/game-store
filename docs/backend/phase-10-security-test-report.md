# Phase 10 Security Test Report

Status: **PARTIAL PASS — INFRASTRUCTURE TESTS BLOCKED**  
Date: 2026-08-02  
Scope: Phase 10 runtime foundation only.

## Automated evidence

| Control | Result | Evidence |
| --- | --- | --- |
| Password hashing and constant-time verification | PASS | Existing backend-core scrypt suite; unknown-user login uses a fixed valid dummy hash to reduce enumeration timing differences. |
| Unsafe production environment defaults | PASS | Tests reject insecure cookies, non-TLS production dependencies, non-HTTPS production CORS, unsafe placeholders, malformed keys, missing metrics credentials, and invalid limits. |
| State confidentiality/integrity | PASS | AES-256-GCM round-trip, random IV, tamper/wrong-key/checksum rejection. |
| Hidden-data projection | PASS | Raw Color Clash and Moon Village tests cover opponent hands, roles, team data, night targets, investigations, protection logs, unresolved votes, eliminated-player actions, spectators, and moderator grants. |
| Corrupt snapshot fallback | PASS | Latest snapshot quarantine plus contiguous encrypted command-journal replay; no valid chain fails closed. |
| Action shape/authority spoofing | PASS | Only engine action envelopes are accepted; seat identity/player/control and state versions are server-checked. |
| Dependency vulnerabilities | PASS | Initial audit found three high transitive findings in `sharp`/`postcss`; patched overrides applied. Final production audit reports no known vulnerabilities. |
| Secret signatures | PASS | Source/config scan for private keys and common provider-token signatures reports no findings. |
| Structured-log/audit redaction | PASS | Backend-core tests pass. Auth, room, and accepted-action audit facts commit transactionally with state changes. |
| Build/runtime wiring | PASS | Production bundle and dependency-optional Nest process smoke pass; Helmet, bounded parsers, exact CORS, safe errors, health, and metrics initialize. |

API security-focused coverage scope: 20 tests across five files. Configured security-boundary files report 100% statements/functions/lines and 99.04% branches. This is not whole-API coverage.

## Implemented but runtime-blocked tests

`apps/api/test/e2e/production-runtime.test.ts` covers registration, authorization denial, DTO mass assignment, SQL-injection-shaped input, exact CORS, refresh rotation/replay/auth-epoch revocation, persisted room setup, concurrent duplicate execution, stale versions, and one-use reconnect. It requires real PostgreSQL and Redis and was skipped locally.

`apps/api/test/production-flow.ts` adds safe WebSocket authentication, two-instance projection delivery, backend loss, reconnect, result persistence, full restart, backup, and isolated restore. It refuses execution without explicit authorization and live Compose dependencies.

| Required case | Local result |
| --- | --- |
| Refresh lifecycle/replay under PostgreSQL concurrency | BLOCKED |
| CSRF cookie/origin behavior through real persistence | BLOCKED |
| SQL injection and mass assignment through Prisma runtime | BLOCKED |
| Room/seat authorization bypass against stored records | BLOCKED |
| Socket spoofing/session revocation/oversized payload | BLOCKED |
| Durable replay/idempotency concurrency/stale fence | BLOCKED |
| Redis rate-limit bypass across HTTP and Socket.IO | BLOCKED |
| Container/image vulnerability and health scan | BLOCKED |

## Fixed blocker/high findings

- Moved WebSocket authentication into namespace middleware; every event revalidates the access session.
- Unified HTTP/socket identity-session rate buckets and added HTTP `Retry-After`.
- Added exact origin/JSON checks for auth cookie mutations, double-submit CSRF, root-path `__Host-` compatible cookies, refresh retries, and family replay revocation.
- Made registration/session/audit, refresh/audit, logout/audit, room/session/audit, and accepted action/audit changes atomic.
- Added database fencing for expired Redis lock owners, safe transport errors, and bounded UUID/room-code inputs.
- Fixed high-severity dependency findings and reran build/tests/audit.

## Remaining risks

- No database/Redis-backed runtime evidence on this host.
- No managed KMS/key rotation, TLS/ACL verification, WAF/load-balancer policy, MFA/admin workflow, email verification/reset provider, or cloud secret manager.
- No external DAST, container scanner, penetration test, or CI execution evidence.
- The local signature scanner is defense-in-depth, not provider-side secret detection.

Security acceptance is **BLOCKED** until all infrastructure-backed tests pass in an approved isolated environment.
