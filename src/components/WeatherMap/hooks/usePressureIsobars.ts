/**
 * usePressureIsobars.ts
 * يبني خطوط تساوي الضغط (isobars) من نسيج الضغط العالمي (PNG) عبر خوارزمية Marching Squares،
 * ويُخرجها كـ GeoJSON (LineString لكل قطعة) ليرسمها MapLibre. مجاناً وبلا Open-Meteo.
 *
 * النسيج رمادي مُطبّع: pressure = 955 + (R/255)*(1050-955) — مطابق VALUE_RANGES['pressure'].
 */
import { useEffect, useState } from 'react';
import type { FeatureCollection, LineString } from 'geojson';

const W = 360;          // دقّة الشبكة لاستخراج الكنتور (الضغط حقل ناعم فتكفي)
const H = 181;
const P_MIN = 955;
const P_MAX = 1050;
const STEP = 4;         // فاصل خطوط الضغط (هكتوباسكال)
const LEVELS: number[] = [];
for (let l = 960; l <= 1044; l += STEP) LEVELS.push(l);

function lonOf(c: number) { return -180 + (c / (W - 1)) * 360; }
function latOf(r: number) { return -90 + (r / (H - 1)) * 180; }   // الصفّ 0 = الجنوب (مثل نسيج الرياح)

/** نقطة تقاطع خطّية على ضلع بين قيمتين عند مستوى level. */
function lerp(a: number, b: number, level: number) {
    if (a === b) return 0.5;
    return (level - a) / (b - a);
}

function buildIsobars(grid: Float32Array): FeatureCollection {
    const features: GeoJSON.Feature<LineString>[] = [];
    const at = (r: number, c: number) => grid[r * W + c];

    for (const level of LEVELS) {
        for (let r = 0; r < H - 1; r++) {
            for (let c = 0; c < W - 1; c++) {
                const tl = at(r + 1, c), tr = at(r + 1, c + 1);
                const bl = at(r, c), br = at(r, c + 1);
                if (!isFinite(tl) || !isFinite(tr) || !isFinite(bl) || !isFinite(br)) continue;

                // فهرس الحالة (4 أركان: أيّها أعلى من level)
                let idx = 0;
                if (bl > level) idx |= 1;
                if (br > level) idx |= 2;
                if (tr > level) idx |= 4;
                if (tl > level) idx |= 8;
                if (idx === 0 || idx === 15) continue;

                // نقاط التقاطع على الأضلاع الأربعة (إحداثيات جغرافية)
                const lon0 = lonOf(c), lon1 = lonOf(c + 1);
                const lat0 = latOf(r), lat1 = latOf(r + 1);
                const bottom = (): [number, number] => [lon0 + (lon1 - lon0) * lerp(bl, br, level), lat0];
                const top    = (): [number, number] => [lon0 + (lon1 - lon0) * lerp(tl, tr, level), lat1];
                const left   = (): [number, number] => [lon0, lat0 + (lat1 - lat0) * lerp(bl, tl, level)];
                const right  = (): [number, number] => [lon1, lat0 + (lat1 - lat0) * lerp(br, tr, level)];

                const seg = (a: [number, number], b: [number, number]) =>
                    features.push({
                        type: 'Feature',
                        properties: { level },
                        geometry: { type: 'LineString', coordinates: [a, b] },
                    });

                // جداول Marching Squares (الحالات المتماثلة تعطي نفس القطع)
                switch (idx) {
                    case 1: case 14: seg(left(), bottom()); break;
                    case 2: case 13: seg(bottom(), right()); break;
                    case 3: case 12: seg(left(), right()); break;
                    case 4: case 11: seg(top(), right()); break;
                    case 5:          seg(left(), top()); seg(bottom(), right()); break;
                    case 6: case 9:  seg(bottom(), top()); break;
                    case 7: case 8:  seg(left(), top()); break;
                    case 10:         seg(left(), bottom()); seg(top(), right()); break;
                }
            }
        }
    }
    return { type: 'FeatureCollection', features };
}

export function usePressureIsobars(timeIndex: number, dir: string, enabled: boolean): FeatureCollection | null {
    const [data, setData] = useState<FeatureCollection | null>(null);

    useEffect(() => {
        if (!enabled) { setData(null); return; }
        let cancelled = false;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (cancelled) return;
            const cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, W, H);
            const px = ctx.getImageData(0, 0, W, H).data;
            const grid = new Float32Array(W * H);
            for (let r = 0; r < H; r++) {
                // صفّ الصورة 0 = أعلى = الجنوب (النسيج مقلوب) → نطابق latOf(0)=-90
                for (let c = 0; c < W; c++) {
                    const i = (r * W + c) * 4;
                    grid[r * W + c] = P_MIN + (px[i] / 255) * (P_MAX - P_MIN);
                }
            }
            setData(buildIsobars(grid));
        };
        img.onerror = () => { /* الساعة غير مولَّدة — نُبقي آخر نتيجة */ };
        img.src = `${import.meta.env.BASE_URL}${dir}pressure_${String(timeIndex).padStart(3, '0')}.png`;
        return () => { cancelled = true; };
    }, [timeIndex, dir, enabled]);

    return data;
}
