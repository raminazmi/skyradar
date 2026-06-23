/**
 * layerOrder.ts
 * يحدّد موضع إدراج طبقات الطقس في مكدّس MapLibre بحيث تظهر **أسفل** حدود الدول
 * والتسميات (مثل Zoom Earth) بدل تغطيتها — فتبقى الحدود وأسماء المدن واضحة فوق الطبقة.
 */

import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * خلفية الخريطة لكل طبقة (مطابقة Zoom Earth): لكل طبقة قاعدة خريطة خاصة بها فتظهر
 * ألوانها بأعلى دقّة. الحرارة/الإحساس/الندى/الرطوبة على قاعدة فاتحة (فستقية)، أما
 * الرياح/الهبّات/الأمطار/الغيوم/الضغط فعلى قاعدة داكنة لتبرز ألوانها الزاهية.
 */
const LIGHT_BASE_LAYERS = new Set(['temperature', 'feels-like', 'dewpoint', 'humidity', 'pressure']);

/** هل قاعدة خريطة الطبقة الفعّالة داكنة؟ (لا طبقة فعّالة → الثيم العام). */
export function layerBaseIsDark(activeLayer: string | null | undefined, fallbackDark: boolean): boolean {
    if (!activeLayer) return fallbackDark;
    return !LIGHT_BASE_LAYERS.has(activeLayer);
}

/** يطابق أي طبقة خطّية للحدود الإدارية (دول/ولايات/محافظات). */
const BOUNDARY_LINE_RE = /boundary|admin|border/i;

function isBoundaryLine(layer: { type: string; id: string }): boolean {
    return layer.type === 'line' && BOUNDARY_LINE_RE.test(layer.id);
}

/**
 * يرفع **كل** طبقات الحدود (الداخلية والخارجية) لتُرسم أسفل أوّل تسمية نصية مباشرةً.
 * بعض الأنماط (CARTO dark-matter) ترسم الحدود الداخلية أسفل المكدّس (تحت الماء)،
 * فترفعها هذه الدالة لتصبح كلّها متجاورة فوق الخريطة وتحت التسميات — فتظهر فوق طبقة الطقس.
 * تُستدعى مرّة عند تحميل الخريطة.
 */
export function liftAdminBordersAboveBase(map: MaplibreMap): void {
    const layers = map.getStyle()?.layers ?? [];
    const firstSymbolId = layers.find((l) => l.type === 'symbol')?.id;
    if (!firstSymbolId) return;
    for (const layer of layers) {
        if (isBoundaryLine(layer)) {
            try { map.moveLayer(layer.id, firstSymbolId); } catch { /* تجاهل */ }
        }
    }
}

/**
 * يضيف تظليلاً تضاريسياً (hillshade) من نموذج ارتفاعات مجاني (AWS Terrain Tiles, terrarium)
 * أسفل طبقة الطقس مباشرةً — فتظهر ملامح الجبال/الأودية/السواحل من تحت الطبقة شبه الشفّافة
 * (ملمس Zoom Earth). يُدرَج قبل أوّل حدّ إداري فتبقى الطبقة فوقه والحدود فوق الجميع.
 */
export function addHillshadeTerrain(map: MaplibreMap, darkMode = false): void {
    if (!map.getSource('weather-dem')) {
        map.addSource('weather-dem', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 14,
            attribution: 'Terrain: AWS Open Data',
        });
    }
    if (!map.getLayer('weather-hillshade')) {
        // ألوان مبدئية بسيطة فقط — تُستبدَل فوراً بـ applyHillshadeTheme أدناه
        // (نفس الألوان المستخدمة عند تبديل الثيم) لتجنّب ازدواج تعريف الألوان
        // وتفادي سباق كانت فيه الألوان الأولية شبه سوداء على أسود (تضاريس غير مرئية).
        map.addLayer({
            id: 'weather-hillshade',
            type: 'hillshade',
            source: 'weather-dem',
            paint: {},
        }, getWeatherInsertBeforeId(map));
    }
    applyHillshadeTheme(map, darkMode);
}

/** يُحدّث ألوان التضاريس عند تغيير الثيم دون الحاجة لإعادة إنشاء الطبقة. */
export function applyHillshadeTheme(map: MaplibreMap, darkMode: boolean): void {
    if (!map.getLayer('weather-hillshade')) return;
    const set = (prop: string, val: unknown) => {
        try { map.setPaintProperty('weather-hillshade', prop, val as never); } catch { /* تجاهل */ }
    };
    // Zoom Earth: القاعدة الفاتحة (حرارة) مسطّحة تماماً بلا تضاريس فتظهر فستقية نقيّة؛
    // التضاريس الخفيفة للقواعد الداكنة فقط (رياح/أمطار). إخفاؤها يمنع الميل الرمادي/الموحل.
    try { map.setLayoutProperty('weather-hillshade', 'visibility', darkMode ? 'visible' : 'none'); } catch { /* تجاهل */ }
    if (!darkMode) return;
    set('hillshade-exaggeration',    0.40);
    set('hillshade-shadow-color',    'rgba(0,0,0,0.45)');
    set('hillshade-highlight-color', 'rgba(120,140,180,0.25)');
    set('hillshade-accent-color',    'rgba(30,50,90,0.20)');
}

