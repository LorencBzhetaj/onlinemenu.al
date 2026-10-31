#!/usr/bin/env bash
# Restore i DB-së nga një dump i pg_dump (format custom) në një DB TARGET.
# Përdorim:
#   scripts/db-restore.sh <DUMP_FILE> <TARGET_DATABASE_URL>
#
# SIGURI: TARGET-i duhet të jetë një DB BOSH (sapo e krijuar). Skripti refuzon të shkruajë
# mbi një DB që ka tashmë tabela, përveçse me FORCE=1 (shmang mbishkrimin aksidental të prod).
# Kurrë mos e drejto te prod pa një plan kthimi dhe pa konfirmim eksplicit.
set -euo pipefail

DUMP="${1:-}"; TARGET="${2:-}"
if [ -z "$DUMP" ] || [ -z "$TARGET" ]; then
  echo "Përdorim: scripts/db-restore.sh <DUMP_FILE> <TARGET_DATABASE_URL>" >&2; exit 2
fi
if [ ! -f "$DUMP" ]; then echo "⛔ Dump-i s'u gjet: $DUMP" >&2; exit 2; fi

EXISTING="$(psql "$TARGET" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';" 2>/dev/null || echo "x")"
if [ "$EXISTING" = "x" ]; then echo "⛔ S'u lidh dot me TARGET." >&2; exit 2; fi
if [ "$EXISTING" != "0" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "⛔ TARGET ka tashmë $EXISTING tabela. Përdor një DB bosh, ose FORCE=1 me vetëdije." >&2
  exit 3
fi

echo "→ pg_restore $DUMP → $TARGET"
pg_restore -d "$TARGET" --no-owner --no-privileges "$DUMP"
echo "✅ Restore përfundoi. Tabela: $(psql "$TARGET" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
