# استراتيجية طبقات الطقس بأسلوب Zoom Earth وبمصادر مجانية

تاريخ الدراسة: 2026-05-11  
الهدف: توثيق ما تم فهمه من Zoom Earth وتحويله إلى خطة عملية لتطوير هذا المشروع بمنطق طبقات صحيح، تفاعلي، ومتحرك قدر الإمكان مع الاعتماد على APIs مجانية أو مفتوحة قدر الإمكان.

## الخلاصة التنفيذية

Zoom Earth ليس مجرد خريطة تعرض بيانات طقس من endpoint واحد. هو نظام طبقات متكامل:

- خريطة أساس وتسمية مدن وحدود.
- طبقات صور أقمار صناعية.
- طبقات رادار أمطار حية.
- طبقات توقعات عددية من نماذج مثل GFS و ICON.
- طبقات رسومية فوقية مثل حركة الرياح، الضغط، القيم، التسميات، الحرائق، والأعاصير.
- خط زمني يفرق بين البيانات الحية/الماضية/التوقعية.

المهم: لا يجب الاعتماد على endpoints داخلية خاصة بZoom Earth مثل `api.zoom.earth` أو `tiles.zoom.earth` في تطبيقنا. هذه ليست API عامة موثقة للاستخدام الخارجي، وقد تتغير أو تمنع الطلبات في أي وقت. البديل الصحيح هو بناء نفس المنطق فوق مصادر مفتوحة أو مجانية مستقرة.

## ما تم استنتاجه من Zoom Earth

### الطبقات الرئيسية

Zoom Earth يقسم الطقس إلى نوعين:

1. **Weather Maps**
   - Precipitation forecast
   - Wind speed forecast
   - Wind gusts forecast
   - Temperature forecast
   - Feels like temperature
   - Wet-bulb temperature
   - Relative humidity
   - Dew point
   - Atmospheric pressure

2. **Map Overlays**
   - Radar
   - Radar coverage
   - Clouds
   - Pressure isolines
   - Wind animation
   - Heat spots
   - Labels
   - Values
   - Border lines
   - Tropical systems

هذا مهم جدًا للمشروع: اختيار "الرياح" ليس فقط جسيمات متحركة. في Zoom Earth الرياح خريطة توقعات لسرعة الرياح مع إمكانية إظهار animation فوقها. واختيار "الأمطار" ليس هو الرادار دائمًا؛ يوجد فرق بين:

- **Radar**: أمطار مرصودة شبه حية من الرادارات.
- **Precipitation forecast**: توقعات أمطار/ثلج/غيوم من نموذج عددي.

### نماذج التوقع

Zoom Earth يعرض نموذجين أساسيين:

- `ICON` بدقة تقريبية 13 km، من DWD الألمانية.
- `GFS` بدقة تقريبية 22-25 km، من NOAA/NCEP الأمريكية.

المنطق الصحيح:

- ICON أفضل عندما يكون متوفرًا وللمدى الأقصر.
- GFS يغطي مدى أطول عالميًا.
- عند اختيار وقت خارج مدى ICON يجب إظهار تنبيه أو التحويل إلى GFS، لا ترك الخريطة صامتة أو ببيانات ناقصة.

### الزمن والتحريك

Zoom Earth يفصل بين خطوط زمن مختلفة:

- الأقمار الصناعية: صور قريبة من الزمن الحقيقي أو أرشيف HD.
- الرادار: إطار كل عدة دقائق للبيانات المرصودة.
- التوقعات: ساعات مستقبلية حسب model run.

لذلك يجب عدم استخدام timeline واحد وكأنه يمثل كل الطبقات بنفس المعنى. نفس المؤشر الزمني يمكن استخدامه في الواجهة، لكن داخليًا كل طبقة لها `timeMode` مختلف.

## مصادر مجانية أو مفتوحة مقترحة

### 1. توقعات GFS و ICON

المصدر المقترح حاليًا: Open-Meteo

- GFS: `https://open-meteo.com/en/docs/gfs-api`
- DWD ICON: `https://open-meteo.com/en/docs/dwd-api`

