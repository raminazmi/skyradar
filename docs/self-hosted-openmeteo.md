# استضافة Open-Meteo ذاتياً (لإلغاء حدود الحصة + دقة عالية)

الـ API العام المجاني محدود (~10,000 طلب/يوم)، وتكلفة الطلب تتناسب مع عدد نقاط الشبكة.
الاستضافة الذاتية تُلغي هذا الحدّ تماماً، فتسمح برفع الدقة لمطابقة Zoom Earth.

> Zoom Earth نفسه يعالج ملفات GFS GRIB من NOAA محلياً ويُولّد بلاطات — وهذه هي نفس الفكرة.

## المتطلبات
- Docker + Docker Compose.
- مساحة قرص: عدّة جيجابايت لكل دورة نموذج (GFS عالمي). نموذج `ncep_gfs013` (0.13°) أدقّ وأكبر؛
  استخدم `ncep_gfs025` (0.25°) لتوفير المساحة.

## الخطوات

1) شغّل الخادم:
```bash
docker compose -f docker-compose.openmeteo.yml up -d
```

2) أوّل مزامنة قد تستغرق وقتاً (تحميل البيانات). راقبها:
```bash
docker logs -f rasid-openmeteo-sync
```
خدمة `open-meteo-sync` في الـ compose تُعيد المزامنة تلقائياً كل 6 ساعات (دورة GFS).

3) تحقّق أن الـ API يردّ محلياً:
```bash
curl "http://localhost:8080/v1/gfs?latitude=24.7&longitude=46.7&hourly=temperature_2m&forecast_hours=3"
```

4) وجّه الواجهة الخلفية إليه — في `backend/.env`:
```env
OPEN_METEO_BASE_URL=http://localhost:8080
```
ثم:
```bash
php artisan config:clear
```

5) ارفع الدقة الآن بأمان (لا حصة):
- الواجهة: في `getForecastGridResolution` ([NewWeatherMap.tsx](../src/components/WeatherMap/NewWeatherMap.tsx)) ارفع السقوف (مثلاً 40/48).
- الخلفية: في `determineGridSampleResolution` ([WeatherService.php](../backend/app/Services/WeatherService.php)) ارفع `baseResolution` و `cap` (مثلاً 48–60).
- يمكن أيضاً تقصير TTL الكاش لتحديث أسرع، وزيادة prefetch لسلاسة التشغيل.

## ملاحظات
- النماذج/المتغيّرات قد تتغيّر أسماؤها؛ راجع التوثيق الرسمي: https://github.com/open-meteo/open-meteo (قسم Docker/sync).
- الـ API المُستضاف يشتقّ `wind_speed_10m`/`wind_direction_10m` من مركّبتي U/V المُزامَنتين تلقائياً.
- للإنتاج: ضع المثيل خلف نطاق/شبكة داخلية، واضبط `OPEN_METEO_BASE_URL` على عنوانه.
