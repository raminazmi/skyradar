#!/usr/bin/env python3
"""
gfs_to_raster.py
ينزّل حقل GFS العالمي الخام (GRIB2 بدقّة 0.25° من NOAA NOMADS) ويحوّله إلى صورة PNG
رمادية عالمية (قيمة مُطبّعة 0..255) — يعرضها الواجهة كنسيج طقس بدقّة كاملة مثل Zoom Earth،
بلا أي طلبات نقاط لـ Open-Meteo (بيانات مجانية بدقّة أصلية).

التطبيع يطابق VALUE_RANGES في الواجهة (weatherTextures.ts) فيمرّ مباشرةً عبر شريط الألوان نفسه.

الاستخدام:
  python gfs_to_raster.py --var temperature --hour 0 --out ../public/rasters/temperature_000.png
"""
import os, sys, struct, zlib, argparse, datetime, tempfile, urllib.request

# ── جسر تحميل مكتبة eccodes المضمّنة في ecmwflibs ─────────────────────────────────
# على ويندوز نحتاج add_dll_directory + توجيه findlibs إلى eccodes.dll.
# على Linux (السيرفر) تُحمَّل eccodes.so تلقائياً عبر ecmwflibs؛ add_dll_directory غير موجود.
import ecmwflibs
_ED = os.path.dirname(ecmwflibs.__file__)
if os.name == 'nt':
    os.add_dll_directory(_ED)
    os.environ["PATH"] = _ED + os.pathsep + os.environ.get("PATH", "")
    try:
        import findlibs
        _orig_find = findlibs.find
        findlibs.find = lambda name, *a, **k: (os.path.join(_ED, "eccodes.dll") if name == "eccodes" else _orig_find(name, *a, **k))
    except Exception:
        pass

import numpy as np
# cfgrib الحديث (>=0.9.11) أزال open_dataset؛ نستخدم xarray مع محرّك cfgrib (يبقى ds[name].values).
import xarray as xr

def _open_grib(path):
    # بعض حقول GFS (مثل PRATE) تحوي عدّة stepType (instant/avg) لنفس المتغيّر،
    # فيرفض cfgrib فتحها بلا تحديد. نحاول عادياً ثم نرجع للنسخة اللحظية (instant).
    try:
        return xr.open_dataset(path, engine='cfgrib', backend_kwargs={'indexpath': ''})
    except Exception:
        return xr.open_dataset(path, engine='cfgrib',
                               backend_kwargs={'indexpath': '', 'filter_by_keys': {'stepType': 'instant'}})

# مجال القيم لكل متغيّر — مطابق تماماً لـ VALUE_RANGES في الواجهة، والإزاحة لتحويل الوحدة.
VAR_CONFIG = {
    'temperature': dict(noaa_var='TMP',   lev='2_m_above_ground', offset=-273.15, vmin=-50, vmax=55),
    'feels-like':  dict(noaa_var='APTMP', lev='2_m_above_ground', offset=-273.15, vmin=-50, vmax=55),
    'dewpoint':    dict(noaa_var='DPT',   lev='2_m_above_ground', offset=-273.15, vmin=-35, vmax=35),
    'humidity':    dict(noaa_var='RH',    lev='2_m_above_ground', offset=0.0,     vmin=0,   vmax=100),
    'pressure':    dict(noaa_var='PRMSL', lev='mean_sea_level',   offset=0.0,     vmin=955, vmax=1050, scale=0.01),
    'clouds':      dict(noaa_var='TCDC',  lev='entire_atmosphere', offset=0.0,    vmin=0,   vmax=100),
    'wind-gusts':  dict(noaa_var='GUST',  lev='surface',          offset=0.0,     vmin=0,   vmax=160, scale=3.6),   # m/s→km/h
    'precipitation': dict(noaa_var='PRATE', lev='surface',        offset=0.0,     vmin=0,   vmax=50,  scale=3600.0), # mm/s→mm/h
}

NOMADS = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl'


def latest_run_url(cfg, hour):
    """يجرّب أحدث دورات GFS (00/06/12/18) رجوعاً حتى يجد ملفاً متاحاً (200)."""
    now = datetime.datetime.utcnow()
    for back in range(0, 30, 6):  # حتى ~30 ساعة للخلف
        t = now - datetime.timedelta(hours=back)
        run = (t.hour // 6) * 6
        day = t.strftime('%Y%m%d')
        q = (f"?file=gfs.t{run:02d}z.pgrb2.0p25.f{hour:03d}"
             f"&var_{cfg['noaa_var']}=on&lev_{cfg['lev']}=on"
             f"&leftlon=0&rightlon=360&toplat=90&bottomlat=-90"
             f"&dir=%2Fgfs.{day}%2F{run:02d}%2Fatmos")
        url = NOMADS + q
        try:
            req = urllib.request.Request(url, method='HEAD')
            with urllib.request.urlopen(req, timeout=30) as r:
                if r.status == 200:
                    return url, f"{day}/{run:02d} f{hour:03d}"
        except Exception:
            continue
    raise RuntimeError("تعذّر إيجاد دورة GFS متاحة")


def write_png_gray(path, img):
    """كاتب PNG رمادي 8-بت بسيط (بلا اعتماديات): الصفّ 0 = أعلى الصورة."""
    h, w = img.shape

    def chunk(typ, data):
        body = typ + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xffffffff)

    raw = bytearray()
    for y in range(h):
        raw.append(0)            # filter type: none
        raw.extend(img[y].tobytes())
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0))  # grayscale 8-bit
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)


