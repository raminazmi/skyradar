#!/usr/bin/env bash
# refresh-chunk-cron.sh
# مُوزّع دفعات لمهمة كرون *واحدة* على الاستضافة المشتركة: كل تشغيل يُنفّذ دفعة صغيرة واحدة
# (نموذج واحد + 12 ساعة ≈ 5 دقائق) فلا يُقتل بحدّ الزمن/المعالج. يدور تلقائياً على كل
# الدفعات عبر فهرس مخزَّن، فيُحدَّث كامل المدى (GFS + ECMWF، 0-120) تدريجياً.
#
# الإعداد: مهمة كرون واحدة كل 10 دقائق:
#   */10 * * * * cd /home/USER/site && PYTHON=/opt/alt/python311/bin/python3.11 \
#                /bin/bash scripts/refresh-chunk-cron.sh
#
# 20 دفعة × 10 دقائق ≈ دورة كاملة كل ~3.3 ساعة (تحديث مستمرّ). لا تتداخل عمليتان
# (كل دفعة ~5د < فاصل 10د). ICON غير مدرَج (يتعذّر على الاستضافة المشتركة).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${PYTHON:-python3}"
STATE="${STATE:-$ROOT/backend/storage/rasters-chunk-index}"
LOG="${LOG:-$ROOT/backend/storage/logs/rasters.log}"
mkdir -p "$(dirname "$STATE")" "$(dirname "$LOG")"

# مدى كل دفعة 12 ساعة (الحدّ الآمن المؤكَّد ~5د؛ 24س تُقتل). عدّل RANGES لتغيير المدى/التغطية.
RANGES=(0-12 13-24 25-36 37-48 49-60 61-72 73-84 85-96 97-108 109-120)

# قائمة المهام: لكل مدى، GFS ثم ECMWF (نموذج واحد لكل تشغيل = عملية قصيرة).
JOBS=()
for r in "${RANGES[@]}"; do
  JOBS+=("GFS:$r")
  JOBS+=("ECMWF:$r")
done
N=${#JOBS[@]}

idx=0
[ -f "$STATE" ] && idx=$(cat "$STATE" 2>/dev/null || echo 0)
case "$idx" in (''|*[!0-9]*) idx=0 ;; esac
[ "$idx" -ge "$N" ] && idx=0

job="${JOBS[$idx]}"
model="${job%%:*}"; hours="${job##*:}"
if [ "$model" = "GFS" ]; then GFLAG=1; EFLAG=0; else GFLAG=0; EFLAG=1; fi

echo "[$(date -u +%FT%TZ)] chunk dispatcher: idx=$idx/$N model=$model hours=$hours" >> "$LOG"

# نُقدّم الفهرس *قبل* التشغيل، فحتى لو قُتلت هذه الدفعة لا نعلق عليها — تُعاد لاحقاً في الدورة.
echo $(( (idx + 1) % N )) > "$STATE"

PYTHON="$PY" HOURS="$hours" GFS="$GFLAG" ECMWF="$EFLAG" ICON=0 \
  /bin/bash "$ROOT/scripts/refresh-rasters-cron.sh" || \
  echo "[$(date -u +%FT%TZ)] chunk idx=$idx ($model $hours) فشل/قُتل — يُعاد في الدورة" >> "$LOG"
