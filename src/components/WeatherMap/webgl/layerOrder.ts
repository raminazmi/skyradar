/**
 * layerOrder.ts
 * يحدّد موضع إدراج طبقات الطقس في مكدّس MapLibre بحيث تظهر **أسفل** حدود الدول
 * والتسميات (مثل Zoom Earth) بدل تغطيتها — فتبقى الحدود وأسماء المدن واضحة فوق الطبقة.
 */

import type { Map as MaplibreMap } from 'maplibre-gl';

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
    set('hillshade-exaggeration',    darkMode ? 0.85 : 0.90);
    set('hillshade-shadow-color',    darkMode ? 'rgba(0,0,0,0.95)'       : 'rgba(60,40,10,0.85)');
    set('hillshade-highlight-color', darkMode ? 'rgba(120,140,180,0.55)' : 'rgba(255,248,220,0.80)');
    set('hillshade-accent-color',    darkMode ? 'rgba(30,50,90,0.45)'    : 'rgba(180,130,60,0.40)');
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
export function styleWeatherBase(map: MaplibreMap, darkMode: boolean): void {
    // نتحقّق من وجود الطبقة فعلياً قبل التلوين — أنماط مختلفة (CARTO وغيرها) تسمّي
    // طبقات اليابسة/الماء بأسماء مختلفة، وSetPaintProperty على طبقة غير موجودة
    // لا يرمي خطأً بل يُصدر حدث 'error' يُسجَّل في الكونسول (ضوضاء بلا فائدة).
    const set = (id: string, prop: string, val: unknown) => {
        if (!map.getLayer(id)) return;
        try { map.setPaintProperty(id, prop, val as never); } catch { /* تجاهل */ }
    };
    // الوضع الفاتح: قاعدة بيضاء (بدل الفستقي/الرمادي الذي كان يكسو ألوان الطقس بميلٍ رمادي)
    // فتظهر ألوان الطقس نقيّة وزاهية كما في Zoom Earth. الماء بأزرق فاتح جداً لتمييز البحر فقط.
    const land  = darkMode ? '#20242a' : '#ffffff';
    const water = darkMode ? '#161b22' : '#dbe9f6';
    const bg    = darkMode ? '#0e1116' : '#ffffff';

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
        set(l, 'fill-opacity', 0.35); // تفاصيل اليابسة (غطاء أرضي/حدائق) تبقى ظاهرة تحت الطقس
    }
    for (const l of ['water', 'water_shadow', 'ocean']) {
        set(l, 'fill-color', water);
        set(l, 'fill-opacity', 0.30); // لمسة خفيفة تميّز البحر بصرياً دون كتم لون الطقس
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
        // عرض أعرض ويتدرّج مع الزووم ليبقى واضحاً
        const width = isCountry
            ? ['interpolate', ['linear'], ['zoom'], 2, 1.4, 5, 2.2, 9, 3.4]
            : ['interpolate', ['linear'], ['zoom'], 2, 0.7, 5, 1.2, 9, 2.2];
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
