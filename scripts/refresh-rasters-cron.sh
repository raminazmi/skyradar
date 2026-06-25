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
HOURS="${HOURS:-0-120}"   # 5 أيام: لوحة النقطة (rasters-only) تعرض حتى 120 ساعة
ECMWF="${ECMWF:-1}"        # 1 = ولّد ECMWF أيضاً (يتطلّب حزمة ecmwf-opendata)
ICON="${ICON:-1}"          # 1 = ولّد ICON أيضاً (DWD opendata + scipy لإعادة التشبيك)
LOG="${LOG:-$ROOT/backend/storage/logs/rasters.log}"

mkdir -p "$OUTDIR" "$(dirname "$LOG")"

# GFS: نُسج + meta + مكعّبات النقطة (refresh_all يبني المكعّبات تلقائياً في النهاية).
echo "[$(date -u +%FT%TZ)] GFS refresh start (hours=$HOURS)" >> "$LOG"
"$PY" "$ROOT/backend/scripts/refresh_all.py" --hours "$HOURS" --outdir "$OUTDIR" >> "$LOG" 2>&1
echo "[$(date -u +%FT%TZ)] GFS refresh done (exit $?)" >> "$LOG"

# ECMWF: مجلّد منفصل rasters/ecmwf + مكعّباته (open data كل 3 ساعات).
if [ "$ECMWF" = "1" ]; then
  ECMWF_OUT="$OUTDIR/ecmwf"
  mkdir -p "$ECMWF_OUT"
  echo "[$(date -u +%FT%TZ)] ECMWF refresh start (hours=$HOURS)" >> "$LOG"
  "$PY" "$ROOT/backend/scripts/ecmwf_to_raster.py" --hours "$HOURS" --outdir "$ECMWF_OUT" >> "$LOG" 2>&1 || \
    echo "[$(date -u +%FT%TZ)] ECMWF فشل (تحقّق من ecmwf-opendata)" >> "$LOG"
  "$PY" "$ROOT/backend/scripts/derive_feelslike.py" --dir "$ECMWF_OUT" --hours "$HOURS" >> "$LOG" 2>&1 || true
  "$PY" "$ROOT/backend/scripts/derive_wetbulb.py" --dir "$ECMWF_OUT" --hours "$HOURS" >> "$LOG" 2>&1 || true
  "$PY" "$ROOT/backend/scripts/build_cubes.py" --dir "$ECMWF_OUT" --downsample 2 >> "$LOG" 2>&1 || true
  echo "[$(date -u +%FT%TZ)] ECMWF refresh done" >> "$LOG"
fi

# ICON: مجلّد منفصل rasters/icon + مكعّباته (DWD opendata، إعادة تشبيك من شبكة icosahedral).
if [ "$ICON" = "1" ]; then
  ICON_OUT="$OUTDIR/icon"
  mkdir -p "$ICON_OUT"
  echo "[$(date -u +%FT%TZ)] ICON refresh start (hours=$HOURS)" >> "$LOG"
  "$PY" "$ROOT/backend/scripts/icon_to_raster.py" --hours "$HOURS" --outdir "$ICON_OUT" >> "$LOG" 2>&1 || \
    echo "[$(date -u +%FT%TZ)] ICON فشل (تحقّق من scipy/DWD opendata)" >> "$LOG"
  "$PY" "$ROOT/backend/scripts/derive_feelslike.py" --dir "$ICON_OUT" --hours "$HOURS" >> "$LOG" 2>&1 || true
  "$PY" "$ROOT/backend/scripts/derive_wetbulb.py" --dir "$ICON_OUT" --hours "$HOURS" >> "$LOG" 2>&1 || true
  "$PY" "$ROOT/backend/scripts/build_cubes.py" --dir "$ICON_OUT" --downsample 2 >> "$LOG" 2>&1 || true
  echo "[$(date -u +%FT%TZ)] ICON refresh done" >> "$LOG"
fi
