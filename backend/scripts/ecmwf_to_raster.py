#!/usr/bin/env python3
"""
ecmwf_to_raster.py
ينزّل حقول ECMWF IFS العالمية المجانية (open data، شبكة regular lat/lon 0.25°) ويحوّلها
إلى صور PNG مطابقة لمخرجات GFS — لكن في مجلّد منفصل rasters/ecmwf/ كي يختار التطبيق
النموذج عبر المجلّد. يعيد استخدام كاتب PNG والتطبيع من gfs_to_raster.py (تطابق ألوان تام).

ECMWF open data بدقّة زمنية كل 3 ساعات؛ نطابق كل مؤشّر ساعة (0..24) لأقرب خطوة متاحة،
فتبقى 25 إطاراً متوافقة مع شريط الوقت في الواجهة.

الاستخدام:
  python ecmwf_to_raster.py --vars temperature,wind --hours 0-24 --outdir ../public/rasters/ecmwf
"""
import os, sys, time, json, datetime, argparse, tempfile
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gfs_to_raster as g  # إعادة استخدام write_png_gray/rgb و _open_grib والثوابت

from ecmwf.opendata import Client

CLIENT = Client(source="ecmwf")

# الأنواع السلَّمية المباشرة: (param ECMWF، الإزاحة، المعامل، vmin، vmax) — مطابقة VALUE_RANGES.
SCALAR = {
    'temperature': dict(param='2t',  offset=-273.15, scale=1.0,  vmin=-50, vmax=55),
    'dewpoint':    dict(param='2d',  offset=-273.15, scale=1.0,  vmin=-35, vmax=35),
    'pressure':    dict(param='msl', offset=0.0,     scale=0.01, vmin=955, vmax=1050),
    'clouds':      dict(param='tcc', offset=0.0,     scale=100.0, vmin=0,  vmax=100),  # 0..1 → %
    'wind-gusts':  dict(param='10fg', offset=0.0,    scale=3.6,   vmin=0,  vmax=160),  # m/s → km/h
}
# humidity تُشتقّ من 2t/2d؛ precipitation من tp التراكمي؛ wind من 10u/10v.
ALL_VARS = list(SCALAR) + ['humidity', 'precipitation', 'wind']


def nearest_step(hour):
    """ECMWF open data كل 3 ساعات — أقرب خطوة متاحة لمؤشّر ساعة."""
    return int(round(hour / 3.0) * 3)


def _download(param, step, tag):
    tmp = os.path.join(tempfile.gettempdir(), f"ecmwf_{tag}_{step:03d}.grib2")
    CLIENT.retrieve(type="fc", step=step, param=param, target=tmp)
    return tmp


