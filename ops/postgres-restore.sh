#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:?Usage: postgres-restore.sh BACKUP_FILE}"
restore_database="${RESTORE_DATABASE:-game_store_restore_verify}"
[[ -f "$backup_file" ]] || { printf 'Backup does not exist: %s\n' "$backup_file" >&2; exit 1; }
[[ "$restore_database" =~ ^[a-zA-Z][a-zA-Z0-9_]{2,62}$ ]] || { printf 'Unsafe restore database name\n' >&2; exit 1; }
[[ "$restore_database" != "game_store" ]] || { printf 'Refusing to overwrite the primary database\n' >&2; exit 1; }

docker compose exec -T postgres dropdb --username game_store --if-exists "$restore_database"
docker compose exec -T postgres createdb --username game_store "$restore_database"
docker compose exec -T postgres pg_restore --username game_store --dbname "$restore_database" --exit-on-error --no-owner --no-privileges < "$backup_file"
docker compose exec -T postgres psql --username game_store --dbname "$restore_database" --set ON_ERROR_STOP=1 --tuples-only --command 'SELECT COUNT(*) FROM "_prisma_migrations"; SELECT COUNT(*) FROM "User"; SELECT COUNT(*) FROM "GameSession"; SELECT COUNT(*) FROM "GameResult";'
