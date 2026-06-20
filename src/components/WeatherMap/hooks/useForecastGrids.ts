/**
 * useForecastGrids.ts
 * يدير شبكتي الرياح والهيتماب (جلب/كاش/prefetch) حسب الطبقة الفعّالة وحدود الخريطة.
 * يُرجع الشبكات الجاهزة للعرض. مُستخرَج من NewWeatherMap لإبقائه < 300 سطر.
 */

import { useEffect, useRef, useState } from 'react';
import { weatherGridService, type WeatherGrid } from '../../../services/weatherGridService';
import { FORECAST_LAYER_IDS, type ForecastGridType } from '../../../config/weatherLayers';
import { getStableGridBounds, getForecastGridResolution, chooseDisplayGrid, type GridBounds } from '../utils/gridBounds';

interface Params {
    mapBounds: GridBounds | null;
    selectedModel: string;
    currentTimeIndex: number;
    isPlaying: boolean;
    visibleLayers: Record<string, boolean>;
}

interface Result {
    windGrid: WeatherGrid | null;
    heatmapGrid: WeatherGrid | null;
    activeHeatmapType: ForecastGridType | null;
}

export function useForecastGrids({ mapBounds, selectedModel, currentTimeIndex, isPlaying, visibleLayers }: Params): Result {
    const [windGrid, setWindGrid]       = useState<WeatherGrid | null>(null);
    const [heatmapGrid, setHeatmapGrid] = useState<WeatherGrid | null>(null);
    const [activeHeatmapType, setActiveHeatmapType] = useState<ForecastGridType | null>(null);

    const windRequestRef    = useRef(0);
    const heatmapRequestRef = useRef(0);

    const visibleForecastSignature = FORECAST_LAYER_IDS
        .map(layer => `${layer}:${visibleLayers[layer] ? '1' : '0'}`)
        .join('|');
    const activeForecastLayer = FORECAST_LAYER_IDS.find(l => visibleLayers[l]) ?? null;

    // ── شبكة الرياح ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!activeForecastLayer || !mapBounds) {
            windRequestRef.current += 1; setWindGrid(null); return;
        }
        let cancelled = false;
        const id     = ++windRequestRef.current;
        const bounds = getStableGridBounds(mapBounds);
        const qRes   = getForecastGridResolution(bounds, activeForecastLayer === 'wind' ? 28 : 24);

        const cached = chooseDisplayGrid(
            weatherGridService.getCachedGrid('wind', bounds, selectedModel, currentTimeIndex, qRes),
            weatherGridService.getCachedGrid('wind', bounds, selectedModel, currentTimeIndex, 6)
        );
        if (cached) setWindGrid(cached);

        if (isPlaying) return () => { cancelled = true; };

        const timer = window.setTimeout(async () => {
            try {
                const fast = await weatherGridService.generateGrid('wind', bounds, selectedModel, currentTimeIndex, 6);
                if (cancelled || windRequestRef.current !== id) return;
                if (weatherGridService.isLiveProviderGrid(fast)) setWindGrid(fast);

                const qual = await weatherGridService.generateGrid('wind', bounds, selectedModel, currentTimeIndex, qRes);
                if (!cancelled && windRequestRef.current === id && weatherGridService.isLiveProviderGrid(qual)) {
                    setWindGrid(qual);
                    weatherGridService.prefetchGrid('wind', bounds, selectedModel, currentTimeIndex + 1, 6);
                    weatherGridService.prefetchGrid('wind', bounds, selectedModel, currentTimeIndex - 1, 6);
                }
            } catch (e) { console.error('خطأ في شبكة الرياح:', e); }
        }, 200);

        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [activeForecastLayer, mapBounds, selectedModel, currentTimeIndex, isPlaying]);

    // ── شبكة الهيتماب ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapBounds) {
            heatmapRequestRef.current += 1; setHeatmapGrid(null); setActiveHeatmapType(null); return;
        }
        const heatmapTypes = FORECAST_LAYER_IDS.filter(l => l !== 'wind');
        const active = heatmapTypes.find(t => visibleLayers[t]);
        if (!active) {
            heatmapRequestRef.current += 1; setHeatmapGrid(null); setActiveHeatmapType(null); return;
        }
        setActiveHeatmapType(active);
        let cancelled = false;
        const id     = ++heatmapRequestRef.current;
        const bounds = getStableGridBounds(mapBounds);
        const qRes   = getForecastGridResolution(bounds, 28);

        const cached = chooseDisplayGrid(
            weatherGridService.getCachedGrid(active, bounds, selectedModel, currentTimeIndex, qRes),
            weatherGridService.getCachedGrid(active, bounds, selectedModel, currentTimeIndex, 6)
        );
        setHeatmapGrid((previous) => {
            if (cached) return cached;
            return previous?.type === active ? previous : null;
        });

        if (isPlaying) return () => { cancelled = true; };

        const timer = window.setTimeout(async () => {
            try {
                const fast = await weatherGridService.generateGrid(active, bounds, selectedModel, currentTimeIndex, 6);
                if (cancelled || heatmapRequestRef.current !== id) return;
                if (weatherGridService.isLiveProviderGrid(fast)) setHeatmapGrid(fast);

                const qual = await weatherGridService.generateGrid(active, bounds, selectedModel, currentTimeIndex, qRes);
                if (!cancelled && heatmapRequestRef.current === id && weatherGridService.isLiveProviderGrid(qual)) {
                    setHeatmapGrid(qual);
                    weatherGridService.prefetchGrid(active, bounds, selectedModel, currentTimeIndex + 1, 6);
                    weatherGridService.prefetchGrid(active, bounds, selectedModel, currentTimeIndex - 1, 6);
                }
            } catch (e) { console.error('خطأ في شبكة الخريطة الحرارية:', e); }
        }, 200);

        return () => { cancelled = true; window.clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleForecastSignature, mapBounds, selectedModel, currentTimeIndex, isPlaying]);

    return { windGrid, heatmapGrid, activeHeatmapType };
}