/**
 * يضبط ألوان الخريطة الأساسية لتناسب عرض الطقس (كـ Zoom Earth):
 * - light → خلفية فستقية فاتحة وماء أزرق فاتح. - dark → درجات داكنة هادئة.
 * بعد إدراج طبقة الطقس أسفل **كل** طبقات الخريطة (راجع getWeatherInsertBeforeId)،
 * تصبح مضلّعات اليابسة/الماء/المباني فوق الطقس فتغطّيه كلياً لو بقيت معتمة — لذا
 * تُخفَّض شفافيتها هنا (fill-opacity) فتظهر ألوان الطقس من تحتها مع بقاء الخطوط
 * (طرق/حدود/سواحل) والتسميات معتمة وواضحة فوق الجميع.
 * تعمل عبر setPaintProperty على طبقات الأرض/الماء/المباني الشائعة (آمنة: تتجاهل المفقود).
 */
export function styleWeatherBase(map: MaplibreMap, darkMode: boolean, activeLayer?: string | null): void {
    // نتحقّق من وجود الطبقة فعلياً قبل التلوين — أنماط مختلفة (CARTO وغيرها) تسمّي
    // طبقات اليابسة/الماء بأسماء مختلفة، وSetPaintProperty على طبقة غير موجودة
    // لا يرمي خطأً بل يُصدر حدث 'error' يُسجَّل في الكونسول (ضوضاء بلا فائدة).
    const set = (id: string, prop: string, val: unknown) => {
        if (!map.getLayer(id)) return;
        try { map.setPaintProperty(id, prop, val as never); } catch { /* تجاهل */ }
    };
    // الوضع الفاتح: قاعدة فستقية (sage) مطابقة لـ Zoom Earth. ألوان الحرارة شبه الشفّافة
    // تمتزج فوق هذه القاعدة فتظهر غنيّة ودقيقة (فوق الأبيض كانت تبهت). الماء بأزرق فاتح خفيف.
    // قاعدة فستقية مُوحَّدة (يابسة + بحر + خلفية) في الوضع الفاتح كـ Zoom Earth — فحيث لم
    // تصل بلاطات الحرارة بعد، تبقى الخريطة فستقية لا زرقاء/داكنة. الداكن للرياح/الأمطار.
    // القاعدة الفاتحة فستقية افتراضياً؛ لطبقة الضغط رمادي فاتح محايد.
    const lightTone = activeLayer === 'pressure' ? '#e8e6e2' : '#cedb9c';
    // طبقتا الرياح/الهبّات على قاعدة داكنة لكن بلون أزرق بنفسجي (بدل الأسود) لإبراز الجسيمات.
    const isWindBase = activeLayer === 'wind' || activeLayer === 'wind-gusts';
    const windTone = '#514aa8';
    const darkLand  = isWindBase ? windTone : '#20242a';
    const darkWater = isWindBase ? windTone : '#161b22';
    const darkBg    = isWindBase ? windTone : '#0e1116';
    const land  = darkMode ? darkLand  : lightTone;
    const water = darkMode ? darkWater : lightTone;
    const bg    = darkMode ? darkBg    : lightTone;

    set('background', 'background-color', bg);
    // ملاحظة مهمة (مطابقة Zoom Earth): طبقة الطقس مُدرَجة أسفل مضلّعات اليابسة/الماء.
    // لو بقيت هذه المضلّعات معتمة (ولو جزئياً) فإنها تكتم لون الطقس من تحتها — وأوضحها
    // مضلّع الماء فوق المحيطات، فيظهر البحر "شبه فارغ" بينما تظهر اليابسة ملوّنة.
    // الحلّ: نجعلها شفّافة تماماً فيغطّي حقل الطقس البرّ والبحر بالتساوي، ويبقى خطّ
    // الساحل (continent-coastline) والحدود والتسميات فوقه كخطوط واضحة.
    for (const l of ['landcover', 'landuse', 'landuse_residential', 'landcover_wood',
                     'landcover_grass', 'park', 'park_national_park', 'park_nature_reserve',
                     'national_park', 'wood', 'grass', 'globallandcover']) {
        set(l, 'fill-color', land);
        // شفافية منخفضة: القاعدة الفستقية تأتي أساساً من الخلفية تحت الطقس، وهذه الطبقة
        // فوق الطقس فنُبقيها خفيفة جداً كي لا تكسو ألوان الحرارة بميلٍ أخضر على اليابسة.
        set(l, 'fill-opacity', 0.10);
    }
    for (const l of ['water', 'water_shadow', 'ocean']) {
        set(l, 'fill-color', water);
        set(l, 'fill-opacity', 0.12); // لمسة خفيفة تميّز البحر بصرياً دون كتم لون الطقس
    }
    for (const l of ['building', 'building-top']) {
        set(l, 'fill-opacity', 0.5);
    }
}

