# فهم معمّق للمشروع + دراسة Zoom Earth و Windy (الطبقات والجسيمات)

> وثيقة مرجعية شاملة كتبها كلود بعد قراءة كامل الكود (Frontend + Backend).
> الهدف: (1) تلخيص المشروع فهماً عميقاً، (2) شرح آلية عمل zoom.earth و windy.com بدقة — خصوصاً الطبقات (Layers) والجسيمات (Particles) — مع خطة لتطبيقها بشكل صحيح وسلس وبدون أخطاء.
> تاريخ التحديث: 2026-06-16

---

## الجزء الأول: ما هو المشروع؟ (تلخيص معمّق)

### الفكرة بإيجاز

المشروع هو **نسخة (Clone) من Zoom Earth / Windy** — خريطة طقس تفاعلية متعددة الطبقات، تعرض بيانات الطقس العالمية (رياح، حرارة، أمطار، ضغط، رطوبة، غيوم...) فوق خريطة داكنة، مع **جسيمات متحركة** تحاكي حركة الرياح بأسلوب Zoom Earth، وشريط زمني للتنقل بين ساعات التوقعات.

الواجهة بالعربية بالكامل (RTL)، وتركّز جغرافياً على المنطقة العربية (المركز الافتراضي: الرياض `24.7°, 46.7°`).

### المبدأ الأساسي الذي يقوم عليه المشروع

المشروع **لا يستخدم endpoints خاصة بـ zoom.earth** (لأنها غير موثّقة وقد تُحظر). بدلاً من ذلك يعيد بناء نفس المنطق فوق **مصادر بيانات مجانية ومفتوحة**:

| الطبقة | المصدر المجاني |
|--------|----------------|
| التوقعات العددية (رياح/حرارة/مطر/ضغط...) | **Open-Meteo** (يغلّف نماذج NOAA **GFS** و DWD **ICON**) |
| رادار المطر المرصود | **RainViewer** |
| صور الأقمار الصناعية | **NASA GIBS** (WMTS) |
| الحرائق | **NASA FIRMS** |
| خريطة الأساس | **CartoDB Dark Matter** (مبنية على OpenStreetMap) |

### التقنيات (Tech Stack)

**الواجهة الأمامية (`src/`):**
- **React 19** + **TypeScript** + **Vite 7**
- **MapLibre GL** عبر `react-map-gl/maplibre` (محرك خرائط مجاني مفتوح المصدر، WebGL) — *ملاحظة: الوثائق القديمة تذكر Leaflet لكن الكود الفعلي انتقل إلى MapLibre*
- **Zustand** لإدارة الحالة (`src/store/weatherStore.ts`)
- **Tailwind CSS 4** للتصميم
- **Canvas 2D** لرسم الطبقات الحرارية والجسيمات (وليس WebGL)
- **axios** لطلبات الـ API

**الخلفية (`backend/`):**
- **Laravel** (PHP) + **Inertia.js**
- يعمل كـ **Proxy + طبقة Cache** أمام Open-Meteo و RainViewer وغيرها
- خدمات: `WeatherService`, `GFSModelService`, `ICONModelService`, `RadarService`, `SatelliteService`, `CycloneTrackingService`, `WildfireService`
- التخزين المؤقت عبر `Cache` مع **Stale-while-revalidate** (يقدّم بيانات قديمة عند فشل المزود)

### بنية الملفات المهمة

```
src/
├── components/WeatherMap/
│   ├── NewWeatherMap.tsx          ← المكوّن الجذر (MapLibre + كل الطبقات)   ★
│   ├── HeatmapCanvasLayer.tsx     ← رسم الخرائط الحرارية على Canvas         ★
│   ├── ParticleCanvasLayer.tsx    ← رسم الجسيمات المتحركة على Canvas        ★
│   ├── RadarTileLayer.tsx         ← طبقة بلاطات رادار RainViewer
│   ├── SatelliteTileLayer.tsx     ← طبقة بلاطات NASA GIBS
│   ├── CycloneTracker.tsx / WildfireLayer.tsx
│   ├── TimeSlider.tsx             ← الشريط الزمني
│   ├── LayerSidebar.tsx / LayerControls.tsx / CentralLegend.tsx ← واجهة التحكم
│   └── MapContext.tsx             ← يمرّر mapRef لكل الطبقات
├── config/
│   ├── weatherLayers.ts           ← تعريف كل طبقة (مصدر/وحدة/لون/أيقونة)    ★
│   └── layerAnimation.ts          ← منطق الحركة لكل طبقة (motion kind)       ★
├── services/
│   ├── weatherGridService.ts      ← جلب + تخزين + استيفاء (interpolate) الشبكات ★
│   ├── particleEngine.ts          ← محرك الجسيمات الخالص (رياضيات الحركة)    ★
│   ├── colorScales.ts             ← مقاييس الألوان المعايرة على Zoom Earth   ★
│   ├── weatherService.ts / rainviewerService.ts / cycloneService.ts ...
│   └── apiBase.ts
└── store/weatherStore.ts          ← حالة Zustand المركزية                     ★

backend/app/
├── Http/Controllers/WeatherController.php   ← endpoint /grid و /forecast    ★
└── Services/WeatherService.php              ← بناء الشبكة من Open-Meteo       ★
```

