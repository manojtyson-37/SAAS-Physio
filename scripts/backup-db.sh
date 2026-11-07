#!/usr/bin/env bash
# Logical backup of the saas-physio Neon DB (read-only pg_dump). Keeps the 30 newest dumps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
set -a; source "$ROOT/.env"; set +a
DEST="${BACKUP_DIR:-$HOME/Backups/saas-physio}"
mkdir -p "$DEST"
OUT="$DEST/saas-physio-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner "$DATABASE_URL_UNPOOLED" -f "$OUT"
pg_restore --list "$OUT" >/dev/null   # fails if the dump is unreadable
ls -1t "$DEST"/saas-physio-*.dump | tail -n +31 | xargs -I{} rm -- "{}"
echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