المتغيرات المطلوبة للطبقات:

- wind speed: `wind_speed_10m`
- wind direction: `wind_direction_10m`
- wind gusts: `wind_gusts_10m`
- temperature: `temperature_2m`
- feels like: `apparent_temperature`
- humidity: `relative_humidity_2m`
- dew point: `dew_point_2m`
- precipitation: `precipitation`, ويمكن استخدام `rain`, `snowfall`
- pressure: `surface_pressure`
- clouds: `cloud_cover`, ومع الوقت يمكن إضافة `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high`

ملاحظة مهمة: Open-Meteo مناسب كبداية مجانية وسهلة، لكنه ليس tile weather map جاهزًا. نحن نحوله إلى grid/Canvas داخل مشروعنا، لذلك يجب الانتباه للـ caching وعدد الطلبات.

### 2. الرادار الحي

المصدر المقترح: RainViewer Weather Maps API

- الوثائق: `https://www.rainviewer.com/api/weather-maps-api.html`
- ملف الزمن: `https://api.rainviewer.com/public/weather-maps.json`
- يعطي إطارات رادار ماضية عادة خلال آخر ساعتين وبفاصل زمني يقارب 10 دقائق.
- يعطي tiles بصيغة مشابهة:
  - `{host}{path}/512/{z}/{x}/{y}/{color}/{options}.png`

الاستخدام المنطقي:

- طبقة `radar` مستقلة عن `precipitation forecast`.
- إذا ضغط المستخدم "هطول الأمطار" من خرائط الطقس، نعرض forecast precipitation.
- إذا ضغط "رادار"، نعرض observed radar tiles.
- إذا كانت المنطقة بدون تغطية رادار، نظهر رسالة واضحة ونقترح استخدام precipitation forecast.

### 3. الأقمار الصناعية

المصدر المقترح للنسخة المجانية: NASA GIBS

- الوثائق: `https://nasa-gibs.github.io/gibs-api-docs/`
- يوفر طبقات WMTS جاهزة كtile pyramids.
- مناسب لطبقات مرئية مثل true color وبعض طبقات الغيوم والدخان حسب المنتج.

ملاحظة مهمة:

- NASA GIBS لا يساوي بالضرورة live geostationary مثل GOES/Himawari/Meteosat في كل التفاصيل التي يعرضها Zoom Earth.
- لكنه مصدر مجاني قوي كبداية، ويمكن لاحقًا إضافة مصادر NOAA/NASA/EUMETSAT مباشرة إذا احتجنا قربًا أكبر من live satellite.

### 4. الحرائق والنقاط الساخنة

المصدر المقترح: NASA FIRMS

- الوثائق: `https://firms.modaps.eosdis.nasa.gov/api/`
- يوفر hotspots من MODIS و VIIRS.
- قد يحتاج `MAP_KEY` مجاني من NASA FIRMS.

الاستخدام:

- طبقة نقاط، ليست heatmap طقس.
- يجب توضيح أنها ليست live تمامًا، وقد تكون متأخرة، ولا تصلح لاتخاذ قرارات سلامة.

### 5. الخرائط والتسميات

الموجود حاليًا:

- المشروع يستخدم CARTO basemap tiles في `NewWeatherMap.tsx`.
- التسميات العربية موجودة كطبقة داخلية في `ArabicCityLabels`.

المقترح:

- الاستمرار مؤقتًا على CARTO/OSM مع attribution واضح.
- لاحقًا يمكن فصل base map عن labels باستخدام tiles بدون labels + طبقة labels مستقلة.
- يجب مراجعة شروط استخدام tile provider عند ارتفاع عدد المستخدمين.

## حالة المشروع الحالية

### الملفات الأساسية

- `src/store/weatherStore.ts`
  - يدير `visibleLayers`.
  - `setActiveLayer` يجعل طبقات الطقس الأساسية exclusive.

- `src/components/WeatherMap/NewWeatherMap.tsx`
  - يربط الخريطة بLeaflet.
  - عند تفعيل الرياح يطلب grid من `weatherGridService.generateGrid('wind', ...)`.
  - عند تفعيل الحرارة/الأمطار/الضغط/الرطوبة/الغيوم يطلب grid ثم يرسم `HeatmapCanvasLayer`.

