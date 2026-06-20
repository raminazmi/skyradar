/**
 * gridBounds.ts
 * دوال هندسة حدود شبكة الطقس: الحشوة، التثبيت على خطوات (snap)، ودقّة العرض.
 * تُبقي الحدود مستقرة عند التحريك/التكبير الطفيف فيُعاد استخدام الكاش بلا وميض.
 */

import { weatherGridService, type WeatherGrid } from '../../../services/weatherGridService';

export type GridBounds = { north: number; south: number; east: number; west: number };

/** حدود الشبكة = منطقة العرض + حشوة نسبية، فتغطّي ما وراء حواف الشاشة. */
export function padGridBounds(bounds: GridBounds, ratio: number): GridBounds {
    const latSpan = Math.max(1, Math.abs(bounds.north - bounds.south));
    const lonSpan = Math.max(1, Math.abs(bounds.east - bounds.west));
    return {
        north: Math.min(90, bounds.north + latSpan * ratio),
        south: Math.max(-90, bounds.south - latSpan * ratio),
        east:  bounds.east + lonSpan * ratio,
        west:  bounds.west - lonSpan * ratio,
    };
}

/** خطوة التثبيت حسب اتّساع المنطقة — أكبر للمناطق الواسعة. */
export function getGridSnapStep(bounds: GridBounds): number {
    const span = Math.max(Math.abs(bounds.north - bounds.south), Math.abs(bounds.east - bounds.west));
    if (span >= 160) return 10;
    if (span >= 80)  return 5;
    if (span >= 35)  return 2;
    if (span >= 14)  return 1;
    return 0.5;
}

/** حدود مستقرة: حشوة 60% ثم تثبيت على خطوات؛ تتحوّل لعالمية عند الاتّساع الكبير. */
export function getStableGridBounds(view: GridBounds): GridBounds {
    const padded  = padGridBounds(view, 0.6);
    const latSpan = Math.abs(padded.north - padded.south);
    const lonSpan = Math.abs(padded.east  - padded.west);
    if (lonSpan >= 250 || latSpan >= 130) {
        return { north: 90, south: -90, east: 180, west: -180 };
    }
    const step = getGridSnapStep(padded);
    return {
        north: Math.min(90,  Math.ceil(padded.north  / step) * step),
        south: Math.max(-90, Math.floor(padded.south / step) * step),
        east:  Math.ceil(padded.east  / step) * step,
        west:  Math.floor(padded.west / step) * step,
    };
}

/** دقّة الشبكة المطلوبة محدودة باتّساع المنطقة (تقليل الطلبات للمناطق الواسعة). */
export function getForecastGridResolution(bounds: GridBounds, requested: number): number {
    const span = Math.max(
        Math.abs(bounds.north - bounds.south),
        Math.abs(bounds.east  - bounds.west)
    );
    if (span >= 90) return Math.min(requested, 16);
    if (span >= 45) return Math.min(requested, 18);
    return Math.min(requested, 20);
}

/** يختار أوّل شبكة من مصدر حيّ فعلي من بين المرشّحات. */
export function chooseDisplayGrid(...candidates: Array<WeatherGrid | null>): WeatherGrid | null {
    return candidates.find(g => weatherGridService.isLiveProviderGrid(g)) ?? null;
}
