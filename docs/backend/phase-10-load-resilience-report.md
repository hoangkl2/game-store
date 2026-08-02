# Phase 10 Load and Resilience Report

Status: **BLOCKED — HARNESSES IMPLEMENTED, NO REPRESENTATIVE RUN**  
Date: 2026-08-02

## Implemented profiles

- `pnpm --filter @game-store/api load:smoke` uses Autocannon against an explicit `LOAD_BASE_URL`, records latency/throughput/errors/timeouts/non-2xx output, and fails on errors.
- `pnpm --filter @game-store/api test:production-flow` executes the required 20-step two-instance workflow only when `RUN_PRODUCTION_FLOW=true`.
- The production harness checks duplicate acknowledgements, cross-instance projections, one-instance loss, reconnect, private projection separation, match completion, result persistence, all-service restart, and backup/restore.
- Snapshot resilience is unit-tested: corrupt latest snapshot quarantine, encrypted command replay, and fail-closed broken-chain behavior.
- `pnpm --filter @game-store/api smoke:runtime` starts the production bundle with optional dependencies disabled and verifies liveness, readiness, and Prometheus process metrics.

## Local outcomes

| Profile | Result |
| --- | --- |
| Nest production-bundle process smoke | PASS |
| Corrupt-snapshot recovery unit profile | PASS — 2/2 |
| Full browser regression with one bounded worker | PASS — 13/13 |
| PostgreSQL/Redis repository integration | BLOCKED |
| Duplicate/stale action concurrency under real database | BLOCKED |
| Socket.IO multi-instance fan-out | BLOCKED |
| Reconnect storm and process-loss recovery | BLOCKED |
| Redis interruption/restoration | BLOCKED |
| PostgreSQL restart/partial-write recovery | BLOCKED |
| Backup/restore | BLOCKED |
| Autocannon throughput/latency profile | BLOCKED |
| Container health/failover | BLOCKED |

No throughput, p95/p99 latency, CPU, heap, event-loop lag, error-rate, RPO, or RTO number is reported because no valid dependency-backed run occurred. Specification targets remain non-binding objectives.

## Blocker and remediation

Docker Desktop's WSL VM creation fails with `Wsl/Service/CreateInstance/CreateVm/HCS/0x80070032`; the Docker daemon is absent, and native PostgreSQL/Redis clients are unavailable. Repair/enable WSL virtualization and Docker, or run the checked-in CI `production-flow` job on an approved Linux runner. Then archive `test-results/phase-10-production-flow.json`, `test-results/phase-10-load-smoke.json`, backup checksums, restore output, metrics, and sanitized logs.

Load and resilience acceptance is **BLOCKED**, and no production capacity claim is made.
