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
import os, sys, time, json, datetime, argparse

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

# المتغيّرات التي تستخدمها الواجهة فعلاً (RASTER_TYPES) + الرياح U/V.
# نستبعد feels-like: غير متاح عبر فلتر NOMADS ولا تستهلكه الواجهة كـ raster.
ALL_VARS = [v for v in g.VAR_CONFIG if v != 'feels-like'] + ['wind']


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


def write_meta(outdir, hours, run_epoch):
    """يكتب meta.json بزمن الدورة المثبّتة نفسها التي وُلِّدت منها كل الإطارات — فتتطابق
    محاذاة "الآن" في الواجهة تماماً مع بيانات الإطارات (لا انزياح ولا قفزات)."""
    meta = {'run_epoch': run_epoch, 'hours': max(hours) + 1, 'generated_epoch': int(time.time())}
    with open(os.path.join(outdir, 'meta.json'), 'w') as f:
        json.dump(meta, f)
    print(f"meta.json: run_epoch={run_epoch} hours={meta['hours']}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vars', help="قائمة متغيّرات مفصولة بفواصل (افتراضي: الكل)")
    ap.add_argument('--hours', default='0-24', help="نطاق ساعات، مثل 0-24 أو 0,3,6")
    ap.add_argument('--outdir', default=DEFAULT_OUTDIR)
    args = ap.parse_args()

    vars_list = args.vars.split(',') if args.vars else ALL_VARS
    hours = g.parse_hours(args.hours)
    os.makedirs(args.outdir, exist_ok=True)

    # نثبّت دورة GFS واحدة متاحة بالكامل حتى أبعد ساعة، فيأتي كل متغيّر/إطار منها →
    # تسلسل زمني متّسق ومحاذاة "الآن" صحيحة. عند الفشل: نسقط على سلوك الحلّ-عند-الطلب.
    try:
        day, run, run_epoch = g.resolve_cycle(max(hours))
        print(f"دورة GFS المثبّتة: {day}/{run:02d}z (run_epoch={run_epoch})", flush=True)
    except Exception as e:
        run_epoch = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
        print(f"تعذّر تثبيت الدورة ({e!r}) — حلّ عند الطلب لكل ساعة.", flush=True)

    print(f"تحديث {len(vars_list)} متغيّر × {len(hours)} ساعة → {args.outdir}", flush=True)
    failed = refresh(vars_list, hours, args.outdir)
    write_meta(args.outdir, hours, run_epoch)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