### تدفق البيانات (Data Flow) — كيف تصل البيانات للشاشة

```
1. المستخدم يحرّك الخريطة → onMoveEnd → نحفظ mapBounds + zoom في الـ store
2. NewWeatherMap (useEffect) يطلب شبكة الطبقة الفعّالة:
       weatherGridService.generateGrid(type, bounds, model, timeIndex, resolution)
3. weatherGridService → GET /api/grid?north&south&east&west&model&type&timeIndex&resolution
4. Laravel WeatherController.grid() → WeatherService.getGridData()
       - يبني شبكة إحداثيات (rows × cols) داخل الـ bounds حسب الـ resolution
       - يرسل طلبات متوازية (Http::pool) إلى Open-Meteo لكل نقطة
       - يحوّل النتائج إلى GridPoint { lat, lon, value, u, v, speed, direction }
       - يخزّنها مؤقتاً (20 دقيقة fresh / 2 ساعة stale)
5. الواجهة تستلم WeatherGrid { bounds, rows, cols, points[][], ... }
6. HeatmapCanvasLayer  → يرسم ألوان القيم على Canvas (heatmap)
   ParticleCanvasLayer → يرسم جسيمات تتحرك حسب حقل الرياح U/V
```

### كيف يُبنى حقل الرياح (U/V) — مهم للجسيمات

في `WeatherService.php` (سطر ~434) تتحوّل سرعة + اتجاه الرياح إلى مركّبتين:

```php
$rad = deg2rad(270 - $direction);
'u' => cos($rad) * $speed,   // المركّبة الأفقية (شرق-غرب)
'v' => sin($rad) * $speed,   // المركّبة الرأسية (شمال-جنوب)
```

وفي الواجهة `weatherGridService.interpolate()` يقوم بـ **استيفاء ثنائي الخطّية (Bilinear)** لإيجاد U/V في أي إحداثي بين نقاط الشبكة. الجسيمات تقرأ U/V من هذا الاستيفاء وتتحرك بناءً عليه.

### آلية الجودة التدريجية (Progressive Quality)

النظام يطبّق نمط **"سريع ثم عالي الجودة"**:
1. يعرض فوراً أي بيانات مخزّنة (cache) ولو منخفضة الدقة (`resolution=6`).
2. يجلب شبكة سريعة (`resolution=6`) ويعرضها.
3. يجلب شبكة عالية الدقة (`resolution=18–25`) ويستبدلها.
4. يقوم بـ **prefetch** للإطار الزمني التالي والسابق (لسلاسة التشغيل التلقائي).

### الطبقات المتوفرة (13 طبقة)

**طبقات توقّعية عددية (Forecast / Open-Meteo):** الرياح، هبّات الرياح، هطول الأمطار، الحرارة، الإحساس الحراري، الضغط، الرطوبة، نقطة الندى، الغيوم.
**طبقات بلاطات (Raster tiles):** رادار المطر (RainViewer)، قمر صناعي (NASA GIBS).
**طبقات نقطية (Overlays):** الأعاصير، الحرائق.

---

## الجزء الثاني: كيف يعمل Zoom Earth و Windy فعلياً (دراسة عميقة)

هذا القسم يشرح **الآليات الحقيقية** خلف الموقعين، لتتمكّن من بنائها بشكل صحيح وسلس.

### 2.1 المعمارية العامة المشتركة

كلا الموقعين يتبع نفس المبدأ:

```
بيانات نماذج (GFS/ICON/ECMWF بصيغة GRIB2)
   │
   ▼  معالجة على الخادم
شبكة قيم منتظمة (Regular lat/lon grid) → تُرمّز كصور/بلاطات أو JSON
   │
   ▼  ترسل للمتصفّح
المتصفّح يفكّ الترميز → يرسم heatmap ملوّن + يحرّك جسيمات فوقه
```

