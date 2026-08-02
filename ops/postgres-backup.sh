#!/usr/bin/env bash
set -euo pipefail

backup_dir="${BACKUP_DIR:-./backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_dir/game-store-$timestamp.dump"

docker compose exec -T postgres pg_dump --username game_store --dbname game_store --format custom --compress 6 --no-owner --no-privileges > "$target"
pg_restore --list "$target" >/dev/null 2>&1 || docker compose exec -T postgres pg_restore --list < "$target" >/dev/null
sha256sum "$target" > "$target.sha256"
find "$backup_dir" -type f -name 'game-store-*.dump*' -mtime "+$retention_days" -delete
printf '%s\n' "$target"