- `src/services/weatherGridService.ts`
  - يطلب `/api/v1/grid`.
  - يحتوي interpolation للرياح والقيم.

- `src/components/WeatherMap/WindCanvasLayer.tsx`
  - يرسم جسيمات رياح متحركة فوق الخريطة.

- `src/components/WeatherMap/HeatmapCanvasLayer.tsx`
  - يرسم مربعات grid ملونة ثم يطبق blur.

- `backend/app/Services/WeatherService.php`
  - يستخدم Open-Meteo endpoints:
    - `https://api.open-meteo.com/v1/gfs`
    - `https://api.open-meteo.com/v1/dwd-icon`
  - يولد grid من نقاط متعددة.
  - يحتوي fallback synthetic عند فشل المزود.

- `backend/app/Services/RadarService.php`
  - حاليًا يعتمد على صور/GIF وروابط عامة متفرقة.
  - لا يقدم tile layer عالمي سلس مثل Zoom Earth.

- `backend/app/Services/SatelliteService.php`
  - حاليًا أقرب إلى placeholder.
  - لا يقدم طبقة أقمار tile/WMTS تفاعلية.

## المشاكل التي يجب أخذها في الاعتبار

### 1. الرياح حاليًا ليست طبقة كاملة مثل Zoom Earth

الموجود:

- جسيمات متحركة فقط عند اختيار wind.
- لا يوجد background scalar map واضح لسرعة الرياح.

المطلوب:

- عند اختيار الرياح يظهر:
  - خريطة ألوان لسرعة الرياح.
  - جسيمات wind animation فوقها.
  - قيمة مركزية أو عند المؤشر.
  - legend بوحدة km/h أو m/s أو knots حسب الإعداد.

### 2. الأمطار يجب فصلها إلى forecast و radar

الموجود:

- `precipitation` يرسم forecast من Open-Meteo.
- `radar` موجود في state لكنه غير مدمج كtile layer حقيقي.

المطلوب:

- `precipitation`: توقعات أمطار/ثلوج من GFS/ICON.
- `radar`: أمطار مرصودة حية من RainViewer.
- عند عدم توفر radar coverage، لا نخفي الأمر؛ نعرض "لا توجد تغطية رادار هنا" ونقترح forecast.

### 3. grid sampling الحالي محدود

الموجود في backend:

- الدقة الفعلية تضبط غالبًا بين 6 و 12 أو 14 نقطة حسب مدى الخريطة.
- يتم أخذ نقاط من Open-Meteo ثم رسمها كمربعات.

هذا مقبول كبداية، لكنه ليس بجودة Zoom Earth. الأفضل تدريجيًا:

1. تحسين grid الحالي adaptive حسب zoom وحجم الشاشة.
2. استخدام interpolation ناعم لكل pixel أو offscreen canvas.
3. لاحقًا بناء tiles داخلية مسبقة من GRIB/NetCDF إذا أردنا دقة أعلى بدون تكلفة API.

### 4. fallback synthetic قد يضلل المستخدم

الموجود:

- عند فشل Open-Meteo، backend يولد بيانات synthetic.

المشكلة:

- هذا يعطي شكلًا جميلًا لكنه ليس طقسًا حقيقيًا.

المطلوب:

- إذا استخدمنا synthetic fallback يجب وضع metadata واضحة:
  - `fallback: synthetic`
  - رسالة في الواجهة: "بيانات تقريبية مؤقتة بسبب تعذر الاتصال بالمصدر".
- لا يجب خلطها مع بيانات حقيقية بدون تنبيه.

### 5. الأقمار والرادار placeholders

الموجود في الخدمات الخلفية غير كافٍ لتجربة Zoom Earth:

- SatelliteService يعطي روابط صور ثابتة تقريبية.
- RadarService يعطي روابط GIF/صور من مصادر متفرقة.

المطلوب:

- رادار: RainViewer TileLayer.
- أقمار: NASA GIBS WMTS/TileLayer.
- لاحقًا يمكن proxy/cache عبر Laravel للتحكم في CORS/attribution/rate.