الفرق الجوهري بين موقعنا و Windy:
- **موقعنا حالياً:** يطلب Open-Meteo **نقطة بنقطة** (Http::pool) ثم يبني شبكة صغيرة. بسيط لكنه يحدّ الدقة وعدد النقاط.
- **Windy:** يحمّل **شبكة كاملة مرمّزة في صورة PNG** (تقنية تُسمّى *data-in-image*) ويفكّها في الـ GPU. أسرع بمئات المرات وأنعم بكثير.

### 2.2 طبقة الـ Heatmap (الخريطة الحرارية الملوّنة)

**المبدأ:** لكل بكسل على الشاشة → نحوّله إلى إحداثي جغرافي (lat/lon) → نستوفي قيمة الطقس عنده → نحوّل القيمة إلى لون عبر مقياس ألوان (color scale / gradient) → نرسم البكسل.

**كيف يفعلها Windy (الأسرع):**
1. الشبكة كلها تُرمّز في صورة: كل بكسل لونه يحمل القيمة (مثلاً درجة الحرارة مرمّزة في قناة R+G).
2. تُرفع الصورة كـ **texture** إلى الـ GPU.
3. **Fragment shader** (WebGL) يقرأ القيمة لكل بكسل، ويطبّق **استيفاء ثنائي الخطّية في الـ GPU** + يحوّلها للون عبر **gradient texture**.
4. النتيجة: ناعمة 100%، تتحرّك مع الخريطة بدون أي حساب على الـ CPU.

**كيف يفعلها موقعنا حالياً (`HeatmapCanvasLayer.tsx`):**
1. ينشئ Canvas منخفض الدقة (`step=2` بكسل، أي نصف الدقة) — تحسين أداء.
2. لكل خلية: `map.unproject([x,y])` → `interpolate()` → `getHeatmapColor()` → `fillRect`.
3. يرسم الـ raster الصغير مكبّراً مع `imageSmoothing` للحصول على نعومة.
4. أثناء تحريك الخريطة: يطبّق `transform: translate + scale` على الـ wrapper (بدون إعادة رسم) ثم يعيد الرسم عند `moveend`.

> الفرق الجوهري: موقعنا يحسب على **CPU** (Canvas 2D)، Windy يحسب على **GPU** (WebGL shader). للأحجام الصغيرة موقعنا كافٍ، لكن للعالم كله بدقة عالية ستحتاج GPU.

### 2.3 طبقة الجسيمات (Particles) — قلب التأثير البصري

هذه أهم نقطة طلبتها. الخوارزمية **معيارية ومعروفة** (أصلها مشروع `earth.nullschool.net` لـ Cameron Beccario، ثم طوّرها Windy و Zoom Earth):

#### الخوارزمية الكلاسيكية (Wind Particle Advection):

```
1. أنشئ N جسيم بمواضع عشوائية على الشاشة، ولكل جسيم عمر عشوائي (age) وعمر أقصى (maxAge).

2. كل إطار (frame):
   أ. "تلاشي الذيل" (Trail fade):
      - بدل مسح الـ canvas بالكامل، ارسم مستطيلاً أسود شفافاً فوقه (مثلاً alpha=0.05).
      - هذا يجعل المسارات القديمة تتلاشى تدريجياً → ينتج "ذيول" (trails) جميلة.

   ب. لكل جسيم:
      - حوّل موضعه (x,y بكسل) إلى إحداثي جغرافي (lat,lon).
      - استوفِ متجه الرياح (u,v) عند ذلك الإحداثي من الشبكة.
      - حرّك الجسيم: x += u * scale ; y -= v * scale   (y مقلوب في الشاشة).
      - ارسم خطاً من الموضع القديم إلى الجديد بلون يعكس السرعة.
      - زِد عمره: age++.
      - إذا تجاوز maxAge أو خرج عن الشاشة → أعِد توليده في موضع عشوائي.

3. كرّر عبر requestAnimationFrame.
```

#### النقاط الحرجة التي تصنع الفرق بين تأثير "احترافي ناعم" و "مكسور":

1. **التلاشي بـ `destination-in` أو `fillRect` شفاف** — وليس `clearRect`. هذا سرّ الذيول.
   - موقعنا يستخدم `fadeCanvas()` مع `destination-in` + `globalCompositeOperation='lighter'` (تراكم سطوع). ✅ صحيح.

2. **إعادة التوليد العشوائي للأعمار (staggered ages)** — حتى لا تختفي كل الجسيمات دفعة واحدة. موقعنا يفعلها (`age: Math.random()*80`). ✅

