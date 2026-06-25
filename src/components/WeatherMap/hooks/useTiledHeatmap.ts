/**
 * useTiledHeatmap.ts
 * يجلب بلاطات الطبقة العددية الفعّالة (حرارة/…) كلٌّ على حدة بالتوازي، ويُخزّنها لكل بلاطة،
 * ويُصدر البلاطات الجاهزة تدريجياً (مربّعاً مربّعاً) — جوهر سلوك Zoom Earth.
 *
 * التخزين على مستويين: ذاكرة محلّية (cacheRef) للعرض الفوري عند العودة لبلاطة،
 * وكاش خدمة الشبكة (weatherGridService) المُفهرَس بحدود البلاطة الثابتة.
 */

import { useEffect, useRef, useState } from 'react';
import { weatherGridService, type WeatherGrid } from '../../../services/weatherGridService';
import { getVisibleTiles, TILE_RES } from '../../../services/weatherTiles';
import type { ForecastGridType } from '../../../config/weatherLayers';
import type { GridBounds } from '../utils/gridBounds';
import type { WeatherModelId } from '../../../store/types';

export interface ReadyTile { key: string; grid: WeatherGrid; }

interface Params {
    mapBounds: GridBounds | null;
    mapZoom: number;
    selectedModel: string;
    currentTimeIndex: number;
    activeType: ForecastGridType | null;
}

const MAX_CACHE = 300;

export function useTiledHeatmap({ mapBounds, mapZoom, selectedModel, currentTimeIndex, activeType }: Params): ReadyTile[] {
    const [ready, setReady] = useState<ReadyTile[]>([]);
    const cacheRef = useRef<Map<string, WeatherGrid>>(new Map());
    const reqRef = useRef(0);

    useEffect(() => {
        if (!mapBounds || !activeType) { setReady([]); return; }

        const id = ++reqRef.current;
        const model = selectedModel as WeatherModelId;
        const tiles = getVisibleTiles(mapBounds, mapZoom);
        const dataKey = (tileKey: string) => `${activeType}_${model}_${currentTimeIndex}_${tileKey}`;
        const visibleKeys = new Set(tiles.map((t) => t.key));

        // المرحلة الفورية: اعرض ما هو مخزَّن أصلاً (بلا وميض عند التحريك/العودة).
        const acc = new Map<string, ReadyTile>();
        for (const t of tiles) {
            const dk = dataKey(t.key);
            const cached = cacheRef.current.get(dk)
                ?? weatherGridService.getCachedGrid(activeType, t.bounds, model, currentTimeIndex, TILE_RES);
            if (cached && weatherGridService.isLiveProviderGrid(cached)) {
                cacheRef.current.set(dk, cached);
                acc.set(t.key, { key: t.key, grid: cached });
            }
        }
        setReady(Array.from(acc.values()));

        let cancelled = false;
        const emit = () => {
            if (!cancelled && reqRef.current === id) {
                setReady(Array.from(acc.values()).filter((r) => visibleKeys.has(r.key)));
            }
        };

        // المرحلة التدريجية: اجلب البلاطات الناقصة بالتوازي، وأصدر كلّ واحدة فور وصولها.
        for (const t of tiles) {
            const dk = dataKey(t.key);
            if (cacheRef.current.has(dk)) continue;
            weatherGridService.generateGrid(activeType, t.bounds, model, currentTimeIndex, TILE_RES)
                .then((grid) => {
                    if (cancelled || reqRef.current !== id) return;
                    if (!weatherGridService.isLiveProviderGrid(grid)) return;
                    cacheRef.current.set(dk, grid);
                    pruneCache(cacheRef.current);
                    acc.set(t.key, { key: t.key, grid });
                    emit();
                })
                .catch(() => { /* بلاطة فشلت — تبقى فارغة وتُعاد محاولتها عند التحريك التالي */ });
        }

        return () => { cancelled = true; };
    }, [mapBounds, mapZoom, selectedModel, currentTimeIndex, activeType]);

    return ready;
}

function pruneCache(cache: Map<string, WeatherGrid>): void {
    while (cache.size > MAX_CACHE) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
    }
}
