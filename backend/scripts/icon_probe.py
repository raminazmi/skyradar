#!/usr/bin/env python3
"""
icon_probe.py
فحص تشخيصي: هل يمكن قراءة إحداثيات شبكة ICON من ملف البيانات نفسه عبر eccodes منخفض
المستوى (latitudes/longitudes كمفاتيح محسوبة)؟ إن نجح → يمكن تشغيل ICON على الاستضافة
الحالية بلا ملف شبكة 1.6GB. إن فشل → الشبكة unstructured فعلاً ونحتاج ملف الشبكة/الفهرس المحلّي.

الاستخدام:
  python icon_probe.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import icon_to_raster as I

# ثبّت أحدث دورة ICON ونزّل عيّنة t_2m للساعة 0.
day, run, run_epoch = I.resolve_cycle(0)
print(f"دورة ICON: {day}/{run:02d}z", flush=True)
grib = I._download_grib('t_2m', 'T_2M', 0, 'probe')
print(f"نُزّل: {grib} ({os.path.getsize(grib)} بايت)", flush=True)

import eccodes
with open(grib, 'rb') as f:
    gid = eccodes.codes_grib_new_from_file(f)
    try:
        gt = eccodes.codes_get(gid, 'gridType')
        npts = eccodes.codes_get(gid, 'numberOfDataPoints')
        print(f"gridType = {gt}", flush=True)
        print(f"numberOfDataPoints = {npts}", flush=True)
        for key in ('latitudes', 'longitudes'):
            try:
                arr = eccodes.codes_get_array(gid, key)
                print(f"  {key}: نجح ✓ (طول={len(arr)}, أوّل={arr[:3]}, آخر={arr[-3:]})", flush=True)
            except Exception as e:
                print(f"  {key}: فشل ✗ {e!r}", flush=True)
        # محاولة بديلة: iterator (codes_grib_get_data) يعيد (lat, lon, value) لكل نقطة.
        try:
            it = eccodes.codes_grib_iterator_new(gid, 0)
            first = eccodes.codes_grib_iterator_next(it)
            print(f"  iterator: نجح ✓ (أوّل نقطة lat/lon/val = {first})", flush=True)
            eccodes.codes_grib_iterator_delete(it)
        except Exception as e:
            print(f"  iterator: فشل ✗ {e!r}", flush=True)
    finally:
        eccodes.codes_release(gid)
print("== انتهى الفحص ==", flush=True)
