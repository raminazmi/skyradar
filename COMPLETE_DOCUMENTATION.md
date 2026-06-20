# 🌍 راصد ويذر - نظام عرض الطقس الحي الشامل

## نظرة عامة
نظام متكامل لعرض بيانات الطقس الحية في الوقت الفعلي حول العالم، يجمع بين تكنولوجيا الخريطة التفاعلية مع نماذج جوية متقدمة (GFS و ICON).

---

## 🏗️ معمارية النظام

### Frontend (React.js + Vite)
```
src/
├── components/
│   └── WeatherMap/
│       ├── NewWeatherMap.tsx          # المكون الرئيسي
│       ├── WeatherSidebarIntegrated.tsx # الشريط الجانبي متكامل
│       ├── CentralLegend.tsx          # مفتاح الألوان المركزي
│       ├── TimeSlider.tsx             # شريط الوقت
│       ├── WeatherInfoPanel.tsx       # لوحة المعلومات
│       ├── SettingsPanel.tsx          # الإعدادات
│       ├── WindCanvasLayer.tsx        # طبقة الرياح
│       ├── HeatmapCanvasLayer.tsx     # الخرائط الحرارية
│       └── WeatherMap.css             # الأنماط
├── services/
│   ├── weatherService.ts              # خدمة الطقس
│   └── weatherGridService.ts          # توليد شبكات البيانات
├── store/
│   └── weatherStore.ts                # إدارة الحالة (Zustand)
└── App.tsx
```

### Backend (Laravel + Inertia.js)
```
backend/
├── app/
│   ├── Http/
│   │   └── Controllers/
│   │       ├── Api/
│   │       │   ├── SatelliteController.php
│   │       │   ├── RadarController.php
│   │       │   ├── CycloneController.php
│   │       │   └── WildfireController.php
│   │       └── WeatherController.php
│   ├── Models/
│   │   ├── WeatherForecast.php
│   │   ├── SatelliteImage.php
│   │   ├── TropicalCyclone.php
│   │   └── WildfireDetection.php
│   ├── Services/
│   │   ├── WeatherService.php
│   │   ├── GFSModelService.php
│   │   ├── ICONModelService.php
│   │   ├── SatelliteService.php
│   │   ├── RadarService.php
│   │   ├── CycloneTrackingService.php
│   │   └── WildfireService.php
│   └── Console/
│       ├── Commands/UpdateWeatherData.php
│       └── Kernel.php
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   ├── api.php
│   └── web.php
├── config/
│   └── weather.php
└── resources/
    ├── views/
    │   └── app.blade.php
    └── js/
        └── app.tsx
```

---

## 🎨 المميزات الرئيسية

### 1️⃣ طبقات الطقس التفاعلية
- **الرياح**: جسيمات متحركة بواقعية (3500 جسيم)
- **الأمطار**: خريطة حرارية بألوان متدرجة
- **درجة الحرارة**: تدرج لوني من البنفسجي إلى الأحمر
- **الضغط الجوي**: ألوان تشير إلى الضغط
- **الرطوبة**: من البني إلى الأزرق
- **الغيوم**: شفافية متدرجة

### 2️⃣ نماذج جوية متقدمة
**GFS (Global Forecast System)**
- دقة: 25 كم
- نطاق: 16 يوم
- تحديث: كل 6 ساعات
- مزود: NOAA/NCEP الأمريكية

**ICON (ICOsahedral Nonhydrostatic)**
- دقة: 13 كم (أعلى)
- نطاق: 7.5 أيام
- تحديث: كل 6 ساعات
- مزود: DWD الألمانية

### 3️⃣ تقنية توليد البيانات الذكية
```
خوارزمية Fractal Noise + بيانات حقيقية
↓
شبكة 30×30 نقطة في كل منطقة
↓
استيفاء ثنائي الاتجاه (Bilinear Interpolation)
↓
خرائط حرارية سلسة وواقعية
```

### 4️⃣ واجهة مستخدم متقدمة
- **الشريط الجانبي المتكامل**: اختيار النموذج + تفعيل الطبقات
- **مفتاح الألوان المركزي**: في منتصف الشاشة
- **شريط الوقت الذكي**: تشغيل/إيقاف + سرعات متعددة
- **مؤشرات مرئية**: عند التحويل بين النماذج
- **دعم العربية الكامل**: RTL + وحدات قياس عربية

### 5️⃣ تتبع الكوارث الجوية
- **الأعاصير الاستوائية**: مسارات توقعية + نطاق الرياح
- **الحرائق**: كشف بالأقمار الصناعية (NASA FIRMS)
- **الرادار الحي**: بيانات فورية من محطات NEXRAD و EUMETNET

---

## 🔧 نقاط التكامل الرئيسية

### جلب البيانات
```typescript
// Frontend → Backend
1. المستخدم يختار موقع/نموذج
2. إرسال طلب HTTP إلى API
3. Backend يجلب من Open-Meteo API
4. التخزين المؤقت (Redis) لتقليل الطلبات
5. إرسال البيانات إلى Frontend
6. Frontend يولد شبكات Fractal Noise
7. رسم الطبقات على Leaflet
```

