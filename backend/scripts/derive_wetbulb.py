#!/usr/bin/env python3
"""
derive_wetbulb.py
يولّد نُسج "درجة اللمبة الرطبة" (wet-bulb_NNN.png) باشتقاقها من نُسج الحرارة + الرطوبة —
بصيغة Stull (2011) التقريبية الشهيرة (صالحة لضغط سطح البحر، RH 5–99%، Ta −20..50°م):

  Tw = Ta·atan(0.151977·√(RH+8.313659)) + atan(Ta+RH) − atan(RH−1.676331)
       + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035

بهذا تسلك الطبقة نفس مسار الحرارة (raster + تطبيع + ألوان + رسم موحّد). المدى [-40,40].

الاستخدام:
  python derive_wetbulb.py --dir ../../public/rasters --hours 0-120
"""
import os, sys, argparse
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gfs_to_raster as g

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

TEMP_MIN, TEMP_MAX = -50.0, 55.0   # تطبيع نسيج الحرارة المصدر
WB_MIN, WB_MAX = -40.0, 40.0       # تطبيع نسيج اللمبة الرطبة (يطابق VALUE_RANGES['wet-bulb'])


def parse_hours(spec):
    if '-' in spec:
        a, b = spec.split('-'); return list(range(int(a), int(b) + 1))
    return [int(x) for x in spec.split(',')]


def wet_bulb(ta, rh):
    """صيغة Stull (مصفوفات numpy؛ الزوايا راديان). rh بـ %، ta بـ °م."""
    rh = np.clip(rh, 1.0, 100.0)
    return (ta * np.arctan(0.151977 * np.sqrt(rh + 8.313659))
            + np.arctan(ta + rh) - np.arctan(rh - 1.676331)
            + 0.00391838 * np.power(rh, 1.5) * np.arctan(0.023101 * rh)
            - 4.686035)


def derive_hour(d, h):
    tp = os.path.join(d, f"temperature_{h:03d}.png")
    hp = os.path.join(d, f"humidity_{h:03d}.png")
    if not (os.path.exists(tp) and os.path.exists(hp)):
        return False

    t = np.asarray(Image.open(tp).convert('L'), dtype=np.float64)
    ta = TEMP_MIN + (t / 255.0) * (TEMP_MAX - TEMP_MIN)
    rh = np.asarray(Image.open(hp).convert('L'), dtype=np.float64) / 255.0 * 100.0

    tw = wet_bulb(ta, rh)
    norm = np.clip((tw - WB_MIN) / (WB_MAX - WB_MIN), 0.0, 1.0)
    img = (norm * 255.0).round().astype(np.uint8)
    g.write_png_gray(os.path.join(d, f"wet-bulb_{h:03d}.png"), img)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--hours', default='0-120')
    args = ap.parse_args()
    d = os.path.abspath(args.dir)
    ok = 0
    for h in parse_hours(args.hours):
        try:
            if derive_hour(d, h):
                ok += 1
        except Exception as e:
            print(f"  wet-bulb f{h:03d} فشل: {e!r}", flush=True)
    print(f"== wet-bulb: {ok} نسيج مُشتقّ في {d} ==", flush=True)


if __name__ == '__main__':
    main()