3. **التعامل مع تحريك الخريطة (pan/zoom):** هذه أكبر مصدر للأخطاء.
   - الخيار الصحيح: أثناء التحريك، **جمّد محرك الجسيمات** وطبّق `CSS transform` على الـ canvas ليتحرك بصرياً مع الخريطة، ثم أعد المزامنة عند `moveend`.
   - موقعنا يفعل هذا عبر `movingRef` + `handleMove` الذي يحسب `translate + scale`. ✅ (لكن انظر القسم 3 — فيه مشكلة).

4. **Overscan (هامش زائد):** ارسم على canvas أكبر من الشاشة (موقعنا: +45%) حتى لا تظهر حواف فارغة عند التحريك. ✅

5. **عدد الجسيمات يتناسب مع المساحة والجهاز** (mobile vs desktop) لتجنّب تقطيع الأداء. موقعنا يفعلها في `computeParticleBudget()`. ✅

6. **مقياس السرعة يتناسب مع الـ zoom** (`computeZoomScale`) — عند التقريب يجب أن تتحرك الجسيمات أسرع بصرياً. ✅

#### كيف يختلف Windy عن الطريقة الكلاسيكية:
- Windy ينفّذ كامل حلقة الجسيمات في **WebGL** (shaders) على الـ GPU → يستطيع رسم **عشرات الآلاف** من الجسيمات بسلاسة 60fps.
- يخزّن مواضع الجسيمات في **texture** ويحدّثها في الـ GPU (ping-pong rendering بين texturين).
- موقعنا يستخدم **Canvas 2D على CPU** → سقفه أقل (آلاف قليلة)، لكنه أبسط وكافٍ لمنطقة محدودة.

### 2.4 طبقة البلاطات الزمنية (Radar / Satellite Loop)

- الرادار والقمر الصناعي ليسا توقعات — بل **سلاسل صور (frames) عبر الزمن**.
- RainViewer و GIBS يقدّمان بلاطات `{z}/{x}/{y}.png` لكل طابع زمني (timestamp).
- التأثير المتحرك = تبديل البلاطات بين الأطر الزمنية بترتيب (loop)، مع تلاشي تدريجي بين الإطارين (cross-fade) لمنع الوميض.

### 2.5 الشريط الزمني (Timeline)

- يفرّق بين: **ماضٍ مرصود** (رادار/قمر) و **مستقبل متوقّع** (نماذج GFS/ICON).
- تحريك المؤشر يغيّر `timeIndex` → يعيد جلب شبكة ذلك الإطار.
- التشغيل التلقائي (autoplay) يزيد `timeIndex` كل فترة — لذلك **الـ prefetch ضروري** لتجنّب التقطيع.

---

## الجزء الثالث: ملاحظات على الكود الحالي + خطة "صحيح وسلس بدون أخطاء"

هذه أهم نقطة عملية لطلبك. وجدت أثناء القراءة عدة نقاط تستحق الانتباه:

### ✅ [تم الإصلاح] خطأ تكرار المعالِجات + توحيد منطق التحريك (Clean Architecture)

**المشكلة الأصلية:** في `HeatmapCanvasLayer.tsx` كان هناك **تعريفان مكرّران** لـ `handleMoveStart` و `handleMoveEnd` (الأول ميّت/مهمَل). والأهم: منطق مزامنة الـ pan/zoom (إنشاء الـ canvas، الـ overscan، حساب `translate + scale`) كان **مكرّراً بالكامل** بين `HeatmapCanvasLayer` و `ParticleCanvasLayer` — وهذا مصدر الخطأ ومصدر صعوبة الصيانة.

**الحل المطبّق:** استُخرج المنطق المشترك في hook واحد **[useMapOverlayCanvas.ts](src/components/WeatherMap/useMapOverlayCanvas.ts)** أصبح "مصدر الحقيقة الوحيد" لمنطق طبقات الـ canvas فوق الخريطة. يتولّى:
- إنشاء غلاف (wrapper) + canvas وربطهما بحاوية الخريطة وتنظيفهما.
- ضبط الحجم مع overscan اختياري.
- مزامنة `movestart/move/moveend` عبر CSS transform (بدل إعادة الرسم في كل إطار).
- مزامنة الشفافية، وتقديم `requestRender` مؤجّل.

النتيجة: `HeatmapCanvasLayer` و `ParticleCanvasLayer` أصبحا **رفيعين** — كل منهما يحتفظ فقط بمنطقه الخاص (رسم الـ heatmap / حلقة الجسيمات)، بلا أي تكرار. لا تعريفات مزدوجة، واجهة واحدة موحّدة. ✅ تم التحقق: `tsc --noEmit` و `vite build` ينجحان.

### ✅ [تم التحقق — لا خطأ] جسيمات الطبقات scalar

