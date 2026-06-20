# مخطط هندسي واقعي — مشروع راصد ويذر نحو مستوى Zoom Earth

> هذه الوثيقة تترجم الـ SRS الطموح (منصة GeoINT بمستوى مؤسسي) إلى **خطة قابلة للتنفيذ على مشروعك الفعلي** (Laravel + React + MapLibre + WebGL + مصادر مفتوحة).
> المبدأ الحاكم: **افصل "ما يجعله يبدو كـ Zoom Earth" عن "ما يجعله يخدم العالم بمليون مستخدم".** الأول نبنيه الآن؛ الثاني يُؤجَّل حتى يوجد حِمل حقيقي يبرّره.
> تاريخ: 2026-06-16

---

## 0. القاعدة الذهبية: ثلاث طبقات قيمة، لا تخلطها

| الطبقة | ما هي | متى تُبنى |
|--------|-------|-----------|
| **A — العرض (Presentation/GPU)** | WebGL: heatmap + particles + time playback + tiles. **هذا قلب "شكل Zoom Earth".** | **الآن** (جارٍ) |
| **B — البيانات (Data Plane)** | جلب/تطبيع/تخزين النماذج (GFS/ICON/Radar/Satellite/Fires). | تدريجي حسب الطبقات |
| **C — البنية (Platform/Scale)** | Kafka, K8s, PostGIS, PMTiles, MinIO/S3, microservices. | **لاحقاً جداً** — فقط عند وجود آلاف المستخدمين |

> خطؤك المحتمل الوحيد: البدء بالطبقة C. الـ SRS يصفها بالكامل، لكن **لا أحد يراها**. Zoom Earth يبدو كذلك بسبب الطبقة A. ابدأ من حيث تُرى القيمة.

---

## 1. مطابقة الـ SRS بمحرّكاته على كودك الحالي (الحالة الفعلية)

| محرّك في الـ SRS | الحالة في مشروعك | الملف | الخطوة التالية |
|------------------|------------------|-------|----------------|
| **Map / Tiles** | ✅ يعمل (MapLibre + CartoDB) | `NewWeatherMap.tsx` | لا شيء الآن |
| **Layer Engine** (§5) | 🟡 موجود مبعثراً (config + store + مكوّنات) | `config/weatherLayers.ts`, `store/weatherStore.ts` | توحيده في "سجل طبقات" واحد |
| **Heatmap / Raster** (§9,§10 تلوين) | ✅ **WebGL جديد** | `webgl/HeatmapGLLayer.ts` | ضبط الألوان معك |
| **Particle Engine** (§7) | 🟡 Canvas 2D حالياً | `ParticleCanvasLayer.ts` | **ترقيته لـ WebGL — التالي** |
| **Weather Engine** (§8) | ✅ Open-Meteo (GFS/ICON) مع تجميع طلبات | `backend/.../WeatherService.php` | لاحقاً: GRIB2 مباشر |
| **Time Machine** (§6) | 🟡 بدائي (`currentTimeIndex` + إعادة جلب) | `store`, `TimeSlider.tsx` | تحويله لـ "مجموعات إطارات" مُسبقة التحميل |
| **Satellite** (§9) | ✅ بلاطات NASA GIBS | `SatelliteTileLayer.tsx` | إضافة Time loop |
| **Radar** | ✅ RainViewer | `RadarTileLayer.tsx` | — |
| **Fire** (§10) | ✅ FIRMS | `WildfireLayer.tsx` | — |
| **Storm/Hurricane** (§13) | 🟡 تجريبي محلي | `CycloneTracker.tsx` | مصدر رسمي لاحقاً |
| **Caching** (§17) | ✅ ملفات Laravel + ذاكرة العميل | `WeatherService.php` | كافٍ الآن |
| **PostGIS / Kafka / K8s / MinIO** (§12–20) | ❌ غير موجود | — | **لا تبنِه الآن** (انظر §6) |

**الخلاصة:** أنت فعلياً عند ~**65–70%** من "الـ MVP المرئي" الذي وصفه الـ SRS نفسه كهدف واقعي لفريق صغير. الناقص الأهم بصرياً: **Particle Engine بـ WebGL** و **Time Machine حقيقي**.

---

## 2. معمارية الواجهة المُعاد تنظيمها (Layer Engine — §5)