def _field(path):
    """يقرأ أول متغيّر، يعيد ترتيب الطول (0..360→-180..180) ويقلب ليكون الجنوب أولاً."""
    ds = g._open_grib(path)
    arr = np.asarray(ds[list(ds.data_vars)[0]].values, dtype=np.float64)
    return np.roll(arr, arr.shape[1] // 2, axis=1)[::-1, :]


def _write_scalar(arr, vmin, vmax, out_path, label):
    t = np.clip((arr - vmin) / (vmax - vmin), 0.0, 1.0)
    g.write_png_gray(out_path, (t * 255.0).round().astype(np.uint8))
    print(f"تمّ: {out_path} ({label}, min={float(arr.min()):.1f} max={float(arr.max()):.1f})", flush=True)


def gen_scalar(var, hour, out_path):
    cfg = SCALAR[var]
    step = nearest_step(hour)
    tmp = _download(cfg['param'], step, var)
    arr = _field(tmp) * cfg['scale'] + cfg['offset']
    _write_scalar(arr, cfg['vmin'], cfg['vmax'], out_path, f"ECMWF f{step:03d}")


def gen_humidity(hour, out_path):
    """رطوبة نسبية من 2t و 2d عبر معادلة Magnus (بالمئوية)."""
    step = nearest_step(hour)
    T = _field(_download('2t', step, 'hum_t')) - 273.15
    Td = _field(_download('2d', step, 'hum_td')) - 273.15
    a, b = 17.625, 243.04
    rh = 100.0 * np.exp((a * Td) / (b + Td)) / np.exp((a * T) / (b + T))
    rh = np.clip(rh, 0.0, 100.0)
    _write_scalar(rh, 0, 100, out_path, f"ECMWF f{step:03d} (RH من 2t/2d)")


def gen_precipitation(hour, out_path):
    """معدّل المطر (mm/h) من فرق tp التراكمي (m) بين الخطوة والسابقة (3 ساعات)."""
    step = nearest_step(hour)
    tp_now = _field(_download('tp', step, 'tp_now')) * 1000.0  # m → mm
    if step <= 0:
        rate = np.zeros_like(tp_now)
    else:
        tp_prev = _field(_download('tp', step - 3, 'tp_prev')) * 1000.0
        rate = np.clip(tp_now - tp_prev, 0.0, None) / 3.0      # mm خلال 3س → mm/h
    _write_scalar(rate, 0, 50, out_path, f"ECMWF f{step:03d} (tp diff)")


def gen_wind(hour, out_path):
    step = nearest_step(hour)
    u = _field(_download('10u', step, 'wind_u')) * 3.6  # m/s → km/h
    v = _field(_download('10v', step, 'wind_v')) * 3.6
    speed = np.sqrt(u * u + v * v)
    R = np.clip(speed / g.WIND_SPEED_MAX, 0, 1) * 255
    G = (np.clip(u, -g.WIND_UV_MAX, g.WIND_UV_MAX) / g.WIND_UV_MAX * 0.5 + 0.5) * 255
    B = (np.clip(v, -g.WIND_UV_MAX, g.WIND_UV_MAX) / g.WIND_UV_MAX * 0.5 + 0.5) * 255
    g.write_png_rgb(out_path, R.round(), G.round(), B.round())
    print(f"تمّ: {out_path} (ECMWF f{step:03d}, speed max={float(speed.max()):.0f} km/h)", flush=True)


def generate_one(var, hour, out_path):
    if var == 'wind':         return gen_wind(hour, out_path)
    if var == 'humidity':     return gen_humidity(hour, out_path)
    if var == 'precipitation': return gen_precipitation(hour, out_path)
    return gen_scalar(var, hour, out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vars', help="قائمة مفصولة بفواصل (افتراضي: الكل)")
    ap.add_argument('--hours', default='0-24')
    ap.add_argument('--outdir', required=True)
    args = ap.parse_args()

    vars_list = args.vars.split(',') if args.vars else ALL_VARS
    hours = g.parse_hours(args.hours)
    os.makedirs(args.outdir, exist_ok=True)
    print(f"تحديث {len(vars_list)} متغيّر × {len(hours)} ساعة (ECMWF) → {args.outdir}", flush=True)

    t0 = time.time(); ok = fail = 0
    for var in vars_list:
        for h in hours:
            try:
                generate_one(var, h, os.path.join(args.outdir, f"{var}_{h:03d}.png"))
                ok += 1
            except Exception as e:
                fail += 1
                print(f"  ✗ {var} f{h:03d}: {e!r}", flush=True)
    _write_meta(args.outdir, hours)
    print(f"== اكتمل (ECMWF): {ok} نسيج، {fail} فشل، في {round(time.time()-t0,1)}ث ==", flush=True)
    return 1 if ok == 0 else 0


def _write_meta(outdir, hours):
    """meta.json بزمن دورة ECMWF — تستخدمه الواجهة لمحاذاة الإطار مع الزمن الحقيقي."""
    try:
        dt = CLIENT.latest(type="fc", param="2t")           # datetime آخر دورة متاحة (UTC)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        run_epoch = int(dt.timestamp())
    except Exception:
        run_epoch = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    meta = {'run_epoch': run_epoch, 'hours': max(hours) + 1, 'generated_epoch': int(time.time())}
    with open(os.path.join(outdir, 'meta.json'), 'w') as f:
        json.dump(meta, f)
    print(f"meta.json: run_epoch={run_epoch} hours={meta['hours']}", flush=True)


if __name__ == '__main__':
    sys.exit(main())