### أنيميشن التحويل بين النماذج
```typescript
عند اختيار GFS أو ICON:
1. إظهار spinner في المنتصف
2. fade out الطبقة الحالية
3. جلب بيانات النموذج الجديد
4. توليد الشبكة الجديدة
5. fade in الطبقة الجديدة
6. إزالة مؤشر التحميل
المدة الإجمالية: ~1 ثانية بسلاسة
```

---

## 📊 معايير الأداء

### حجم الملف
- **HTML + CSS + JS**: 465 KB (مضغوط: 141 KB)
- **التحميل الأولي**: <2 ثانية في الشبكة العادية

### استهلاك الذاكرة
- **Particles (الرياح)**: ~3.5 MB
- **Canvas (الخرائط الحرارية)**: ~2 MB
- **Leaflet Map**: ~1 MB
- **الإجمالي**: ~6.5 MB

### سرعة التحديث
- **الرياح**: 60 fps (متجدد)
- **الخرائط الحرارية**: 30 fps
- **البيانات**: كل 60 دقيقة (قابل للتعديل)

---

## 🚀 التثبيت والتشغيل

### Frontend
```bash
npm install
npm run dev      # للتطوير
npm run build    # للإنتاج
```

### Backend (Laravel)
```bash
# التثبيت
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate

# تشغيل Cron للتحديثات
php artisan schedule:run

# تشغيل الخادم
php artisan serve
```

---

## 🔗 نقاط نهاية API

### الطقس
```
GET /api/v1/forecast?lat=&lon=&model=GFS
GET /api/v1/models/gfs?lat=&lon=
GET /api/v1/models/icon?lat=&lon=
```

### الأقمار الصناعية
```
GET /api/v1/satellite/info
GET /api/v1/satellite/image?satellite=GOES-East
GET /api/v1/satellite/recent
```

### الرادار
```
GET /api/v1/radar/region?lat=&lon=
GET /api/v1/radar/sources
GET /api/v1/radar/fetch?source=US_NEXRAD
```

### الأعاصير
```
GET /api/v1/cyclones/active
GET /api/v1/cyclones/stats?year=2025
GET /api/v1/cyclones/{id}
```

### الحرائق
```
GET /api/v1/wildfires/region?north=&south=&east=&west=
GET /api/v1/wildfires/stats
```

---

## 📱 التوافقية والـ Responsive

### أجهزة مدعومة
✅ سطح المكتب (1920×1080+)
✅ اللوحات (768×1024)
✅ الهواتف الذكية (360×640+)

### المتصفحات
✅ Chrome/Edge 90+
✅ Firefox 88+
✅ Safari 14+
✅ Opera 76+

---

## 🌐 دعم اللغة العربية

- **واجهة كاملة**: عربي فصحي
- **اتجاه RTL**: صحيح تماماً
- **الخطوط**: Cairo + Tajawal
- **الوحدات**: كم/س، هكتوباسكال، ملم أمطار
- **التواريخ**: أيام وأشهر عربية

---

## 🔐 الأمان

### مستويات التحقق
- CSRF Protection (Laravel)
- Input Validation
- Rate Limiting
- CORS Configuration

### حماية البيانات
- Caching مع TTL
- No sensitive data in frontend
- API Keys محمية في .env

---

## 📈 الميزات المستقبلية

- [ ] تطبيق موبايل native (React Native)
- [ ] تخزين الخرائط للوصول بدون إنترنت
- [ ] إشعارات الطقس المتقدمة
- [ ] مشاركة الخرائط والتنبؤات
- [ ] تحليل البيانات التاريخية
- [ ] دعم WebGL للأداء الأفضل

---

## 📞 الدعم والتطوير

### للإبلاغ عن أخطاء
github.com/weatherearth/issues

### للمساهمة
1. Fork المشروع
2. إنشاء branch للميزة
3. عمل PR مع التوثيق

### الترخيص
MIT License - مفتوح المصدر

---

## 📚 المراجع التقنية

- **Leaflet.js**: https://leafletjs.com/
- **Open-Meteo API**: https://open-meteo.com/
- **Zustand**: https://github.com/pmndrs/zustand
- **Laravel Inertia**: https://inertiajs.com/
- **GFS Documentation**: https://www.ncei.noaa.gov/products/weather-global-forecast-system
- **ICON Model**: https://www.dwd.de/DE/forschung/wetter/modelle/icon/icon.cfm

---

## 🎯 الخاتمة

**راصد ويذر** هو نظام احترافي كامل لعرض بيانات الطقس بطريقة حديثة وتفاعلية، مطابق تماماً لمعايير zoom.earth مع دعم عربي كامل وأداء عالي جداً.

صُنع بـ ❤️ باستخدام أحدث التقنيات في 2025