/**
 * يرسم خطّ سواحل القارات (حافة اليابسة حيث تلتقي بالبحر) كخطّ واضح فوق الطبقة،
 * فيظهر شكل كل قارة/يابسة بوضوح. يُبنى من حدود مضلّعات الماء في الخريطة الأساسية.
 */
export function addContinentCoastline(map: MaplibreMap, darkMode: boolean): void {
    const layers = map.getStyle()?.layers ?? [];
    const coastColor = darkMode ? 'rgba(255, 255, 255, 1)' : 'rgb(0, 0, 0,1)';

    if (map.getLayer('continent-coastline')) {
        try { map.setPaintProperty('continent-coastline', 'line-color', coastColor); } catch { /* تجاهل */ }
        return;
    }

    // نأخذ مصدر/طبقة الماء من أول طبقة ماء موجودة لرسم حدودها كخطّ ساحل.
    const waterFill = layers.find((l) =>
        l.type === 'fill' && (l.id === 'water' || /(^|[_-])water([_-]|$)|ocean/i.test(l.id))
    ) as ({ source?: string; 'source-layer'?: string } | undefined);
    if (!waterFill || !waterFill.source) return;

    const beforeId = layers.find((l) => l.type === 'symbol')?.id; // فوق الطقس والحدود، تحت التسميات
    try {
        map.addLayer({
            id: 'continent-coastline',
            type: 'line',
            source: waterFill.source,
            'source-layer': waterFill['source-layer'],
            paint: {
                'line-color': coastColor,
                'line-opacity': 1,
                'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 4, 1.1, 8, 2.0],
            },
        } as never, beforeId);
    } catch { /* تجاهل */ }
}

/**
 * يُخفي كل تسميات الخريطة الأساسية الإنجليزية (طبقات الرموز النصية).
 * الموقع عربي بالكامل، والتسميات العربية تأتي من overlay مخصّص (ArabicCityLabels).
 */
export function hideBaseMapLabels(map: MaplibreMap): void {
    const layers = map.getStyle()?.layers ?? [];
    for (const layer of layers) {
        if (layer.type === 'symbol') {
            try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch { /* تجاهل */ }
        }
    }
}

/**
 * يُلوّن كل الحدود الإدارية (دول/ولايات/محافظات) حسب الثيم لتكون واضحة فوق الطبقة:
 * - light → أسود.  - dark → أبيض شفّاف مناسب.
 * حدود الدول أثخن وأوضح من الحدود الداخلية.
 */
export function styleAdminBorders(map: MaplibreMap, darkMode: boolean): void {
    const layers = map.getStyle()?.layers ?? [];
    for (const layer of layers) {
        if (!isBoundaryLine(layer)) continue;
        const isCountry = /country/i.test(layer.id);
        // حدود الدول: أسود (نهاري) / أبيض (داكن) — بارزة. الحدود الداخلية: رمادي أغمق/أفتح.
        const color = isCountry
            ? (darkMode ? 'rgba(235,238,242,0.9)' : 'rgba(0,0,0,0.88)')
            : (darkMode ? 'rgba(200,205,212,0.7)' : 'rgba(35,38,46,0.7)');
        // خطوط شعرية رفيعة جداً (كـ Zoom Earth)
        const width = isCountry
            ? ['interpolate', ['linear'], ['zoom'], 2, 0.3, 5, 0.6, 9, 1.0]
            : ['interpolate', ['linear'], ['zoom'], 2, 0.2, 5, 0.35, 9, 0.6];
        try {
            map.setLayoutProperty(layer.id, 'visibility', 'visible');
            map.setLayerZoomRange(layer.id, 0, 24);            // أظهر الحدود الداخلية في كل الزوومات
            map.setPaintProperty(layer.id, 'line-color', color);
            map.setPaintProperty(layer.id, 'line-opacity', 1);
            map.setPaintProperty(layer.id, 'line-width', width);
            map.setPaintProperty(layer.id, 'line-blur', 0);
        } catch { /* تجاهل */ }
    }
}

/**
 * يُعيد id أوّل طبقة يجب أن تبقى فوق طبقة الطقس — أوّل طبقة بعد الخلفية مباشرةً
 * (landcover عادةً). بهذا تُدرَج طبقة الطقس أسفل **كل** تفاصيل الخريطة الأساسية
 * (مياه/غابات/مبانٍ/طرق/حدود/تسميات)، فتظهر هذه التفاصيل فوق الألوان كخطوط ومضلّعات
 * شبه شفّافة (راجع styleWeatherBase) — بدل أن تغطّيها الطبقة كلياً.
 * يُعيد undefined إن لم توجد طبقات (فتُضاف طبقة الطقس على القمّة).
 */
export function getWeatherInsertBeforeId(map: MaplibreMap): string | undefined {
    const layers = map.getStyle()?.layers ?? [];
    const candidate = layers.find((l) => l.id !== 'background');
    return candidate?.id;
}
