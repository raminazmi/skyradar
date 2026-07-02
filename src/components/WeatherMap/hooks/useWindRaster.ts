/**
 * useWindRaster.ts
 * يحمّل نسيج الرياح العالمي (GFS GRIB2 → PNG: R=السرعة، G=U، B=V) ويفكّه إلى شبكة رياح
 * (WeatherGrid مع u/v بـ km/h) يستهلكها نظام الجسيمات وطبقة لون الرياح — مجاناً وبلا Open-Meteo.
 *
 * يُصغَّر إلى شبكة 1° (360×181) كافية لحقل تدفّق سلس؛ يتغيّر مع الشريط الزمني (لكل ساعة نسيج).
 *
 * الأداء: الشبكة تمثيل مسطّح (Float32Array عبر WeatherGrid.flat) لا مصفوفة 65 ألف كائن —
 * الفكّ على canvas مفرد مُعاد الاستخدام، والمزج الزمني حلقة رقمية بلا أي إنشاء كائنات،
 * مع كاش صغير للإطارات المفكوكة كي لا يتكرّر الفكّ عند الترجيع/إعادة التشغيل.
 */

import { useEffect, useState } from 'react';
import type { WeatherGrid, FlatGridData } from '../../../services/weatherGridService';

const UV_MAX = 60;          // يطابق WIND_UV_MAX في weatherTextures.ts / السكربت
const GRID_W = 360;
const GRID_H = 181;
const N = GRID_W * GRID_H;

// canvas/context مفردان للفكّ (إنشاؤهما لكل إطار كان يترك نفايات GC)
let decodeCanvas: HTMLCanvasElement | null = null;
let decodeCtx: CanvasRenderingContext2D | null = null;
function getDecodeCtx(): CanvasRenderingContext2D | null {
    if (!decodeCtx) {
        decodeCanvas = document.createElement('canvas');
        decodeCanvas.width = GRID_W;
        decodeCanvas.height = GRID_H;
        decodeCtx = decodeCanvas.getContext('2d', { willReadFrequently: true });
    }
    return decodeCtx;
}

// كاش الإطارات المفكوكة (مفتاحه dir+index) — يغطي نافذة التشغيل والترجيع
const FLAT_CACHE_MAX = 12;
const flatCache = new Map<string, FlatGridData>();

function makeGrid(flat: FlatGridData): WeatherGrid {
    return {
        bounds: { north: 90, south: -90, east: 180, west: -180 },
        rows: GRID_H, cols: GRID_W, points: [], flat,
        timestamp: '', type: 'wind', source: 'gfs-raster', unit: 'km/h',
    };
}

export function useWindRaster(timeIndex: number, dir = 'rasters/'): WeatherGrid | null {
    const [grid, setGrid] = useState<WeatherGrid | null>(null);

    useEffect(() => {
        const key = `${dir}${timeIndex}`;
        const cached = flatCache.get(key);
        if (cached) {
            // تحديث ترتيب LRU
            flatCache.delete(key); flatCache.set(key, cached);
            setGrid(makeGrid(cached));
            return;
        }
        let cancelled = false;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (cancelled) return;
            const ctx = getDecodeCtx();
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, GRID_W, GRID_H);   // تصغير تلقائي بمتوسّط
            const data = ctx.getImageData(0, 0, GRID_W, GRID_H).data;

            // صفّ الصورة 0 = الجنوب (السكربت قلب lat)، وهو ما يطابق الصفّ 0 = الجنوب هنا.
            const u = new Float32Array(N);
            const v = new Float32Array(N);
            const value = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                const p = i * 4;
                const uu = ((data[p + 1] / 255) * 2 - 1) * UV_MAX;   // km/h
                const vv = ((data[p + 2] / 255) * 2 - 1) * UV_MAX;
                u[i] = uu; v[i] = vv;
                value[i] = Math.sqrt(uu * uu + vv * vv);
            }
            const flat: FlatGridData = { value, u, v };
            flatCache.set(key, flat);
            if (flatCache.size > FLAT_CACHE_MAX) {
                const oldest = flatCache.keys().next().value;
                if (oldest !== undefined) flatCache.delete(oldest);
            }
            setGrid(makeGrid(flat));
        };
        let retries = 2;
        const src = `${import.meta.env.BASE_URL}${dir}wind_${String(timeIndex).padStart(3, '0')}.png`;
        img.onerror = () => {
            // فشل عابر (قطع HTTP/2 على الاستضافة المشتركة) → إعادة محاولة بمهلة؛
            // وإن نفدت المحاولات (الساعة غير مولَّدة) نُبقي آخر شبكة.
            if (cancelled || retries <= 0) return;
            retries -= 1;
            window.setTimeout(() => { if (!cancelled) img.src = src; }, 1200);
        };
        img.src = src;
        return () => { cancelled = true; };
    }, [timeIndex, dir]);

    return grid;
}

// مخرجا مزج مزدوجان بالتناوب: المستهلكون يقارنون هوية الكائن، فنعطي غلافاً جديداً كل مرّة
// لكن المصفوفات نفسها يُعاد استخدامها (صفر ضغط GC أثناء التشغيل).
const lerpOut: FlatGridData[] = [
    { value: new Float32Array(N), u: new Float32Array(N), v: new Float32Array(N) },
    { value: new Float32Array(N), u: new Float32Array(N), v: new Float32Array(N) },
];
let lerpFlip = 0;

/**
 * يمزج شبكتي رياح (الحالية والتالية) بنسبة t (0..1) — استيفاء زمني ناعم لحقل الرياح.
 * يمزج u/v رقمياً على المصفوفات المسطّحة ثم يشتقّ السرعة (لا مزج للاتجاه تفادياً لالتفاف 360°).
 * يُستدعى بخطوات ~10 دقائق فقط (لا لكل إطار) فيبقى خفيفاً.
 */
export function lerpWindGrid(a: WeatherGrid | null, b: WeatherGrid | null, t: number): WeatherGrid | null {
    if (!a) return b;
    if (!b || t <= 0.0001 || a.rows !== b.rows || a.cols !== b.cols) return a;
    const fa = a.flat, fb = b.flat;
    if (!fa?.u || !fa.v || !fb?.u || !fb.v) return a;
    const out = lerpOut[lerpFlip]; lerpFlip = 1 - lerpFlip;
    const { u: ua, v: va } = fa, { u: ub, v: vb } = fb;
    const { u: uo, v: vo, value } = out as Required<FlatGridData>;
    for (let i = 0; i < N; i++) {
        const uu = ua[i] + (ub[i] - ua[i]) * t;
        const vv = va[i] + (vb[i] - va[i]) * t;
        uo[i] = uu; vo[i] = vv;
        value[i] = Math.sqrt(uu * uu + vv * vv);
    }
    return { ...a, flat: out };
}
