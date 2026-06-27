#!/usr/bin/env python3
"""
icon_to_raster.py
ينزّل حقول ICON العالمية المجانية من DWD opendata (شبكة icosahedral غير منتظمة) ويعيد
تشبيكها إلى شبكة lat/lon منتظمة 0.25° ثم يحوّلها إلى صور PNG مطابقة تماماً لمخرجات GFS/ECMWF
— لكن في مجلّد منفصل rasters/icon/ كي يختار التطبيق النموذج عبر المجلّد. يعيد استخدام كاتب
PNG والتطبيع وثوابت الرياح من gfs_to_raster.py (تطابق ألوان تام).

لماذا regrid؟ ICON العالمي يُنشر على شبكة مثلّثية (clat/clon لكل خلية)، بينما الواجهة تفترض
نسيجاً عالمياً منتظماً (-180..180, -90..90). نحسب فهرس "أقرب خلية" لكل نقطة في الشبكة الهدف
مرّة واحدة (على الكرة بمتجهات 3D فلا مشكلة عند خطّ التاريخ/القطبين) ونخزّنه كـ .npy، فكل حقل
لاحقاً يصبح مجرّد فهرسة سريعة: vals[idx].reshape(NLAT, NLON).

كل البيانات والأدوات مجانية: DWD open data (بلا مفتاح/تسجيل) + numpy + scipy + eccodes.

الاستخدام:
  python icon_to_raster.py --vars temperature,wind --hours 0-24 --outdir ../public/rasters/icon
"""
import os, sys, time, json, bz2, datetime, argparse, tempfile, urllib.request
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gfs_to_raster as g  # إعادة استخدام write_png_gray/rgb و _open_grib وثوابت الرياح

# ── شبكة الهدف المنتظمة (تطابق دقّة GFS 0.25°) ────────────────────────────────
NLON, NLAT = 1440, 721
TARGET_LONS = -180.0 + np.arange(NLON) * 0.25            # -180 .. 179.75
TARGET_LATS = -90.0 + np.arange(NLAT) * 0.25             # -90 (الصفّ 0 = الجنوب) .. 90

# ── DWD opendata: ICON العالمي، حقول السطح (single-level) ─────────────────────
DWD_BASE = 'https://opendata.dwd.de/weather/nwp/icon/grib'

# (مجلّد DWD، اسم البارامتر في الملف، الإزاحة، المعامل، vmin، vmax) — vmin/vmax تطابق GFS تماماً.
SCALAR = {
    'temperature': dict(dwd='t_2m',      file='T_2M',      offset=-273.15, scale=1.0,   vmin=-50, vmax=55),
    'dewpoint':    dict(dwd='td_2m',     file='TD_2M',     offset=-273.15, scale=1.0,   vmin=-35, vmax=35),
    'humidity':    dict(dwd='relhum_2m', file='RELHUM_2M', offset=0.0,     scale=1.0,   vmin=0,   vmax=100),
    'pressure':    dict(dwd='pmsl',      file='PMSL',      offset=0.0,     scale=0.01,  vmin=955, vmax=1050),  # Pa→hPa
    'clouds':      dict(dwd='clct',      file='CLCT',      offset=0.0,     scale=1.0,   vmin=0,   vmax=100),
    'wind-gusts':  dict(dwd='vmax_10m',  file='VMAX_10M',  offset=0.0,     scale=3.6,   vmin=0,   vmax=160),  # m/s→km/h
}
# precipitation من tot_prec التراكمي (mm)؛ wind من u_10m/v_10m.
ALL_VARS = list(SCALAR) + ['precipitation', 'wind']

_CYCLE = None  # (day:str 'YYYYMMDD', run:int)


def _file_url(dwd_dir, file_param, day, run, step):
    name = f"icon_global_icosahedral_single-level_{day}{run:02d}_{step:03d}_{file_param}.grib2.bz2"
    return f"{DWD_BASE}/{run:02d}/{dwd_dir}/{name}"


def _head_ok(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=30) as r:
            return r.status == 200
    except Exception:
        return False


