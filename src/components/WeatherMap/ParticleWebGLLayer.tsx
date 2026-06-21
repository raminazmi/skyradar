/**
 * ParticleWebGLLayer.tsx
 * غلاف React لمحرّك جسيمات الرياح بـ WebGL (ParticleGLLayer).
 */

import { useEffect, useRef } from 'react';
import { useMapRef } from './MapContext';
import { ParticleGLLayer, type ParticleSettings } from './webgl/ParticleGLLayer';
import { getWeatherInsertBeforeId } from './webgl/layerOrder';
import type { WeatherGrid } from '../../services/weatherGridService';
import type { LayerAnimationSettings } from '../../config/layerAnimation';

const BASE_PARTICLE_SETTINGS: Partial<ParticleSettings> = {
    speed: 0.25,
    trail: 0.95,
    opacity: 1,
};

interface ParticleWebGLLayerProps {
    id: string;
    windGrid: WeatherGrid | null;
    settings: LayerAnimationSettings;
    darkMode?: boolean;
}

export function ParticleWebGLLayer({ id, windGrid, settings, darkMode = true }: ParticleWebGLLayerProps) {
    const mapRef   = useMapRef();
    const layerRef = useRef<ParticleGLLayer | null>(null);

    useEffect(() => {
        const wrap = mapRef.current;
        if (!wrap) return;
        const map = wrap.getMap();

        let cancelled = false;
        // الكثافة تُحسب تلقائياً من الزووم داخل ParticleGLLayer في كل إطار
        const layer = new ParticleGLLayer(id, BASE_PARTICLE_SETTINGS, darkMode);

        const add = () => {
            if (cancelled) return;
            try {
                if (!map.getLayer(id)) map.addLayer(layer, getWeatherInsertBeforeId(map));
                layerRef.current = layer;
                layer.setWindGrid(windGrid);
            } catch (e) {
                console.error(`ParticleWebGLLayer(${id}): تعذّر إضافة الطبقة`, e);
            }
        };

        const onStyleData = () => { if (map.isStyleLoaded()) { map.off('styledata', onStyleData); add(); } };
        if (map.isStyleLoaded()) add();
        else map.on('styledata', onStyleData);

        return () => {
            cancelled = true;
            map.off('styledata', onStyleData);
            layerRef.current = null;
            try {
                if (map.getLayer(id)) map.removeLayer(id);
            } catch { /* تجاهل أخطاء الإزالة */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRef, id]);

    useEffect(() => { layerRef.current?.setWindGrid(windGrid); }, [windGrid]);
    useEffect(() => { layerRef.current?.setSettings(BASE_PARTICLE_SETTINGS); }, [settings]);
    useEffect(() => { layerRef.current?.setDarkMode(darkMode); }, [darkMode]);

    return null;
}