def write_png_rgb(path, r, g, b):
    """كاتب PNG ملوّن 8-بت (RGB) بلا اعتماديات — لقنوات الرياح (سرعة/U/V)."""
    h, w = r.shape

    def chunk(typ, data):
        body = typ + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xffffffff)

    raw = bytearray()
    rgb = np.dstack([r, g, b]).astype(np.uint8)
    for y in range(h):
        raw.append(0)
        raw.extend(rgb[y].tobytes())
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))  # color type 2 = RGB
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)


# مدى تطبيع مركّبتي U/V (km/h) — يطابق WIND_UV_MAX في weatherTextures.ts.
WIND_UV_MAX = 60.0
WIND_SPEED_MAX = 120.0  # يطابق VALUE_RANGES['wind']


def wind_url(hour):
    now = datetime.datetime.utcnow()
    for back in range(0, 30, 6):
        t = now - datetime.timedelta(hours=back)
        run = (t.hour // 6) * 6
        day = t.strftime('%Y%m%d')
        q = (f"?file=gfs.t{run:02d}z.pgrb2.0p25.f{hour:03d}"
             f"&var_UGRD=on&var_VGRD=on&lev_10_m_above_ground=on"
             f"&leftlon=0&rightlon=360&toplat=90&bottomlat=-90"
             f"&dir=%2Fgfs.{day}%2F{run:02d}%2Fatmos")
        url = NOMADS + q
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=30) as rr:
                if rr.status == 200:
                    return url, f"{day}/{run:02d} f{hour:03d}"
        except Exception:
            continue
    raise RuntimeError("تعذّر إيجاد دورة GFS متاحة للرياح")


def generate_wind(hour, out_path):
    url, label = wind_url(hour)
    tmp = os.path.join(tempfile.gettempdir(), f"gfs_wind_{hour:03d}.grb2")
    urllib.request.urlretrieve(url, tmp)
    ds = _open_grib(tmp)
    u = np.asarray(ds['u10'].values, dtype=np.float64) * 3.6   # m/s → km/h
    v = np.asarray(ds['v10'].values, dtype=np.float64) * 3.6

    for a in (u, v):
        pass
    u = np.roll(u, u.shape[1] // 2, axis=1)[::-1, :]
    v = np.roll(v, v.shape[1] // 2, axis=1)[::-1, :]
    speed = np.sqrt(u * u + v * v)

    R = np.clip(speed / WIND_SPEED_MAX, 0, 1) * 255
    G = (np.clip(u, -WIND_UV_MAX, WIND_UV_MAX) / WIND_UV_MAX * 0.5 + 0.5) * 255
    B = (np.clip(v, -WIND_UV_MAX, WIND_UV_MAX) / WIND_UV_MAX * 0.5 + 0.5) * 255
    write_png_rgb(out_path, R.round(), G.round(), B.round())
    print(f"تمّ: {out_path} ({label}, speed max={float(speed.max()):.0f} km/h)", flush=True)


def generate_one(cfg, var, hour, out_path):
    if var == 'wind':
        return generate_wind(hour, out_path)
    url, label = latest_run_url(cfg, hour)
    tmp = os.path.join(tempfile.gettempdir(), f"gfs_{var}_{hour:03d}.grb2")
    urllib.request.urlretrieve(url, tmp)

    ds = _open_grib(tmp)
    vname = list(ds.data_vars)[0]
    arr = np.asarray(ds[vname].values, dtype=np.float64)        # (lat 90..-90, lon 0..360)

    arr = arr * cfg.get('scale', 1.0) + cfg['offset']           # تحويل الوحدة (K→C، Pa→hPa…)
    arr = np.roll(arr, arr.shape[1] // 2, axis=1)               # lon 0..360 → -180..180
    arr = arr[::-1, :]                                          # اقلب عمودياً: الصفّ 0 = الجنوب

    t = np.clip((arr - cfg['vmin']) / (cfg['vmax'] - cfg['vmin']), 0.0, 1.0)
    img = (t * 255.0).round().astype(np.uint8)
    write_png_gray(out_path, img)
    print(f"تمّ: {out_path} ({label}, min={float(arr.min()):.1f} max={float(arr.max()):.1f})", flush=True)


def parse_hours(spec):
    """يقبل '0' أو '0-24' أو '0,3,6'."""
    if '-' in spec:
        a, b = spec.split('-'); return list(range(int(a), int(b) + 1))
    return [int(x) for x in spec.split(',')]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--var', required=True, choices=list(VAR_CONFIG) + ['wind'])
    ap.add_argument('--hour', type=int, default=0)
    ap.add_argument('--hours', help="نطاق ساعات دفعةً واحدة، مثل 0-24 أو 0,3,6 (مع --outdir)")
    ap.add_argument('--out', help="مسار ملف واحد (مع --hour)")
    ap.add_argument('--outdir', help="مجلّد المخرجات للدفعة (مع --hours)؛ الاسم <var>_<hhh>.png")
    args = ap.parse_args()
    cfg = VAR_CONFIG.get(args.var)  # 'wind' لا يستخدم cfg (قنوات U/V خاصة)

    if args.hours:
        outdir = args.outdir or '.'
        for h in parse_hours(args.hours):
            try:
                generate_one(cfg, args.var, h, os.path.join(outdir, f"{args.var}_{h:03d}.png"))
            except Exception as e:
                print(f"تخطّي ساعة {h}: {e!r}", flush=True)
    else:
        generate_one(cfg, args.var, args.hour, args.out or f"{args.var}_{args.hour:03d}.png")


if __name__ == '__main__':
    main()