def resolve_cycle(max_hour, probe=('t_2m', 'T_2M')):
    """يثبّت أحدث دورة ICON (00/06/12/18) متاحة حتى max_hour. يُرجع (day, run, run_epoch).
    ICON العالمي يتأخّر نشره ~3-5 ساعات، فنفحص حتى 24 ساعة للخلف."""
    global _CYCLE
    now = datetime.datetime.utcnow()
    for back in range(0, 30, 6):
        t = now - datetime.timedelta(hours=back)
        run = (t.hour // 6) * 6
        day = t.strftime('%Y%m%d')
        if _head_ok(_file_url(probe[0], probe[1], day, run, max_hour)):
            _CYCLE = (day, run)
            dt = datetime.datetime.strptime(day, '%Y%m%d').replace(hour=run, tzinfo=datetime.timezone.utc)
            return day, run, int(dt.timestamp())
    raise RuntimeError("تعذّر إيجاد دورة ICON متاحة بالكامل حتى الساعة المطلوبة")


def _download_grib(dwd_dir, file_param, step, tag):
    """ينزّل ملف ICON المضغوط (.bz2) ويفكّ ضغطه إلى .grib2 مؤقّت، ويعيد مساره."""
    if _CYCLE is None:
        raise RuntimeError("الدورة غير مثبّتة — استدعِ resolve_cycle أولاً")
    day, run = _CYCLE
    url = _file_url(dwd_dir, file_param, day, run, step)
    bz2_path = os.path.join(tempfile.gettempdir(), f"icon_{tag}_{step:03d}.grib2.bz2")
    grib_path = bz2_path[:-4]
    urllib.request.urlretrieve(url, bz2_path)
    with bz2.open(bz2_path, 'rb') as src, open(grib_path, 'wb') as dst:
        dst.write(src.read())
    try:
        os.remove(bz2_path)
    except OSError:
        pass
    return grib_path


# ── فهرس إعادة التشبيك (أقرب خلية على الكرة) — يُحسب مرّة ويُخزَّن ─────────────
def _lonlat_to_xyz(lon_deg, lat_deg):
    lon = np.radians(lon_deg); lat = np.radians(lat_deg)
    cl = np.cos(lat)
    return np.stack([cl * np.cos(lon), cl * np.sin(lon), np.sin(lat)], axis=-1)


def build_or_load_index(sample_grib, cache_dir):
    """يحمّل فهرس أقرب-جار المخزَّن (icon_nn_index_<ncells>_<W>x<H>.npy). ملفات ICON العالمية
    icosahedral *لا تحمل إحداثياتها* (مؤكَّد: gridType=unstructured_grid، لا latitudes في
    eccodes)، فلا يمكن بناء الفهرس من ملف البيانات هنا. يُبنى مرّة على جهاز فيه ملف شبكة DWD
    عبر build_icon_index.py ويُرفع الـ .npy (~4MB) إلى مجلّد المخرجات. ncells = طول مصفوفة القيم."""
    ds = g._open_grib(sample_grib)
    ncells = np.asarray(ds[list(ds.data_vars)[0]].values).size

    cache = os.path.join(cache_dir, f"icon_nn_index_{ncells}_{NLON}x{NLAT}.npy")
    if os.path.exists(cache):
        return np.load(cache)
    raise RuntimeError(
        f"فهرس إعادة التشبيك غير موجود: {cache}\n"
        f"ابنِه مرّة عبر backend/scripts/build_icon_index.py (يحتاج ملف شبكة DWD + scipy + netCDF4)\n"
        f"ثم ارفع الـ .npy إلى مجلّد المخرجات. (الإحداثيات غير متاحة في ملف ICON نفسه.)")


_INDEX = None  # يُملأ عند أول حقل


def _regrid(grib_path):
    """يقرأ أول متغيّر من ملف ICON (1D خلايا) ويعيد تشبيكه إلى (NLAT, NLON)، الصفّ 0 = الجنوب."""
    ds = g._open_grib(grib_path)
    vals = np.asarray(ds[list(ds.data_vars)[0]].values, dtype=np.float64).ravel()
    return vals[_INDEX].reshape(NLAT, NLON)


def _write_scalar(arr, vmin, vmax, out_path, label):
    t = np.clip((arr - vmin) / (vmax - vmin), 0.0, 1.0)
    g.write_png_gray(out_path, (t * 255.0).round().astype(np.uint8))
    print(f"تمّ: {out_path} ({label}, min={float(arr.min()):.1f} max={float(arr.max()):.1f})", flush=True)


def gen_scalar(var, hour, out_path):
    cfg = SCALAR[var]
    grib = _download_grib(cfg['dwd'], cfg['file'], hour, var)
    arr = _regrid(grib) * cfg['scale'] + cfg['offset']
    _write_scalar(arr, cfg['vmin'], cfg['vmax'], out_path, f"ICON f{hour:03d}")


def gen_precipitation(hour, out_path):
    """معدّل المطر (mm/h) من فرق tot_prec التراكمي (mm) بين الساعة والسابقة."""
    tp_now = _regrid(_download_grib('tot_prec', 'TOT_PREC', hour, 'tp_now'))  # mm تراكمي
    if hour <= 0:
        rate = np.zeros_like(tp_now)
    else:
        tp_prev = _regrid(_download_grib('tot_prec', 'TOT_PREC', hour - 1, 'tp_prev'))
        rate = np.clip(tp_now - tp_prev, 0.0, None)            # mm خلال ساعة = mm/h
    _write_scalar(rate, 0, 50, out_path, f"ICON f{hour:03d} (tot_prec diff)")


def gen_wind(hour, out_path):
    u = _regrid(_download_grib('u_10m', 'U_10M', hour, 'wind_u')) * 3.6   # m/s → km/h
    v = _regrid(_download_grib('v_10m', 'V_10M', hour, 'wind_v')) * 3.6
    speed = np.sqrt(u * u + v * v)
    R = np.clip(speed / g.WIND_SPEED_MAX, 0, 1) * 255
    G = (np.clip(u, -g.WIND_UV_MAX, g.WIND_UV_MAX) / g.WIND_UV_MAX * 0.5 + 0.5) * 255
    B = (np.clip(v, -g.WIND_UV_MAX, g.WIND_UV_MAX) / g.WIND_UV_MAX * 0.5 + 0.5) * 255
    g.write_png_rgb(out_path, R.round(), G.round(), B.round())
    print(f"تمّ: {out_path} (ICON f{hour:03d}, speed max={float(speed.max()):.0f} km/h)", flush=True)


def generate_one(var, hour, out_path):
    if var == 'wind':          return gen_wind(hour, out_path)
    if var == 'precipitation': return gen_precipitation(hour, out_path)
    return gen_scalar(var, hour, out_path)


def _write_meta(outdir, hours, run_epoch):
    hours_total = g.frame_count(outdir) or (max(hours) + 1)
    meta = {'run_epoch': run_epoch, 'hours': hours_total, 'generated_epoch': int(time.time()),
            'layers': g.list_available_layers(outdir)}
    with open(os.path.join(outdir, 'meta.json'), 'w') as f:
        json.dump(meta, f)
    print(f"meta.json: run_epoch={run_epoch} hours={meta['hours']} layers={meta['layers']}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vars', help="قائمة مفصولة بفواصل (افتراضي: الكل)")
    ap.add_argument('--hours', default='0-24')
    ap.add_argument('--outdir', required=True)
    args = ap.parse_args()

    global _INDEX
    vars_list = args.vars.split(',') if args.vars else ALL_VARS
    hours = g.parse_hours(args.hours)
    os.makedirs(args.outdir, exist_ok=True)

    # ثبّت دورة ICON واحدة لكامل التشغيل → اتساق زمني ومحاذاة "الآن" صحيحة.
    day, run, run_epoch = resolve_cycle(max(hours))
    print(f"دورة ICON المثبّتة: {day}/{run:02d}z (run_epoch={run_epoch})", flush=True)
    print(f"تحديث {len(vars_list)} متغيّر × {len(hours)} ساعة (ICON) → {args.outdir}", flush=True)

    # ابنِ فهرس إعادة التشبيك مرّة من أول ملف (الحرارة، الساعة الأولى المطلوبة).
    sample = _download_grib('t_2m', 'T_2M', hours[0], 'index_sample')
    _INDEX = build_or_load_index(sample, args.outdir)

    t0 = time.time(); ok = fail = 0
    for var in vars_list:
        for h in hours:
            try:
                generate_one(var, h, os.path.join(args.outdir, f"{var}_{h:03d}.png"))
                ok += 1
            except Exception as e:
                fail += 1
                print(f"  ✗ {var} f{h:03d}: {e!r}", flush=True)
    _write_meta(args.outdir, hours, run_epoch)
    print(f"== اكتمل (ICON): {ok} نسيج، {fail} فشل، في {round(time.time()-t0,1)}ث ==", flush=True)
    return 1 if ok == 0 else 0


if __name__ == '__main__':
    sys.exit(main())
