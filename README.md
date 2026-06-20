# 🌍 راصد ويذر - Weather Earth

نظام عرض الطقس الحي والفوري حول العالم بنماذج جوية متقدمة (GFS و ICON)، مطابق لـ zoom.earth مع دعم عربي كامل.

## ✨ المميزات الرئيسية

### 🗺️ خريطة تفاعلية متقدمة
- طبقات طقس متعددة (رياح، أمطار، حرارة، ضغط، رطوبة، غيوم)
- جسيمات رياح متحركة بواقعية (3500 جسيم)
- خرائط حرارية بألوان متدرجة
- شريط زمني مع تشغيل/إيقاف وسرعات متعددة

### 🌤️ نماذج جوية
- **GFS**: دقة 25كم، 16 يوم، NOAA
- **ICON**: دقة 13كم، 7.5 أيام، DWD (أكثر دقة!)
- اختيار سريع بين النماذج مع انتقال سلس

### 🛰️ مصادر بيانات متعددة
- أقمار صناعية حية (GOES, Himawari, Meteosat)
- رادار حي (NEXRAD, EUMETNET)
- تتبع الأعاصير
- كشف الحرائق (NASA FIRMS)

### 🌐 واجهة عربية كاملة
- واجهة 100% عربي فصحي
- تخطيط RTL صحيح
- وحدات قياس عربية (كم/س، هكتوباسكال، ملم)
- تواريخ وأوقات عربية

### ⚡ أداء عالي جداً
- بناء واحد HTML (465 KB مضغوط)
- تحميل <2 ثانية
- 60 fps للرياح، 30 fps للخرائق الحرارية

## 🚀 البدء السريع

### Frontend (React)
```bash
npm install
npm run dev      # تطوير
npm run build    # إنتاج
```

### Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

## 📚 الاستخدام

1. **فتح الموقع** → يظهر الخريطة الحية
2. **اختيار الطبقة** من الشريط الجانبي (رياح، أمطار، إلخ)
3. **تبديل النموذج** بين GFS و ICON
4. **تشغيل الوقت** لرؤية التطور الزمني
5. **النقر على الخريطة** لاختيار موقع محدد

## 🏗️ البنية التقنية

```
Frontend: React.js + Vite + Leaflet.js + Zustand
Backend: Laravel + Inertia.js + MySQL
API: RESTful
Cache: Redis
Database: MySQL
```

## 📊 المتطلبات

- **Node.js**: 16+
- **PHP**: 8.1+
- **MySQL**: 8.0+
- **Redis**: (اختياري، للتخزين المؤقت)

## 🎨 الإعدادات

```typescript
// تخصيص دقة البيانات
weatherGridService.generateGrid(type, bounds, model, timeIndex, resolution: 30)

// تخصيص عدد الجسيمات
<WindCanvasLayer particleCount={3500} />

// تخصيص شفافية الخرائط الحرارية
<HeatmapCanvasLayer opacity={0.65} />
```

## 📱 التوافقية

| الجهاز | الدعم |
|------|------|
| سطح المكتب | ✅ كامل |
| اللوحات | ✅ كامل |
| الهواتف | ✅ كامل |

| المتصفح | الإصدار الأدنى |
|--------|------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

## 🔗 نقاط نهاية API

### الطقس
```
GET /api/v1/forecast?lat=&lon=&model=GFS
GET /api/v1/models/gfs
GET /api/v1/models/icon
```

### البيانات الإضافية
```
GET /api/v1/satellite/info
GET /api/v1/radar/region
GET /api/v1/cyclones/active
GET /api/v1/wildfires/region
```

## 📄 الملفات المهمة

```
src/
├── components/WeatherMap/
│   ├── NewWeatherMap.tsx              # المكون الرئيسي
│   ├── WeatherSidebarIntegrated.tsx   # الشريط الجانبي
│   ├── CentralLegend.tsx              # مفتاح الألوان
│   ├── WindCanvasLayer.tsx            # الرياح
│   └── HeatmapCanvasLayer.tsx         # الخرائط الحرارية
├── services/
│   ├── weatherService.ts
│   └── weatherGridService.ts
└── store/
    └── weatherStore.ts
```

## 🐛 حل المشاكل

### الرياح سريعة جداً؟
في `WindCanvasLayer.tsx`:
```typescript
const zoomFactor = Math.pow(2, 4 - zoom) * 0.08; // قلل 0.08
```

### البيانات لا تتحدث؟
```bash
# تأكد من Redis
redis-server

# أعد تشغيل الـ cron
php artisan schedule:run
```

### الخريطة بطيئة؟
- قلل `particleCount` في `WindCanvasLayer`
- قلل `resolution` في `generateGrid`
- استخدم تقنيات WebGL

## 📞 الدعم

- 📧 البريد: support@weatherearth.com
- 🐛 الأخطاء: GitHub Issues
- 💬 النقاشات: GitHub Discussions

## 📜 الترخيص

MIT License - مفتوح المصدر للجميع

## 🙏 شكر خاص

- **NOAA/NCEP** - نموذج GFS
- **DWD** - نموذج ICON  
- **Open-Meteo** - API الطقس المجاني
- **Leaflet.js** - مكتبة الخرائط
- **NASA FIRMS** - بيانات الحرائق

---

<div align="center">

### صُنع بـ ❤️ باستخدام أحدث التقنيات

**راصد ويذر** - عرض الطقس بطريقة جديدة كلياً 🌍🌤️⛅

</div>
