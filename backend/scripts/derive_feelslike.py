#!/usr/bin/env python3
"""
derive_feelslike.py
يولّد نُسج "الإحساس الحراري" (feels-like_NNN.png) باشتقاقها من نُسج الحرارة/الرطوبة/الرياح
المولّدة أصلاً — لأن APTMP غير متاح عبر فلتر NOMADS. بهذا تسلك طبقة الإحساس *نفس مسار*
الحرارة الفعلية تماماً (raster + نفس التطبيع [-50,55] + نفس تدرّج الألوان + نفس الرسم).

الصيغة: صيغة BoM الأسترالية القياسية (سليمة لكل المدى، تشمل الرطوبة والرياح):
    AT = Ta + 0.33·e − 0.70·ws − 4.00 ،  e = (RH/100)·6.105·exp(17.27·Ta/(237.7+Ta))
حيث ws بوحدة م/ث (الرياح بـ km/h ÷ 3.6).

الاستخدام:
  python derive_feelslike.py --dir ../../public/rasters --hours 0-120
"""
import os, sys, argparse
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gfs_to_raster as g  # write_png_gray وثوابت التطبيع

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

TEMP_MIN, TEMP_MAX = -50.0, 55.0   # يطابق VAR_CONFIG['temperature'] / VALUE_RANGES
WIND_SPEED_MAX = 120.0             # يطابق نسيج الرياح (القناة R = speed/120)


def parse_hours(spec):
    if '-' in spec:
        a, b = spec.split('-'); return list(range(int(a), int(b) + 1))
    return [int(x) for x in spec.split(',')]


def derive_hour(d, h):
    tp = os.path.join(d, f"temperature_{h:03d}.png")
    hp = os.path.join(d, f"humidity_{h:03d}.png")
    wp = os.path.join(d, f"wind_{h:03d}.png")
    if not (os.path.exists(tp) and os.path.exists(hp) and os.path.exists(wp)):
        return False

    t = np.asarray(Image.open(tp).convert('L'), dtype=np.float64)
    ta = TEMP_MIN + (t / 255.0) * (TEMP_MAX - TEMP_MIN)
    rh = np.asarray(Image.open(hp).convert('L'), dtype=np.float64) / 255.0 * 100.0
    wr = np.asarray(Image.open(wp).convert('RGB'), dtype=np.float64)[:, :, 0]  # القناة R = السرعة
    ws_ms = (wr / 255.0 * WIND_SPEED_MAX) / 3.6

    e = (rh / 100.0) * 6.105 * np.exp(17.27 * ta / (237.7 + ta))
    at = ta + 0.33 * e - 0.70 * ws_ms - 4.00

    norm = np.clip((at - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), 0.0, 1.0)
    img = (norm * 255.0).round().astype(np.uint8)
    g.write_png_gray(os.path.join(d, f"feels-like_{h:03d}.png"), img)
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
            print(f"  feels-like f{h:03d} فشل: {e!r}", flush=True)
    print(f"== feels-like: {ok} نسيج مُشتقّ في {d} ==", flush=True)


if __name__ == '__main__':
    main()