الـ SRS يطلب بنية مجلدات feature-based و"محرّك طبقات". هذا تحسين حقيقي وآمن. البنية المقترحة (تطوّر تدريجي، لا إعادة كتابة):

```
src/
├── map/                      # الخريطة الأساس وسياقها
│   ├── MapShell.tsx          (= NewWeatherMap الحالي)
│   └── MapContext.tsx
├── layers/                   # ← Layer Engine
│   ├── registry.ts           # سجل واحد: كل طبقة {id, kind, source, render, legend}
│   ├── types.ts
│   ├── webgl/                # محرّكات GPU
│   │   ├── glUtils.ts        ✅
│   │   ├── weatherTextures.ts ✅
│   │   ├── HeatmapGLLayer.ts ✅
│   │   └── ParticleGLLayer.ts ← التالي
│   ├── tiles/                # raster-loop (radar/satellite)
│   └── overlays/             # نقاط (fires/storms)
├── time/                     # ← Time Engine
│   ├── TimelineController.ts
│   └── frameCache.ts
├── data/                     # خدمات الجلب (= services الحالية)
├── store/                    # Zustand
└── ui/                       # لوحات/أشرطة/مفاتيح ألوان
```

**جوهر Layer Engine** — واجهة موحّدة لكل طبقة (يلغي التكرار في `NewWeatherMap`):

```ts
interface WeatherLayer {
  id: LayerKey;
  kind: 'gpu-scalar' | 'gpu-vector' | 'tile-loop' | 'point-overlay';
  source: DataSource;
  getLegend(): LegendSpec;
  // كل طبقة تعرف كيف تُركَّب وتُزال وتُحدَّث:
  mount(map): void;  update(frame): void;  unmount(): void;
}
```

فيصبح `MapShell` مجرد: `activeLayers.map(l => l.mount(map))` — لا شروط متشعّبة. **هذا أنظف بناء معماري يمكن تطبيقه فوراً.**

---

## 3. Particle Engine بـ WebGL (§7) — الخطوة المرئية التالية

الطريقة المعيارية (Mapbox `webgl-wind` لـ V. Agafonkin، وهي تقنية Zoom Earth/Windy):

```
نسيج الرياح (U,V)  ──┐
                     ├─► [update shader] ──► نسيج مواضع الجسيمات (ping-pong)
نسيج المواضع t      ──┘                          │
                                                 ▼
                              [draw shader] ──► framebuffer للذيول (fade كل إطار)
                                                 │
                                                 ▼
                                          الشاشة (premultiplied blend)
```

- **عدد الجسيمات:** 50k–200k (مخزّنة في نسيج، مُحدَّثة على الـ GPU — لا CPU).
- **الذيول:** framebuffer متراكم مع تلاشٍ تدريجي (كما تفعل Canvas الآن لكن على GPU).
- **التكامل مع MapLibre:** نفس نمط `HeatmapGLLayer` (Custom Layer + `prerender` للمحاكاة في نسيج، ثم `render` للرسم).
- U/V متوفّرة أصلاً: `weatherTextures.ts` يخزّنهما في قناتي G/B. ✅ جاهز.

**النتيجة:** جسيمات بمئات الآلاف، 60fps، تتزامن مع الخريطة — مطابقة فعلية لـ Zoom Earth.

---

## 4. Time Machine Engine (§6) — من "إعادة جلب" إلى "تبديل إطارات"

حالياً: تحريك الشريط يُعيد جلب الشبكة → بطيء ومتقطّع.
الهدف (أسلوب Zoom Earth): **مجموعات إطارات مُسبقة التحميل + تبديل فوري**.

```
TimelineController:
  - يحدّد نافذة زمنية [t-3h .. t+12h]
  - يطلب شبكات كل الإطارات مسبقاً (prefetch) ويخزّنها في frameCache
  - playback = تبديل النسيج المرفوع للـ GPU فقط (لا شبكة، لا حساب)
  - cross-fade بين الإطارين لمنع الوميض
```

البنية موجودة جزئياً (`prefetchGrid` في `weatherGridService`). المطلوب: مُتحكّم زمني يدير النافذة والتبديل بدل المنطق المبعثر في `NewWeatherMap`.

---

## 5. طبقة البيانات (§8,§9,§13) — تطوّر واقعي

