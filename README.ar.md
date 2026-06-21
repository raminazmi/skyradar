# 🌍 Sky Radar

نظام عرض الطقس الحي والفوري حول العالم، مبني بمحرك WebGL مخصّص ومطابق بصرياً لـ [zoom.earth](https://zoom.earth)، مع دعم عربي كامل (واجهة RTL وتسميات مدن عربية).

## ✨ المميزات الرئيسية

### 🗺️ خريطة تفاعلية متقدّمة (MapLibre GL JS + WebGL)
- طبقات طقس متعددة (رياح، أمطار، حرارة، غيوم) كطبقات WebGL مخصّصة فوق الخريطة
- جسيمات رياح متحركة (GPU particles) تتبع بيانات الرياح الحقيقية لحظة بلحظة
- خرائط حرارية بتدرّجات ألوان مطابقة لمراجع بصرية حقيقية
- تظليل تضاريسي (hillshade) من بيانات ارتفاعات حقيقية، بثيم منفصل للوضع الفاتح/الداكن
- شريط زمني مع تشغيل تلقائي وسرعات متعددة

### 🌤️ نماذج جوية
- **GFS**: دقة 25كم، 16 يوم، NOAA
- **ICON**: دقة 13كم، 7.5 أيام، DWD
- اختيار سريع بين النماذج مع انتقال سلس

### 🛰️ مصادر بيانات متعددة
- بيانات طقس حية عبر Open-Meteo (GFS/ICON)
- تتبع الأعاصير
- كشف الحرائق (NASA FIRMS)

### 🔍 بحث وأيقونات
- بحث مدن بالعربية مع تخزين مؤقت من جهة العميل وإلغاء الطلبات القديمة تلقائياً
- أيقونات طقس واقعية تتغيّر حسب الوقت (نهار/ليل) وحالة الطقس

### 🌐 واجهة عربية كاملة
- واجهة 100% عربي فصحي بتخطيط RTL صحيح
- وحدات قياس عربية (كم/س، ملم، إلخ)

## 🏗️ البنية التقنية

```
Frontend: React 19 + TypeScript + Vite + Tailwind CSS + Zustand
          MapLibre GL JS (react-map-gl) + طبقات WebGL مخصّصة
Backend:  Laravel (PHP) — يُجمّع ويُخزّن مؤقتاً بيانات Open-Meteo
          (Http::pool للطلبات المجمّعة، تخزين مؤقت ثنائي المستوى: fresh + stale-fallback)
Database: MySQL
Cache:    Redis (اختياري — يعمل أيضاً بدونه عبر كاش الملفات)
```

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

الواجهة الأمامية تتوقّع أن يكون الـ API متاحاً على `/api/v1` (عبر بروكسي Vite في التطوير).

## 📚 الاستخدام

1. **فتح الموقع** → تظهر الخريطة الحية مباشرة
2. **اختيار الطبقة** من الشريط الجانبي (رياح، أمطار، إلخ)
3. **تبديل النموذج** بين GFS و ICON
4. **تشغيل الوقت** لرؤية التطوّر الزمني للطقس
5. **النقر على الخريطة** أو البحث عن مدينة لاختيار موقع محدّد

## 📄 الملفات المهمة

```
src/
├── components/WeatherMap/
│   ├── NewWeatherMap.tsx       # المكون الرئيسي للخريطة
│   ├── HeatmapWebGLLayer.tsx   # طبقة الخرائط الحرارية (WebGL)
│   ├── ParticleWebGLLayer.tsx  # طبقة جسيمات الرياح (WebGL)
│   ├── CentralLegend.tsx       # مفتاح الألوان
│   ├── webgl/layerOrder.ts     # تنسيق طبقات الخريطة (حدود/تضاريس/سواحل)
│   └── hooks/                  # خطافات الجلب والتنسيق
├── services/
│   ├── weatherGridService.ts   # جلب شبكات الطقس مع كاش وتجميع طلبات
│   └── geocodingService.ts     # بحث المدن مع كاش وإلغاء طلبات قديمة
└── store/
    └── weatherStore.ts

backend/
└── app/
    ├── Http/Controllers/WeatherController.php
    └── Services/
        ├── WeatherService.php      # جلب شبكات الطقس (تجميع/كاش)
        └── LocationService.php     # بحث المواقع (كاش 6 ساعات)
```

## 🐛 حل المشاكل

### الخريطة بطيئة؟
- قلل `resolution` في طلبات الشبكة (`weatherGridService`)
- تأكد من تفعيل Redis لتسريع الكاش في الباك-إند، أو استخدم كاش الملفات الافتراضي

### البيانات لا تتحدث؟
```bash
# تأكد من Redis (اختياري)
redis-server
```

## 📜 الترخيص

مفتوح المصدر — راجع ملف [LICENSE](LICENSE).

## 🙏 شكر خاص

- **NOAA/NCEP** - نموذج GFS
- **DWD** - نموذج ICON
- **Open-Meteo** - API الطقس المجاني
- **MapLibre GL JS** - محرك الخرائط
- **NASA FIRMS** - بيانات الحرائق

---

<div align="center">

### Sky Radar — عرض الطقس بطريقة جديدة كلياً 🌍🌤️⛅

</div>