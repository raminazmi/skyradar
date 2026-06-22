/**
 * TiledHeatmapWebGLLayer.tsx
 * غلاف React لطبقة الـ Heatmap المُبلّطة (TiledHeatmapGLLayer).
 * يسجّل الطبقة المخصّصة مرّة، ويزامن البلاطات/النوع/الشفافية.
 */

import { useEffect, useRef } from 'react';
import { useMapRef } from './MapContext';
import { TiledHeatmapGLLayer } from './webgl/TiledHeatmapGLLayer';
import { getWeatherInsertBeforeId } from './webgl/layerOrder';
import type { ReadyTile } from './hooks/useTiledHeatmap';
import type { ForecastGridType } from '../../config/weatherLayers';

interface Props {
    id: string;
    tiles: ReadyTile[];
    type: ForecastGridType;
    opacity?: number;
}

export function TiledHeatmapWebGLLayer({ id, tiles, type, opacity = 0.8 }: Props) {
    const mapRef = useMapRef();
    const layerRef = useRef<TiledHeatmapGLLayer | null>(null);

    useEffect(() => {
        const wrap = mapRef.current;
        if (!wrap) return;
        const map = wrap.getMap();

        let cancelled = false;
        const layer = new TiledHeatmapGLLayer(id, type, opacity);

        const add = () => {
            if (cancelled) return;
            try {
                if (!map.getLayer(id)) map.addLayer(layer, getWeatherInsertBeforeId(map));
                layerRef.current = layer;
                layer.setTiles(tiles);
            } catch (e) {
                console.error(`TiledHeatmapWebGLLayer(${id}): تعذّر إضافة الطبقة`, e);
            }
        };

        // نفس نمط الانتظار الموثوق في HeatmapWebGLLayer (styledata + استقصاء احتياطي).
        let intervalId: number | undefined;
        const onStyleData = () => { if (map.isStyleLoaded()) { cleanupWait(); add(); } };
        const cleanupWait = () => {
            map.off('styledata', onStyleData);
            if (intervalId !== undefined) window.clearInterval(intervalId);
        };
        if (map.isStyleLoaded()) {
            add();
        } else {
            map.on('styledata', onStyleData);
            intervalId = window.setInterval(() => {
                if (map.isStyleLoaded()) { cleanupWait(); add(); }
            }, 150);
        }

        return () => {
            cancelled = true;
            cleanupWait();
            layerRef.current = null;
            try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* تجاهل */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRef, id]);

    useEffect(() => { layerRef.current?.setType(type); }, [type]);
    useEffect(() => { layerRef.current?.setTiles(tiles); }, [tiles]);
    useEffect(() => { layerRef.current?.setOpacity(opacity); }, [opacity]);

    return null;
}
