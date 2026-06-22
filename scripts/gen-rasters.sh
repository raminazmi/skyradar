#!/usr/bin/env bash
# توليد نُسج الطقس (rasters) من بيانات GFS إلى مجلّد public/rasters.
# تُولَّد على السيرفر ولا تُحفظ في git. يُستدعى من deploy.sh ومن cron.
#
# الاستخدام:
#   bash scripts/gen-rasters.sh                 # إلى backend/public/rasters (إنتاج)
#   OUTDIR=public/rasters bash scripts/gen-rasters.sh   # تطوير محلّي
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${PYTHON:-python3}"
HOURS="${HOURS:-0-24}"
# في الإنتاج المجلّد الجذر للخدمة هو backend/public؛ محلّياً public/
OUTDIR="${OUTDIR:-$ROOT/backend/public/rasters}"

# الأنواع المدعومة في gfs_to_raster.py (VAR_CONFIG) + wind (قنوات U/V خاصة)
VARS=(temperature humidity pressure wind-gusts precipitation wind)

mkdir -p "$OUTDIR"
echo "==> توليد rasters إلى: $OUTDIR (ساعات $HOURS)"
for v in "${VARS[@]}"; do
  echo "  - $v"
  "$PY" "$ROOT/backend/scripts/gfs_to_raster.py" --var "$v" --hours "$HOURS" --outdir "$OUTDIR"
done
echo "==> تمّ توليد كل النُسج."
