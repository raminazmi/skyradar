/**
 * weatherTiles.ts
 * حساب بلاطات الطقس (XYZ بإسقاط Web-Mercator) — أساس التحميل "مربّعاً مربّعاً" كـ Zoom Earth.
 *
 * كل بلاطة منطقة جغرافية مستقلّة تُجلَب وتُرسم وتُخزَّن وحدها، فتظهر تدريجياً عند الجلب
 * ويُعاد استخدامها فوراً عند التحريك/التكبير (تخزين لكل بلاطة) → سرعة وسلاسة.
 */

import type { GridBounds } from '../components/WeatherMap/utils/gridBounds';

export interface WeatherTile {
    /** مفتاح ثابت z/x/y (x ملفوف حول الكرة) للتخزين والمطابقة. */
    key: string;
    z: number;
    x: number;
    y: number;
    bounds: GridBounds;
}

/** عدد نقاط العيّنة لكل محور داخل البلاطة الواحدة (بلاطة صغيرة سريعة الجلب). */
export const TILE_RES = 16;

/** أقصى عدد بلاطات تُجلب دفعةً واحدة (حماية من فيض الطلبات عند العرض الواسع). */
const MAX_TILES = 40;

function tile2lon(x: number, z: number): number {
    return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2lat(y: number, z: number): number {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function lon2tileX(lon: number, z: number): number {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tileY(lat: number, z: number): number {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
}

/**
 * مستوى زووم البلاطات للطقس — أخفض من زووم الخريطة قليلاً يكفي (بيانات النموذج خشنة).
 * يوازن بين عدد البلاطات (الطلبات) ودقّة التفاصيل.
 */
export function chooseWeatherZoom(mapZoom: number): number {
    return Math.max(1, Math.min(7, Math.round(mapZoom)));
}

/**
 * يُعيد قائمة البلاطات المرئية ضمن حدود العرض عند زووم البلاطات المختار.
 * يتعامل مع الحدود الواسعة/الملفوفة (world copies، عبور خط التاريخ، west>east) بلا فجوات:
 * عند العرض شبه العالمي يُعدّد كل البلاطات أفقياً فلا يبقى نصف الخريطة بلا تغطية (السبب
 * المرجَّح للخطّ العمودي الذي كان يقسم الخريطة).
 */
export function getVisibleTiles(view: GridBounds, mapZoom: number): WeatherTile[] {
    const z = chooseWeatherZoom(mapZoom);
    const n = Math.pow(2, z);
    const clampLat = (l: number) => Math.max(-85.05, Math.min(85.05, l));
    const yTop = Math.max(0, lat2tileY(clampLat(view.north), z)); // y أصغر = شمال
    const yBot = Math.min(n - 1, lat2tileY(clampLat(view.south), z));

    // نطاق أعمدة البلاطات (x). عرض شبه عالمي → كل الأعمدة؛ وإلّا نطاق ملفوف صحيح.
    const xList: number[] = [];
    const lonSpan = Math.abs(view.east - view.west);
    if (lonSpan >= 350) {
        for (let x = 0; x < n; x++) xList.push(x);
    } else {
        const norm = (l: number) => (((l + 180) % 360) + 360) % 360 - 180;
        const xMin = lon2tileX(norm(view.west), z);
        let xMax = lon2tileX(norm(view.east), z);
        if (xMax < xMin) xMax += n;                 // عبر خط التاريخ
        for (let x = xMin; x <= xMax; x++) xList.push(((x % n) + n) % n);
    }

    const tiles: WeatherTile[] = [];
    for (let y = yTop; y <= yBot; y++) {
        for (const x of xList) {
            tiles.push({
                key: `${z}/${x}/${y}`,
                z, x, y,
                bounds: {
                    west: tile2lon(x, z),
                    east: tile2lon(x + 1, z),
                    north: tile2lat(y, z),
                    south: tile2lat(y + 1, z),
                },
            });
            if (tiles.length >= MAX_TILES) return tiles;
        }
    }
    return tiles;
}
