/**
 * useWindRaster.ts
 * يحمّل نسيج الرياح العالمي (GFS GRIB2 → PNG: R=السرعة، G=U، B=V) ويفكّه إلى شبكة رياح
 * (WeatherGrid مع u/v بـ km/h) يستهلكها نظام الجسيمات وطبقة لون الرياح — مجاناً وبلا Open-Meteo.
 *
 * يُصغَّر إلى شبكة 1° (360×181) كافية لحقل تدفّق سلس؛ يتغيّر مع الشريط الزمني (لكل ساعة نسيج).
 */

import { useEffect, useState } from 'react';
import type { WeatherGrid, GridPoint } from '../../../services/weatherGridService';

const UV_MAX = 60;          // يطابق WIND_UV_MAX في weatherTextures.ts / السكربت
const GRID_W = 360;
const GRID_H = 181;

export function useWindRaster(timeIndex: number, dir = 'rasters/'): WeatherGrid | null {
    const [grid, setGrid] = useState<WeatherGrid | null>(null);

    useEffect(() => {
        let cancelled = false;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (cancelled) return;
            const cv = document.createElement('canvas');
            cv.width = GRID_W; cv.height = GRID_H;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, GRID_W, GRID_H);   // تصغير تلقائي بمتوسّط
            const data = ctx.getImageData(0, 0, GRID_W, GRID_H).data;

            // صفّ الصورة 0 = الجنوب (السكربت قلب lat)، وهو ما يطابق points[0] = الجنوب.
            const points: GridPoint[][] = [];
            for (let r = 0; r < GRID_H; r++) {
                const lat = -90 + (r / (GRID_H - 1)) * 180;
                const row: GridPoint[] = [];
                for (let c = 0; c < GRID_W; c++) {
                    const i = (r * GRID_W + c) * 4;
                    const u = ((data[i + 1] / 255) * 2 - 1) * UV_MAX;   // km/h
                    const v = ((data[i + 2] / 255) * 2 - 1) * UV_MAX;
                    const lon = -180 + (c / (GRID_W - 1)) * 360;
                    const speed = Math.sqrt(u * u + v * v);
                    row.push({ lat, lon, u, v, speed, value: speed,
                        direction: (270 - Math.atan2(v, u) * 180 / Math.PI + 360) % 360 });
                }
                points.push(row);
            }
            setGrid({
                bounds: { north: 90, south: -90, east: 180, west: -180 },
                rows: GRID_H, cols: GRID_W, points,
                timestamp: '', type: 'wind', source: 'gfs-raster', unit: 'km/h',
            });
        };
        img.onerror = () => { /* الساعة غير مولَّدة — نُبقي آخر شبكة */ };
        img.src = `${import.meta.env.BASE_URL}${dir}wind_${String(timeIndex).padStart(3, '0')}.png`;
        return () => { cancelled = true; };
    }, [timeIndex, dir]);

    return grid;
}