## التصميم المنطقي المقترح للطبقات

يجب تعريف كل طبقة ككائن metadata، وليس منطقًا متفرقًا داخل المكونات.

مثال مقترح:

```ts
type LayerKind = 'forecast-scalar' | 'forecast-vector' | 'tile-raster' | 'point-overlay';
type TimeMode = 'forecast' | 'observed-past' | 'near-real-time' | 'static';

interface WeatherLayerConfig {
  id: string;
  labelAr: string;
  kind: LayerKind;
  timeMode: TimeMode;
  source: 'open-meteo' | 'rainviewer' | 'nasa-gibs' | 'nasa-firms' | 'local';
  variables: string[];
  models?: Array<'GFS' | 'ICON'>;
  unit: string;
  palette: string;
  opacity: number;
  updateIntervalMinutes: number;
  attribution: string;
}
```

### طبقات Weather Maps

- `wind-speed`
  - source: Open-Meteo
  - kind: forecast-vector + scalar background
  - variables: `wind_speed_10m`, `wind_direction_10m`

- `wind-gusts`
  - source: Open-Meteo
  - kind: forecast-scalar
  - variables: `wind_gusts_10m`

- `precipitation`
  - source: Open-Meteo
  - kind: forecast-scalar
  - variables: `precipitation`, `rain`, `snowfall`

- `temperature`
  - source: Open-Meteo
  - kind: forecast-scalar
  - variables: `temperature_2m`

- `temperature-feel`
  - source: Open-Meteo
  - kind: forecast-scalar
  - variables: `apparent_temperature`

- `humidity`
  - source: Open-Meteo
  - kind: forecast-scalar
  - variables: `relative_humidity_2m`

- `dew-point`
  - source: Open-Meteo
  - kind: forecast-scalar
  - variables: `dew_point_2m`

- `pressure`
  - source: Open-Meteo
  - kind: forecast-scalar
  - variables: `surface_pressure`

### طبقات Map Overlays

- `radar`
  - source: RainViewer
  - kind: tile-raster
  - timeMode: observed-past

- `satellite`
  - source: NASA GIBS
  - kind: tile-raster
  - timeMode: near-real-time أو observed-past حسب المنتج

- `wind-animation`
  - source: نفس grid الرياح
  - kind: overlay animation
  - يظهر فوق wind-speed أو فوق طبقات أخرى إذا أراد المستخدم.

- `clouds`
  - source: Open-Meteo أو NASA GIBS حسب الوضع
  - في forecast: `cloud_cover`
  - في satellite: imagery overlay

- `pressure-isolines`
  - source: pressure grid
  - يحتاج contouring algorithm، مثل marching squares.

- `heat-spots`
  - source: NASA FIRMS
  - kind: point-overlay

## معمارية التنفيذ المقترحة بدون اشتراكات

### المرحلة الأولى: تحسين الموجود بسرعة وبشكل منطقي

لا نبدأ بGRIB كامل لأنه أثقل. نستخدم الموجود ونحسنه:

1. إبقاء Open-Meteo عبر backend، وليس من المتصفح مباشرة.
2. تحسين `/api/v1/grid` ليعيد metadata:
   - `source`
   - `model`
   - `runTime`
   - `validTime`
   - `unit`
   - `fallback`
   - `providerMessage`
3. توحيد أسماء الطبقات:
   - `wind` تصبح `wind-speed`
   - إضافة `wind-gusts`
   - إضافة `dew-point`
   - إضافة `temperature-feel`
4. جعل wind layer يرسم heatmap سرعة الرياح + particles.
5. تحسين HeatmapCanvasLayer:
   - رسم ناعم بدل مربعات واضحة.
   - استخدام bilinear interpolation.
   - استخدام canvas offscreen عندما يكون ممكنًا.
6. إضافة debounce/cancel للطلبات عند تحريك الخريطة.

### المرحلة الثانية: الرادار الحقيقي

