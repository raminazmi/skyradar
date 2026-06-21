/**
 * useHoverTemperatureGrid.ts
 * يجلب شبكة درجة الحرارة لحدود الخريطة الحالية بشكل دائم — بصرف النظر عن الطبقة
 * المعروضة — لتغذية تلميح المرور (hover) بقيمة الحرارة كما في Zoom Earth.
 *
 * خفيف: يعتمد على كاش weatherGridService نفسه (لا طلبات مكرّرة إن كانت الحرارة
 * معروضة أصلاً)، ويستخدم دقّة منخفضة تكفي للقراءة عند المؤشّر.
 */

import { useEffect, useRef, useState } from 'react';
import { weatherGridService, type WeatherGrid } from '../../../services/weatherGridService';
import { getStableGridBounds, getForecastGridResolution, type GridBounds } from '../utils/gridBounds';

interface Params {
    mapBounds: GridBounds | null;
    selectedModel: string;
    currentTimeIndex: number;
}

export function useHoverTemperatureGrid({ mapBounds, selectedModel, currentTimeIndex }: Params): WeatherGrid | null {
    const [grid, setGrid] = useState<WeatherGrid | null>(null);
    const reqRef = useRef(0);

    useEffect(() => {
        if (!mapBounds) { reqRef.current += 1; setGrid(null); return; }
        let cancelled = false;
        const id     = ++reqRef.current;
        const bounds = getStableGridBounds(mapBounds);
        const qRes   = getForecastGridResolution(bounds, 24);

        const cached = weatherGridService.getCachedGrid('temperature', bounds, selectedModel, currentTimeIndex, qRes)
            ?? weatherGridService.getCachedGrid('temperature', bounds, selectedModel, currentTimeIndex, 6);
        if (cached) setGrid(cached);

        const timer = window.setTimeout(async () => {
            try {
                const g = await weatherGridService.generateGrid('temperature', bounds, selectedModel, currentTimeIndex, qRes);
                if (!cancelled && reqRef.current === id) setGrid(g);
            } catch (e) { console.error('خطأ في شبكة حرارة التلميح:', e); }
        }, 250);

        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [mapBounds, selectedModel, currentTimeIndex]);

    return grid;
}
