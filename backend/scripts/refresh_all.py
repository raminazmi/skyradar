#!/usr/bin/env python3
"""
refresh_all.py
يعيد توليد كل نُسج الطقس (جميع المتغيّرات × ساعات التوقّع) في عملية واحدة — أسرع من
استدعاء gfs_to_raster.py لكل متغيّر (يُحمّل cfgrib/eccodes مرّة واحدة). يكتب فوق
public/rasters/<var>_<hhh>.png، فيلتقط أحدث دورة GFS متاحة تلقائياً عند كل تشغيل.

الاستخدام:
  python refresh_all.py                 # كل المتغيّرات، الساعات 0-24
  python refresh_all.py --hours 0-48
  python refresh_all.py --vars temperature,wind --hours 0-12
"""
import os, sys, time, argparse

# طرفية ويندوز قد تكون cp1256 فتفشل على رموز مثل ← أو الأسهم؛ نفرض UTF-8 للمخرجات.
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# نعيد استخدام منطق التحميل/الترميز نفسه (وبه جسر eccodes على ويندوز).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gfs_to_raster as g

# مجلّد المخرجات الافتراضي: public/rasters الأمامي (ما يقرأه التطبيق فعلياً).
DEFAULT_OUTDIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'rasters'))

# كل المتغيّرات المدعومة (السبعة السلَّمية + الرياح U/V).
ALL_VARS = list(g.VAR_CONFIG) + ['wind']


def refresh(vars_list, hours, outdir):
    t0 = time.time()
    ok = fail = 0
    for var in vars_list:
        cfg = g.VAR_CONFIG.get(var)
        for h in hours:
            out = os.path.join(outdir, f"{var}_{h:03d}.png")
            try:
                g.generate_one(cfg, var, h, out)
                ok += 1
            except Exception as e:
                fail += 1
                print(f"  ✗ {var} f{h:03d}: {e!r}", flush=True)
    dt = round(time.time() - t0, 1)
    print(f"== اكتمل: {ok} نسيج، {fail} فشل، في {dt}ث ==", flush=True)
    return fail


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vars', help="قائمة متغيّرات مفصولة بفواصل (افتراضي: الكل)")
    ap.add_argument('--hours', default='0-24', help="نطاق ساعات، مثل 0-24 أو 0,3,6")
    ap.add_argument('--outdir', default=DEFAULT_OUTDIR)
    args = ap.parse_args()

    vars_list = args.vars.split(',') if args.vars else ALL_VARS
    hours = g.parse_hours(args.hours)
    os.makedirs(args.outdir, exist_ok=True)
    print(f"تحديث {len(vars_list)} متغيّر × {len(hours)} ساعة → {args.outdir}", flush=True)
    sys.exit(1 if refresh(vars_list, hours, args.outdir) else 0)


if __name__ == '__main__':
    main()
