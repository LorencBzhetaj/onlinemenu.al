#!/usr/bin/env bash
# Backup i DB-së (pg_dump, format custom i kompresuar) — për staging/prod dhe test.
# Përdorim:
#   DATABASE_URL=postgresql://... scripts/db-backup.sh [DIR]
# Default DIR = ./backups. Emri: <dbname>-<YYYYmmdd-HHMMSS>.dump
#
# SHËNIM (Faza 8): git bundle ruan KODIN, jo të dhënat e DB-së. Rikuperimi i të dhënave
# kërkon këtë backup + scripts/db-restore.sh. Testo restore-in periodikisht (jo vetëm dump).
set -euo pipefail

URL="${DATABASE_URL:-}"
if [ -z "$URL" ]; then echo "⛔ DATABASE_URL mungon." >&2; exit 2; fi

DIR="${1:-./backups}"
mkdir -p "$DIR"
DBNAME="$(basename "${URL%%\?*}")"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/${DBNAME}-${STAMP}.dump"

echo "→ pg_dump $DBNAME → $OUT"
pg_dump "$URL" -Fc -f "$OUT"
echo "✅ Backup: $OUT ($(du -h "$OUT" | cut -f1))"
