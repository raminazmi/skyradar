#!/usr/bin/env python3
"""
build_cubes.py
يبني "مكعّبات" بيانات ثنائية مضغوطة من نُسج PNG المولّدة (public/rasters/*.png)، تتيح
قراءة قيمة أي نقطة عبر كل الساعات بإزاحة بايت مباشرة — بلا فكّ صورة لكل نقرة. هذا أساس
لوحة التوقّعات عند نقطة *بلا Open-Meteo نهائياً*: endpoint النقطة يقرأ هذه المكعّبات فقط.

لكل متغيّر ملفّ <var>.cube بصيغة:
  الترويسة (little-endian):
    magic   4 بايت  = b'RCUB'
    version uint8    = 1
    channels uint8   (1 سلَّمي R، 3 للرياح: speed,u,v)
    hours   uint16
    height  uint16
    width   uint16
    run_epoch uint32 (ثوانٍ، زمن دورة f000 من meta.json)
  ثم البيانات: hours × height × width × channels بايت (uint8). الصفّ 0 = الجنوب (مطابق
  النسيج/الـ sampler)، العمود 0 = خط الطول −180.

نُصغّر الدقّة (افتراضياً ÷2 → ~0.5°) فيبقى المكعّف صغيراً (نقاط التوقّع لا تحتاج 0.25°)،
بينما تبقى النُسج عالية الدقّة لعرض الخريطة. الاستخدام:
  python build_cubes.py --dir ../../public/rasters
  python build_cubes.py --dir ../../public/rasters/ecmwf --downsample 2
"""
import os, sys, json, glob, struct, argparse
import numpy as np
from PIL import Image

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

MAGIC = b'RCUB'
# متغيّرات سلَّمية (قناة R) + الرياح (3 قنوات). تطابق أسماء ملفات PNG.
SCALAR_VARS = ['temperature', 'dewpoint', 'humidity', 'pressure', 'clouds', 'wind-gusts', 'precipitation']
WIND_VAR = 'wind'


def discover_hours(d, var):
    """يعيد قائمة الساعات المتاحة لمتغيّر (مرتّبة) من أسماء الملفّات <var>_NNN.png."""
    hours = []
    for p in glob.glob(os.path.join(d, f"{var}_*.png")):
        name = os.path.basename(p)
        stem = name[len(var) + 1:-4]  # NNN
        if stem.isdigit():
            hours.append(int(stem))
    return sorted(hours)


def build_var(d, var, hours, downsample, run_epoch):
    channels = 3 if var == WIND_VAR else 1
    # نقرأ الإطار الأوّل لتحديد الأبعاد بعد التصغير.
    first = Image.open(os.path.join(d, f"{var}_{hours[0]:03d}.png"))
    W0, H0 = first.size
    W, H = max(1, W0 // downsample), max(1, H0 // downsample)
    n = max(hours) + 1  # نملأ حتى أبعد ساعة (الفجوات تُكرَّر من السابق)

    out = os.path.join(d, 'cubes', f"{var}.cube")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'wb') as f:
        f.write(MAGIC)
        f.write(struct.pack('<BBHHHI', 1, channels, n, H, W, int(run_epoch)))

        prev = None
        have = set(hours)
        for h in range(n):
            if h in have:
                img = Image.open(os.path.join(d, f"{var}_{h:03d}.png"))
                if (W, H) != img.size:
                    img = img.resize((W, H), Image.BILINEAR)
                arr = np.asarray(img.convert('RGB' if channels == 3 else 'L'), dtype=np.uint8)
                prev = arr
            elif prev is not None:
                arr = prev  # فجوة ساعة (ECMWF كل 3س): كرّر أقرب إطار سابق
            else:
                arr = np.zeros((H, W, channels) if channels == 3 else (H, W), dtype=np.uint8)

            if channels == 3:
                f.write(arr[:, :, :3].tobytes())
            else:
                f.write(arr.tobytes())
    size_mb = os.path.getsize(out) / 1e6
    print(f"  cube {var}: {n}h × {H}×{W} × {channels}ch → {size_mb:.1f}MB", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True, help="مجلّد النُسج (به <var>_NNN.png و meta.json)")
    ap.add_argument('--downsample', type=int, default=2, help="معامل تصغير الدقّة (افتراضي 2 ≈ 0.5°)")
    args = ap.parse_args()

    d = os.path.abspath(args.dir)
    meta_path = os.path.join(d, 'meta.json')
    run_epoch = 0
    if os.path.exists(meta_path):
        run_epoch = int(json.load(open(meta_path)).get('run_epoch', 0))

    print(f"بناء المكعّبات من: {d} (تصغير ÷{args.downsample}, run_epoch={run_epoch})", flush=True)
    for var in SCALAR_VARS + [WIND_VAR]:
        hours = discover_hours(d, var)
        if not hours:
            print(f"  تخطّي {var}: لا إطارات", flush=True)
            continue
        build_var(d, var, hours, args.downsample, run_epoch)
    print("== تمّ بناء المكعّبات ==", flush=True)


if __name__ == '__main__':
    main()