تبيّن أن المنطق سليم: في `NewWeatherMap.tsx` تأثير "شبكة الرياح" يطلب النوع `'wind'` **دائماً** عند تفعيل أي طبقة توقّعية (وليس فقط طبقة الرياح). لذلك كل الطبقات scalar تحصل على `motionGrid` صالح للحركة (advection). لا حاجة لتغيير.

### 🟡 الأداء: الطلب نقطة-بنقطة من Open-Meteo

`WeatherService.getGridData()` يرسل طلب HTTP **لكل نقطة شبكة** عبر `Http::pool`. عند `resolution=25` = مئات الطلبات. هذا:
- بطيء وقد يصطدم بحدود معدّل Open-Meteo (429).
- محدود الدقة (لذلك يُقصّ الـ resolution للمساحات الكبيرة).

**التحسين الموصى به:** Open-Meteo يدعم **عدة إحداثيات في طلب واحد** (`latitude=a,b,c&longitude=...`) — دالة `requestForecast()` تدعم هذا فعلاً لكن `getGridData` لا تستخدمها. تجميع النقاط في طلبات أقل = أسرع بكثير وأقل عرضة للحظر.

### ✅ نقاط ممتازة في الكود الحالي (احتفظ بها)
- فصل محرك الجسيمات (`particleEngine.ts`) كوحدة خالصة قابلة للاختبار.
- Stale-while-revalidate في الـ backend (مرونة عند فشل المزود).
- Progressive quality (سريع ثم عالي الدقة) + prefetch.
- مقاييس الألوان معايرة بصرياً على Zoom Earth.

### خطة لجعل الطبقات والجسيمات "صحيحة وسلسة بدون أخطاء"

ترتيب الأولوية للوصول لتجربة بمستوى Zoom Earth:

1. **أصلح الأخطاء البنيوية أولاً** (التكرار في HeatmapCanvasLayer، وضمان توفّر شبكة الرياح كحقل حركة دائم).

2. **حسّن الأداء البصري للجسيمات:**
   - ثبّت معدّل الإطارات (frame budget) — إن انخفض، قلّل عدد الجسيمات تلقائياً.
   - استخدم `Object.assign(p, createParticle())` لإعادة الاستخدام (موجود) بدل إنشاء كائنات جديدة (يقلّل ضغط الـ GC). ✅ موجود.

3. **حسّن مصدر البيانات** (طلبات مجمّعة من Open-Meteo) لرفع الدقة دون بطء.

4. **(تطوير مستقبلي اختياري) الانتقال للـ GPU:** لو أردت دقة وسلاسة بمستوى Windy عالمياً، أعد كتابة `ParticleCanvasLayer` و `HeatmapCanvasLayer` بـ WebGL:
   - heatmap: ارفع الشبكة كـ texture + fragment shader للاستيفاء واللون.
   - particles: خزّن المواضع في texture وحدّثها بـ shader (ping-pong).
   - هذا أكبر تغيير لكنه السبيل لمحاكاة Windy فعلياً.

5. **اختبر على شاشات/أجهزة مختلفة** (mobile budget already handled) وتحت أحمال زوم متعددة.

---

## مراجع سريعة داخل المشروع

| تريد تعديل... | اذهب إلى |
|---------------|----------|
| ألوان الطبقات | `src/services/colorScales.ts` |
| رياضيات حركة الجسيمات | `src/services/particleEngine.ts` |
| رسم الجسيمات على الخريطة | `src/components/WeatherMap/ParticleCanvasLayer.tsx` |
| رسم الـ heatmap | `src/components/WeatherMap/HeatmapCanvasLayer.tsx` |
| أي طبقة متحركة وكيف | `src/config/layerAnimation.ts` |
| تعريف الطبقات ومصادرها | `src/config/weatherLayers.ts` |
| جلب/تخزين/استيفاء الشبكات | `src/services/weatherGridService.ts` |
| بناء الشبكة من Open-Meteo | `backend/app/Services/WeatherService.php` |
| endpoint الشبكة | `backend/app/Http/Controllers/WeatherController.php` |

---

## مصادر خارجية للتعمّق (مفتوحة المصدر)
- **earth.nullschool.net** — الكود المرجعي الأصلي لخوارزمية جسيمات الرياح (GitHub: `cambecc/earth`).
- **Open-Meteo Docs** — توثيق متغيرات GFS/ICON والطلبات المجمّعة.
- **MapLibre GL JS** — توثيق `project/unproject` المستخدم في إسقاط الجسيمات.
- **RainViewer API** و **NASA GIBS WMTS** — لبلاطات الرادار والقمر الصناعي.
</content>
</invoke>
