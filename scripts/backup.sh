#!/usr/bin/env bash
# Cadangan database SQLite yang konsisten (WAL-safe). Pakai: scripts/backup.sh [DB_PATH] [DIR_TUJUAN]
set -euo pipefail
DB="${1:-data/garda.db}"; OUT="${2:-backups}"; mkdir -p "$OUT"
node --disable-warning=ExperimentalWarning -e "
const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);
d.exec(\"VACUUM INTO '\"+process.argv[2].replace(/'/g,\"''\")+\"'\");" "$DB" "$OUT/garda-$(date +%Y%m%d-%H%M%S).db"
echo "Cadangan tersimpan di $OUT"
