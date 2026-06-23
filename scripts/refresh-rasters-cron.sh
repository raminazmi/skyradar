#!/usr/bin/env bash
# refresh-rasters-cron.sh
# يعيد توليد كل نُسج الطقس من أحدث دورة GFS — مُعدّ للتشغيل عبر cron على السيرفر.
# يكتب فوق الملفات نفسها (بصمة قرص ثابتة، بلا تراكم).
#
# الاستخدام اليدوي:
#   PYTHON=~/virtualenv/skyradar/3.11/bin/python bash scripts/refresh-rasters-cron.sh
#
# في cron: مرّر PYTHON بمسار مفسّر بايثون الذي ثبّتت فيه requirements.txt.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${PYTHON:-python3}"
OUTDIR="${OUTDIR:-$ROOT/backend/public/rasters}"
HOURS="${HOURS:-0-24}"
LOG="${LOG:-$ROOT/backend/storage/logs/rasters.log}"

mkdir -p "$OUTDIR" "$(dirname "$LOG")"
echo "[$(date -u +%FT%TZ)] refresh start (hours=$HOURS)" >> "$LOG"
"$PY" "$ROOT/backend/scripts/refresh_all.py" --hours "$HOURS" --outdir "$OUTDIR" >> "$LOG" 2>&1
echo "[$(date -u +%FT%TZ)] refresh done (exit $?)" >> "$LOG"
