/**
 * weatherTextures.ts
 * تحويل بيانات الطقس إلى بيانات نسيج (textures) للـ GPU.
 *
 * فكرة التطابق اللوني: نبني "شريط ألوان" (color ramp) بحجم 256 بنقل
 * getHeatmapColor الحالي حرفياً عبر مجال القيم — فيخرج WebGL ألواناً
 * مطابقة تماماً لما يرسمه النظام الحالي (نفس مصدر الحقيقة colorScales.ts).
 *
 * الثابت الرياضي: ramp[normalize(v)] === getHeatmapColor(v) لأي v ضمن المجال.
 */

import type { ForecastGridType } from '../../../config/weatherLayers';
import { getHeatmapColor } from '../../../services/colorScales';
import type { WeatherGrid } from '../../../services/weatherGridService';

/**
 * مجال القيم الخام لكل طبقة (بوحدات الشبكة كما تصل من الخادم).
 * يكفي أن يغطّي المجال البيانات الواقعية؛ القيم خارجه تُقصّ لطرفي الشريط
 * (وهو سلوك مطابق لـ getHeatmapColor نفسه عند الأطراف).
 */
export const VALUE_RANGES: Record<ForecastGridType, [number, number]> = {
    'temperature': [-50, 55],
    'feels-like':  [-50, 55],
    'wet-bulb':    [-40, 40],
    'dewpoint':    [-35, 35],
    'wind':        [0, 120],
    'wind-gusts':  [0, 160],
    'precipitation': [0, 50],
    'pressure':    [955, 1050],
    'humidity':    [0, 100],
    'clouds':      [0, 100],
};

const RAMP_SIZE = 256;

/** مدى تطبيع مركّبتي الرياح U/V (km/h) عند ترميزهما في قناتي النسيج. */
export const WIND_UV_MAX = 60;

function parseRgba(color: string | null): [number, number, number, number] {
    if (!color) return [0, 0, 0, 0]; // null → شفاف تماماً (مثل المطر/الغيوم تحت العتبة)
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
    const [r, g, b, a = 1] = parts;
    return [r, g, b, a];
}

/**
 * يبني بيانات شريط الألوان (256×1) RGBA8 لطبقة معيّنة.
 * نخزّنه بألفا مسبق الضرب (premultiplied) لأن MapLibre يخلط بهذا الوضع.
 */
export function buildColorRamp(type: ForecastGridType): Uint8Array {
    const [min, max] = VALUE_RANGES[type];
    const data = new Uint8Array(RAMP_SIZE * 4);
    for (let i = 0; i < RAMP_SIZE; i++) {
        const value = min + ((max - min) * i) / (RAMP_SIZE - 1);
        const [r, g, b, a] = parseRgba(getHeatmapColor(value, type));
        // ألفا مسبق الضرب
        data[i * 4 + 0] = Math.round(r * a);
        data[i * 4 + 1] = Math.round(g * a);
        data[i * 4 + 2] = Math.round(b * a);
        data[i * 4 + 3] = Math.round(a * 255);
    }
    return data;
}

export function normalizeValue(type: ForecastGridType, value: number): number {
    const [min, max] = VALUE_RANGES[type];
    const t = (value - min) / (max - min);
    return Math.max(0, Math.min(1, t));
}

/**
 * يحوّل شبكة قيم إلى نسيج RGBA8:
 *   - R: القيمة المُطبّعة [0..255] (تُستوفى خطّياً على الـ GPU → حقل ناعم)
 *   - G,B: مركّبتا الرياح U/V مُطبّعتان (للجسيمات لاحقاً) — لطبقات غير الرياح تبقى 128 (صفر)
 *   - A: 255 لنقطة صالحة، 0 لمفقودة
 *
 * صفوف الشبكة من الجنوب (row 0) إلى الشمال، وهو ما يطابق إحداثي V=0 عند الجنوب.
 */
export function buildValueTexture(grid: WeatherGrid): {
    data: Uint8Array;
    width: number;
    height: number;
} {
    const { rows, cols, points, type, flat } = grid;
    const data = new Uint8Array(cols * rows * 4);

    // مجال U/V للرياح (km/h تقريباً) لتطبيع المركّبات في القناتين G/B.
    const UV_MAX = WIND_UV_MAX;

    // مسار سريع: الشبكات المسطّحة (الرياح من النسيج المحلّي) — حلقة رقمية بلا كائنات.
    if (flat) {
        const { value, u, v } = flat;
        const [min, max] = VALUE_RANGES[type];
        const span = max - min;
        for (let i = 0; i < rows * cols; i++) {
            const idx = i * 4;
            const val = value[i];
            if (!Number.isFinite(val)) { data[idx + 3] = 0; continue; }
            data[idx + 0] = Math.round(Math.max(0, Math.min(1, (val - min) / span)) * 255);
            if (u && v) {
                data[idx + 1] = Math.round((Math.max(-UV_MAX, Math.min(UV_MAX, u[i])) / UV_MAX * 0.5 + 0.5) * 255);
                data[idx + 2] = Math.round((Math.max(-UV_MAX, Math.min(UV_MAX, v[i])) / UV_MAX * 0.5 + 0.5) * 255);
            } else {
                data[idx + 1] = 128;
                data[idx + 2] = 128;
            }
            data[idx + 3] = 255;
        }
        return { data, width: cols, height: rows };
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = (r * cols + c) * 4;
            const p = points[r]?.[c];
            if (!p || !Number.isFinite(p.value)) {
                data[idx + 3] = 0; // مفقودة
                continue;
            }
            data[idx + 0] = Math.round(normalizeValue(type, p.value) * 255);
            if (p.u !== undefined && p.v !== undefined) {
                data[idx + 1] = Math.round((Math.max(-UV_MAX, Math.min(UV_MAX, p.u)) / UV_MAX * 0.5 + 0.5) * 255);
                data[idx + 2] = Math.round((Math.max(-UV_MAX, Math.min(UV_MAX, p.v)) / UV_MAX * 0.5 + 0.5) * 255);
            } else {
                data[idx + 1] = 128;
                data[idx + 2] = 128;
            }
            data[idx + 3] = 255;
        }
    }

    return { data, width: cols, height: rows };
}
