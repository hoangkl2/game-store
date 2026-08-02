#!/usr/bin/env bash
set -euo pipefail

backup="$(BACKUP_RETENTION_DAYS=36500 ./ops/postgres-backup.sh)"
RESTORE_DATABASE=game_store_restore_verify ./ops/postgres-restore.sh "$backup"
source_count="$(docker compose exec -T postgres psql -U game_store -d game_store -Atc 'SELECT COUNT(*) FROM "GameResult"')"
restore_count="$(docker compose exec -T postgres psql -U game_store -d game_store_restore_verify -Atc 'SELECT COUNT(*) FROM "GameResult"')"
[[ "$source_count" = "$restore_count" ]] || { printf 'Result count mismatch: source=%s restored=%s\n' "$source_count" "$restore_count" >&2; exit 1; }
printf 'Backup restore verified: GameResult=%s\n' "$restore_count"
