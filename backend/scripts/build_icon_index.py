#!/usr/bin/env python3
"""
build_icon_index.py  (يُشغَّل محلياً مرّة واحدة — لا على الاستضافة المشتركة)
يبني فهرس أقرب-جار لإعادة تشبيك ICON العالمي (icosahedral) إلى شبكة lat/lon منتظمة 0.25°،
عبر تنزيل ملف شبكة DWD (clon/clat لكل خلية) مرّة، ثم يحفظ الفهرس الصغير (~4MB) الذي يُرفع
إلى الخادم في مجلّد rasters/icon/ فيقرأه icon_to_raster.py وقت التشغيل (numpy فقط، بلا scipy
ولا ملف الشبكة على الخادم).

يحتاج محلياً: numpy, scipy, netCDF4. الاستخدام:
  python build_icon_index.py --out icon_build/icon_nn_index_2949120_1440x721.npy
المخرج لا يُرفع إلى git (مُتجاهَل في .gitignore). ارفعه يدوياً إلى الخادم بعد البناء.
"""
import os, sys, bz2, argparse, urllib.request
import numpy as np

# ── شبكة الهدف — تطابق icon_to_raster.py تماماً (NLON×NLAT، -180..179.75، -90..90) ──
NLON, NLAT = 1440, 721
TARGET_LONS = -180.0 + np.arange(NLON) * 0.25
TARGET_LATS = -90.0 + np.arange(NLAT) * 0.25

# ملف شبكة ICON العالمي R03B07 من مكتبة CDO لدى DWD (clon/clat بالراديان، 2,949,120 خلية).
GRID_URL = 'https://opendata.dwd.de/weather/lib/cdo/icon_grid_0026_R03B07_G.nc.bz2'


def _lonlat_to_xyz(lon_deg, lat_deg):
    lon = np.radians(lon_deg); lat = np.radians(lat_deg)
    cl = np.cos(lat)
    return np.stack([cl * np.cos(lon), cl * np.sin(lon), np.sin(lat)], axis=-1)


def _progress(blocks, bsize, total):
    done = blocks * bsize
    pct = (done / total * 100) if total > 0 else 0
    sys.stdout.write(f"\rتنزيل ملف الشبكة: {done/1e6:.0f}/{total/1e6:.0f}MB ({pct:.0f}%)")
    sys.stdout.flush()


def ensure_grid_nc(workdir):
    """ينزّل ملف الشبكة المضغوط ويفكّه إلى .nc (يتخطّى ما هو موجود). يعيد مسار .nc."""
    os.makedirs(workdir, exist_ok=True)
    bz2_path = os.path.join(workdir, 'icon_grid_R03B07_G.nc.bz2')
    nc_path = os.path.join(workdir, 'icon_grid_R03B07_G.nc')
    if os.path.exists(nc_path):
        print(f"ملف الشبكة موجود: {nc_path}", flush=True)
        return nc_path
    if not os.path.exists(bz2_path):
        print(f"تنزيل من {GRID_URL} …", flush=True)
        urllib.request.urlretrieve(GRID_URL, bz2_path, _progress)
        print("\nاكتمل التنزيل.", flush=True)
    print("فكّ الضغط (تدفّقي، بلا تحميل كامل للذاكرة)…", flush=True)
    with bz2.open(bz2_path, 'rb') as src, open(nc_path, 'wb') as dst:
        while True:
            chunk = src.read(8 * 1024 * 1024)
            if not chunk:
                break
            dst.write(chunk)
    print(f"تمّ: {nc_path}", flush=True)
    return nc_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--workdir', default='icon_build', help="مجلّد التنزيل/العمل (مُتجاهَل في git)")
    ap.add_argument('--out', help="مسار حفظ الفهرس .npy (افتراضي داخل workdir بالاسم الصحيح)")
    args = ap.parse_args()

    nc_path = ensure_grid_nc(args.workdir)

    from netCDF4 import Dataset
    print("قراءة clon/clat من ملف الشبكة…", flush=True)
    ds = Dataset(nc_path, 'r')
    clon = np.degrees(np.asarray(ds.variables['clon'][:], dtype=np.float64))  # راديان → درجات
    clat = np.degrees(np.asarray(ds.variables['clat'][:], dtype=np.float64))
    ds.close()
    ncells = clon.size
    print(f"عدد الخلايا: {ncells}", flush=True)

    out = args.out or os.path.join(args.workdir, f"icon_nn_index_{ncells}_{NLON}x{NLAT}.npy")

    print(f"بناء فهرس أقرب-جار على الكرة ({ncells} خلية → {NLON}×{NLAT})…", flush=True)
    from scipy.spatial import cKDTree
    tree = cKDTree(_lonlat_to_xyz(clon, clat))
    lon_grid, lat_grid = np.meshgrid(TARGET_LONS, TARGET_LATS)   # (NLAT, NLON)
    _, idx = tree.query(_lonlat_to_xyz(lon_grid.ravel(), lat_grid.ravel()), k=1)
    idx = idx.astype(np.int32)

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    np.save(out, idx)
    print(f"تمّ حفظ الفهرس: {out} ({os.path.getsize(out)/1e6:.1f}MB)", flush=True)
    print(f"ارفع هذا الملف إلى الخادم في: backend/public/rasters/icon/{os.path.basename(out)}", flush=True)


if __name__ == '__main__':
    main()
