/**
 * layerAnimation.ts
 * إعدادات عرض وحركة كل طبقة — الحقيقة الوحيدة لمنطق الحركة
 */

import type { LayerKey } from '../store/weatherStore';
import type { ForecastGridType } from './weatherLayers';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LayerDisplayKind = 'heatmap' | 'raster-loop' | 'markers' | 'tracks';

/**
 * نوع الحركة فوق الطبقة:
 * - 'none'           → لا حركة
 * - 'wind-vector'    → جسيمات تتبع U/V مباشرة (طبقة الرياح)
 * - 'precip-fall'    → جسيمات تسقط رأسياً (المطر)
 * - 'wind-advection' → جسيمات تتبع حقل الرياح فوق طبقة scalar (اختياري)
 * - 'raster-loop'    → حلقة صور زمنية (رادار/قمر صناعي)
 * - 'pulse'          → نبضات (أعاصير/حرائق)
 */
export type LayerMotionKind =
    | 'none'
    | 'wind-vector'
    | 'precip-fall'
    | 'wind-advection'
    | 'raster-loop'
    | 'pulse';

export type AnimationQuality = 'low' | 'medium' | 'high';

/** إعدادات حركة الجسيمات القابلة للتخصيص من المستخدم */
export interface LayerAnimationSettings {
    particlesEnabled: boolean;
    density: number;         // 0-1
    speed: number;           // 0-1
    trail: number;           // 0-1  (0=قصير، 1=طويل)
    opacity: number;         // 0-1
    quality: AnimationQuality;
    reduceMotion: boolean;
}