| المرحلة | المصدر | ملاحظة |
|---------|--------|--------|
| **الآن** ✅ | Open-Meteo (يغلّف GFS/ICON) — تجميع طلبات | كافٍ لكل طبقات التوقّع |
| لاحقاً | GRIB2 مباشر من NOAA/DWD عبر خدمة Python (xarray/cfgrib) | دقة أعلى + لا حدود معدّل. **هذا أول مبرّر لخدمة Python** |
| لاحقاً | بلاطات مولّدة محلياً (PMTiles) | فقط عند الحاجة لتاريخ طويل/حمل عالٍ |

> خدمة Python + GDAL (§15) لها مبرّر **واحد فقط** يستحق التعقيد: معالجة GRIB2/GeoTIFF الخام وتوليد بلاطات. حتى ذلك الحين، Open-Meteo يكفي.

---

## 6. ما الذي يجب ألّا تبنيه الآن (ولماذا) — صراحة هندسية

الـ SRS يطلب §11–§22. هذه **سحب تقنية تُبطئك بلا قيمة مرئية** في وضعك الحالي:

| العنصر | لماذا التأجيل |
|--------|---------------|
| **Kafka / Microservices** (§16) | لا يوجد حِمل يبرّر رسائل موزّعة. خدمة واحدة تكفي حتى آلاف الطلبات/دقيقة. |
| **Kubernetes / Terraform** (§19) | حاوية واحدة + خادم بسيط تكفي. K8s تعقيد تشغيلي ضخم بلا مستخدمين. |
| **PostGIS** (§12) | لا تشغّل استعلامات جغرافية معقّدة بعد. الكاش الملفّي + الذاكرة يكفيان. أضِفه عند الحاجة لـ ST_* فعلياً. |
| **MinIO/S3 + 100TB** (§18) | لا تخزّن تاريخاً ضخماً بعد. تبدأ بالحاجة عند بناء Time Machine تاريخي طويل. |
| **Kafka topics / ELK / Prometheus** (§13,§20) | مراقبة مؤسسية لنظام مؤسسي غير موجود بعد. سجلّ Laravel يكفي الآن. |

**القاعدة:** أضِف كل عنصر من هذه **عند أول ألم حقيقي** يسبّبه غيابه — لا قبله. هذا هو الفرق بين مهندس يبني منتجاً ومهندس يبني رسماً.

---

## 7. خارطة الطريق الواقعية (مُسقطة على §23)

### المرحلة 1 — "يبدو كـ Zoom Earth" (الأسابيع القادمة) ← نحن هنا
- ✅ إصلاح خط البيانات (CORS/مسارات/تجميع طلبات)
- ✅ WebGL Heatmap
- ⏳ **WebGL Particle Engine** (التالي مباشرة)
- ⏳ Layer Engine (توحيد السجل)
- ⏳ Time Machine (تبديل إطارات + cross-fade)

### المرحلة 2 — "اكتمال مرئي" (بعدها)
- Time loop للرادار/القمر الصناعي
- مفاتيح ألوان ديناميكية لكل طبقة (Legend Engine)
- ضبط أداء (frame budget تكيّفي، جودة حسب الجهاز)

### المرحلة 3 — "دقة بيانات" (عند الحاجة)
- خدمة Python لمعالجة GRIB2 مباشرة (دقة أعلى من Open-Meteo)
- توليد بلاطات PMTiles للطبقات الثقيلة

### المرحلة 4 — "مقياس" (فقط عند وجود مستخدمين فعليين)
- PostGIS، CDN، حاويات، مراقبة — تُضاف عند الحِمل الحقيقي

---

## 8. القرار العملي الآن

نحن في منتصف المرحلة 1. أنصح بالترتيب:
1. **تأكيد أن WebGL Heatmap يعمل بصرياً عندك** (يحتاج تحديث المتصفّح).
2. **بناء WebGL Particle Engine** — أكبر أثر بصري متبقٍّ، ويطابق §7 من الـ SRS حرفياً.
3. **Layer Engine** — أنظف إعادة هيكلة، تُسهّل كل ما بعده.

البنية المؤسسية (C) تنتظر مبرّرها. هكذا نبني نسخة تُشبه Zoom Earth بصرياً وسلوكياً، بمصادر مجانية وفريق صغير — وهو بالضبط ما وصفه الـ SRS كهدف "MVP 70–80%" الواقعي.
