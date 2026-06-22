/**
 * RasterHeatmapWebGLLayer.tsx
 * غلاف React لطبقة النسيج العالمي الخام (RasterHeatmapGLLayer).
 */

import { useEffect, useRef } from 'react';
import { useMapRef } from './MapContext';
import { RasterHeatmapGLLayer } from './webgl/RasterHeatmapGLLayer';
import { getWeatherInsertBeforeId } from './webgl/layerOrder';
import type { ForecastGridType } from '../../config/weatherLayers';

interface Props {
    id: string;
    url: string;
    type: ForecastGridType;
    opacity?: number;
}

export function RasterHeatmapWebGLLayer({ id, url, type, opacity = 0.9 }: Props) {
    const mapRef = useMapRef();
    const layerRef = useRef<RasterHeatmapGLLayer | null>(null);

    useEffect(() => {
        const wrap = mapRef.current;
        if (!wrap) return;
        const map = wrap.getMap();
        let cancelled = false;
        const layer = new RasterHeatmapGLLayer(id, type, url, opacity);

        const add = () => {
            if (cancelled) return;
            try {
                if (!map.getLayer(id)) map.addLayer(layer, getWeatherInsertBeforeId(map));
                layerRef.current = layer;
            } catch (e) { console.error(`RasterHeatmapWebGLLayer(${id})`, e); }
        };
        let intervalId: number | undefined;
        const onStyleData = () => { if (map.isStyleLoaded()) { cleanupWait(); add(); } };
        const cleanupWait = () => { map.off('styledata', onStyleData); if (intervalId !== undefined) window.clearInterval(intervalId); };
        if (map.isStyleLoaded()) add();
        else { map.on('styledata', onStyleData); intervalId = window.setInterval(() => { if (map.isStyleLoaded()) { cleanupWait(); add(); } }, 150); }

        return () => {
            cancelled = true; cleanupWait(); layerRef.current = null;
            try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* تجاهل */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRef, id]);

    useEffect(() => { layerRef.current?.setType(type); }, [type]);
    useEffect(() => { layerRef.current?.setUrl(url); }, [url]);
    useEffect(() => { layerRef.current?.setOpacity(opacity); }, [opacity]);
    return null;
}