/** وصف عرض وحركة الطبقة (ثابت لكل طبقة) */
export interface LayerPresentationConfig {
    display: LayerDisplayKind;
    motion: LayerMotionKind;
    /** هل تحتاج الحركة إلى wind grid خارجي (advection)؟ */
    requiresWindGrid: boolean;
    /** هل الجسيمات مفعّلة افتراضياً؟ */
    defaultParticles: boolean;
    /** مضاعف سرعة الحركة الخاص بالطبقة (للـadvection layers) */
    advectionSpeed: number;
    /** وصف عربي للحركة يُعرض في واجهة المستخدم */
    motionDescription: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

/**
 * طبقة scalar بدون حركة افتراضية، لكن مع خيار advection اختياري
 */
// مطابقة Zoom Earth: كل الطبقات العددية (حرارة/أمطار/ضغط/…) تعرض جسيمات الرياح البيضاء
// فوق الحقل اللوني افتراضياً. تبقى قابلة للإطفاء يدوياً من الإعدادات لكل طبقة.
function scalarLayer(advectionSpeed = 0.38, desc: string, defaultParticles = true): LayerPresentationConfig {
    return {
        display: 'heatmap',
        motion: 'wind-advection',
        requiresWindGrid: true,
        defaultParticles,
        advectionSpeed,
        motionDescription: desc,
    };
}

// ─── Layer presentation config ───────────────────────────────────────────────

export const LAYER_PRESENTATION: Record<LayerKey, LayerPresentationConfig> = {
    // ── Vector layers ──────────────────────────────────────────────────────
    wind: {
        display: 'heatmap',
        motion: 'wind-vector',
        requiresWindGrid: false,   // هي نفسها تملك U/V
        defaultParticles: true,
        advectionSpeed: 1.0,
        motionDescription: 'جسيمات تتبع اتجاه وسرعة الرياح الفعلية — اللون يعكس السرعة.',
    },

    // ── Scalar with optional advection ─────────────────────────────────────
    'wind-gusts': scalarLayer(
        1.0,
        'ألوان الهبّات تمثل الشدة — جسيمات الرياح البيضاء تتبع حقل الرياح الفعلي (Zoom Earth style).'
    ),
    // ── Zoom Earth style: كل الطبقات Scalar تعرض جسيمات الرياح البيضاء فوق الخريطة ──
    // لا سقوط رأسي للمطر — بل جسيمات الرياح تنساب فوق خلايا الهطول
    precipitation: scalarLayer(
        1.0,
        'خلايا الهطول ملونة — جسيمات الرياح البيضاء تنساب فوقها بنفس سرعة الرياح الفعلية.'
    ),
    temperature: scalarLayer(1.0, 'خريطة الحرارة — جسيمات الرياح البيضاء تظهر فوقها توضيحاً لحركة الرياح.'),
    'feels-like': scalarLayer(1.0, 'الإحساس الحراري — جسيمات الرياح البيضاء تظهر فوق الخريطة.'),
    'wet-bulb': scalarLayer(1.0, 'درجة اللمبة الرطبة — جسيمات الرياح البيضاء تظهر فوق الخريطة.'),
    pressure: scalarLayer(
        1.0,
        'الضغط الجوي — جسيمات الرياح تتبع خطوط الضغط المتساوية بشكل طبيعي.'
    ),
    humidity: scalarLayer(1.0, 'الرطوبة — جسيمات الرياح البيضاء فوق الخريطة.'),
    dewpoint: scalarLayer(1.0, 'نقطة الندى — جسيمات الرياح البيضاء فوق الخريطة.'),
    clouds: scalarLayer(
        1.0,
        'الغيوم — جسيمات الرياح البيضاء تنساب فوق خريطة الغيوم.'
    ),

    // ── Tile / raster layers ───────────────────────────────────────────────
    radar: {
        display: 'raster-loop',
        motion: 'raster-loop',
        requiresWindGrid: false,
        defaultParticles: false,
        advectionSpeed: 0,
        motionDescription: 'رادار زمني بإطارات صور متتالية — لا جسيمات.',
    },
    satellite: {
        display: 'raster-loop',
        motion: 'raster-loop',
        requiresWindGrid: false,
        defaultParticles: false,
        advectionSpeed: 0,
        motionDescription: 'صور قمر صناعي — لا جسيمات، عرض مستمر.',
    },

    // ── Point overlays ─────────────────────────────────────────────────────
    hurricanes: {
        display: 'tracks',
        motion: 'pulse',
        requiresWindGrid: false,
        defaultParticles: false,
        advectionSpeed: 0,
        motionDescription: 'مسارات الأعاصير مع نبضات مرئية — لا جسيمات عامة.',
    },
    wildfires: {
        display: 'markers',
        motion: 'pulse',
        requiresWindGrid: false,
        defaultParticles: false,
        advectionSpeed: 0,
        motionDescription: 'نقاط الحرائق مع توهج نابض — لا جسيمات عامة.',
    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * هل تدعم هذه الطبقة الجسيمات بأي شكل؟
 */
export function supportsParticles(layer: LayerKey): boolean {
    const motion = LAYER_PRESENTATION[layer].motion;
    return motion === 'wind-vector' || motion === 'precip-fall' || motion === 'wind-advection';
}

/**
 * هل يجب إظهار الجسيمات الآن (مع مراعاة الإعدادات والبيانات المتاحة)?
 */
export function shouldRenderParticles(
    layer: LayerKey,
    settings: LayerAnimationSettings,
    hasWindGrid: boolean
): boolean {
    if (!settings.particlesEnabled) return false;
    if (settings.reduceMotion) return false;

    const config = LAYER_PRESENTATION[layer];
    if (!supportsParticles(layer)) return false;

    // طبقات advection تحتاج wind grid — إذا غاب لا حركة
    if (config.requiresWindGrid && !hasWindGrid) return false;

    return true;
}

/**
 * حساب keepAlpha لتأثير الذيل بناءً على إعداد trail
 * trail=0 → ذيل قصير (keepAlpha منخفض) ← تلاشي سريع
 * trail=1 → ذيل طويل (keepAlpha عالٍ) ← يبقى طويلاً
 */
export function computeTrailAlpha(trail: number): number {
    // Zoom Earth الحقيقي يعرض ذيولاً قصيرة (شبه فاصلة/dash)، لا خطوطاً طويلة منسدلة.
    return 0.55 + trail * 0.4;
}

/**
 * الإعدادات الافتراضية لكل طبقة
 */
export function createDefaultLayerAnimationSettings(): Record<LayerKey, LayerAnimationSettings> {
    return Object.fromEntries(
        Object.entries(LAYER_PRESENTATION).map(([layer, config]) => [
            layer,
            {
                particlesEnabled: config.defaultParticles,
                density: 0.6,       // كثافة متوسطة — متباعدة بانتظام كما في Zoom Earth
                speed: 0.85,        // سرعة الحركة
                trail: 0.35,        // ذيول قصيرة (شبه فاصلة) كما في Zoom Earth الحقيقي
                opacity: 0.85,      // سطوع الجسيمات
                quality: 'high' as AnimationQuality,
                reduceMotion: false,
            },
        ])
    ) as Record<LayerKey, LayerAnimationSettings>;
}

/**
 * Type guard — هل الطبقة من نوع forecast grid؟
 */
export function isForecastLayer(layer: LayerKey): layer is ForecastGridType {
    return !['radar', 'satellite', 'hurricanes', 'wildfires'].includes(layer);
}