1. إنشاء خدمة frontend/backend لـ RainViewer:
   - جلب `weather-maps.json`.
   - اختيار آخر frame أو frame حسب timeline.
   - بناء TileLayer URL.
2. إضافة طبقة `RadarTileLayer`.
3. إضافة coverage overlay اختياري.
4. فصل زر "الرادار" عن "هطول الأمطار".

### المرحلة الثالثة: الأقمار الصناعية

1. إنشاء config لطبقات NASA GIBS.
2. استخدام WMTS/TileLayer بدل الصور الثابتة.
3. إضافة attribution واضح لـ NASA GIBS.
4. ربط timeline حسب تواريخ الطبقة المتاحة إن أمكن.

### المرحلة الرابعة: الضغط والغيوم والقيم

1. الضغط:
   - heatmap للضغط.
   - لاحقًا isolines عبر marching squares.
2. الغيوم:
   - forecast cloud_cover من Open-Meteo.
   - لاحقًا satellite cloud imagery من GIBS.
3. values:
   - عينات على الخريطة من grid الحالي.
   - لا يجب عرض قيم كثيرة جدًا على zoom بعيد.

### المرحلة الخامسة: نظام tiles داخلي اختياري

إذا أردنا جودة أعلى مع بقاء التكلفة صفر تقريبًا:

1. backend cron jobs تحمل GRIB2 من مصادر مفتوحة:
   - NOAA GFS open data.
   - DWD ICON open data.
2. معالجة GRIB إلى rasters/vector tiles.
3. تخزين tiles محليًا أو object storage.
4. الواجهة تستخدم TileLayer داخلي.

هذه أفضل جودة لكنها تحتاج وقتًا وبنية معالجة، لذلك ليست المرحلة الأولى.

## قواعد مهمة حتى يبقى النظام مجانيًا قدر الإمكان

- لا تستخدم endpoints داخلية من Zoom Earth.
- لا تعتمد على API مدفوع في المسار الأساسي.
- ضع كل الطلبات الثقيلة عبر backend cache.
- لا تجعل كل مستخدم يطلب عشرات النقاط مباشرة من Open-Meteo من المتصفح.
- cache حسب:
  - layer
  - model
  - quantized bounds أو tile z/x/y
  - timeIndex
  - resolution
- احترم attribution لكل مصدر.
- اعرض حالة no-data بوضوح.
- لا تعرض fallback synthetic كأنه حقيقي.
- ابدأ بمصادر مجانية، لكن اترك بنية `Provider` قابلة للتبديل إذا تغيرت الشروط مستقبلًا.

## تعريف مقترح للـ providers

```ts
type WeatherProviderId =
  | 'open-meteo-gfs'
  | 'open-meteo-icon'
  | 'rainviewer'
  | 'nasa-gibs'
  | 'nasa-firms'
  | 'local-grib-cache';
```

كل provider يجب أن يحتوي:

- `id`
- `name`
- `cost`: free / free-with-key / paid
- `requiresKey`
- `rateLimitNotes`
- `attribution`
- `licenseUrl`
- `supportedLayers`
- `timeResolution`
- `spatialResolution`

## سلوك الواجهة المطلوب عند الضغط على الطبقات

### عند الضغط على الرياح

يجب أن يحدث الآتي:

1. تفعيل `wind-speed` كطبقة weather map رئيسية.
2. تحميل grid الرياح من النموذج المختار.
3. رسم تدرج ألوان لسرعة الرياح.
4. تشغيل wind particles تلقائيًا.
5. إظهار legend بوحدة الرياح.
6. إظهار model badge مثل `GFS 22 km` أو `ICON 13 km`.
7. عند hover/click تظهر قيمة السرعة والاتجاه.

### عند الضغط على هطول الأمطار

يجب أن يحدث الآتي:

1. تفعيل forecast precipitation.
2. تحميل `precipitation/rain/snowfall`.
3. رسم ألوان واضحة:
   - أمطار خفيفة: أزرق فاتح.
   - أمطار متوسطة: أزرق أقوى.
   - أمطار غزيرة: بنفسجي/وردي.
   - ثلج: لون منفصل إذا توفر.
4. إظهار legend بوحدة mm/h أو in/h.
5. عدم الخلط مع radar إلا إذا شغل المستخدم overlay الرادار.

### عند الضغط على الرادار

1. تفعيل RainViewer tile layer.
2. استخدام آخر frame متوفر.
3. عند تشغيل animation، التنقل بين frames السابقة.
4. إظهار تحذير إذا لا توجد تغطية.

### عند الضغط على الحرارة

1. استخدام `temperature_2m`.
2. رسم تدرج منطقي من البارد إلى الحار.
3. إظهار القيم بوحدة Celsius/Fahrenheit.

### عند الضغط على الرطوبة

1. استخدام `relative_humidity_2m`.
2. تدرج من جاف إلى رطب.
3. دعم dew point كطبقة منفصلة لاحقًا.

### عند الضغط على الضغط

1. استخدام `surface_pressure`.
2. رسم heatmap.
3. لاحقًا: pressure isolines كoverlay.

## معايير القبول قبل اعتبار الطبقات صحيحة

- تبديل الطبقة لا يترك canvas قديم أو layer متراكم.
- عند التحريك والزووم لا تتقطع الخريطة أو تختفي الطبقة بلا سبب.
- الرياح تتحرك باتجاه صحيح ومتناسق مع اتجاه النموذج.
- الأمطار لا تظهر في مناطق بلا بيانات إلا إذا كان forecast فعليًا يقول ذلك.
- الرادار لا يدعي تغطية عالمية إذا المصدر لا يغطي المنطقة.
- كل طبقة تعرض المصدر والوقت والنموذج.
- الـ legends تطابق القيم الحقيقية والوحدات.
- جميع مصادر البيانات لها attribution ظاهر.
- عند فشل API توجد رسالة واضحة، لا صمت ولا بيانات مزيفة بدون تنبيه.
- الأداء مقبول على desktop وmobile.

## ملاحظات للمنفذ لاحقًا

- ابدأ من `WeatherService.php` و `weatherGridService.ts` لأنهما مركز البيانات الحالي.
- لا تضف provider جديدًا مباشرة داخل component. اجعل المكون يستهلك layer config أو service.
- `WindCanvasLayer` جيد كبداية، لكن يجب أن يعمل فوق grid مرسوم، لا وحده فقط.
- `HeatmapCanvasLayer` يحتاج interpolation وتحسين rendering.
- `RadarService.php` يحتاج إعادة بناء حول RainViewer بدل روابط GIF.
- `SatelliteService.php` يحتاج إعادة بناء حول NASA GIBS أو مصدر tiles حقيقي.
- `visibleLayers` يجب أن يفرق بين:
  - main weather map layer
  - independent overlays
- لا تجعل `closeAllLayers` يطفئ كل شيء مثل labels/base map إذا صارت overlays كثيرة لاحقًا.

## مصادر مرجعية

- Zoom Earth: `https://zoom.earth/`
- Open-Meteo GFS API: `https://open-meteo.com/en/docs/gfs-api`
- Open-Meteo DWD ICON API: `https://open-meteo.com/en/docs/dwd-api`
- RainViewer Weather Maps API: `https://www.rainviewer.com/api/weather-maps-api.html`
- NASA GIBS Docs: `https://nasa-gibs.github.io/gibs-api-docs/`
- NASA FIRMS API: `https://firms.modaps.eosdis.nasa.gov/api/`
- OpenStreetMap attribution: `https://www.openstreetmap.org/copyright`
- CARTO basemaps: `https://carto.com/basemaps/`

## القرار المعماري المقترح

أفضل مسار عملي لهذا المشروع:

1. **الآن**: Open-Meteo forecast grid + Canvas محسّن + RainViewer radar + NASA GIBS satellite.
2. **بعد الاستقرار**: cache أقوى وtile-like API داخلي.
3. **عند الحاجة لجودة أعلى**: معالجة GRIB2 محليًا من NOAA/DWD وبناء tiles داخلية.

بهذا نحصل على تطبيق منطقي وقابل للتطور، بدون اشتراكات في البداية، وبدون الاعتماد على endpoints خاصة أو غير مضمونة.
