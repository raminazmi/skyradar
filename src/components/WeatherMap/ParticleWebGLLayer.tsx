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
    const mapRef     = useMapRef();
    const layerRef   = useRef<ParticleGLLayer | null>(null);
    const reassertRef = useRef<(() => void) | null>(null);

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

        // طبقة scalar للطبقة الفعّالة تُدرَج بعد طبقة الجسيمات فتعلوها وتخفيها (تظهر فقط بعد
        // إطفاء/تشغيل الجسيمات يدوياً). نُعيد رفع الجسيمات للأعلى عند كل styledata — لكن فقط
        // إن وُجدت طبقة حرارة/رياح فوقها فعلاً، وإلّا فإن moveLayer نفسه يُطلق styledata = حلقة لانهائية.
        reassertRef.current = () => {
            try {
                if (!map.getLayer(id)) return;
                const layers = map.getStyle()?.layers ?? [];
                const pIdx = layers.findIndex((l) => l.id === id);
                if (pIdx === -1) return;
                const coveredAbove = layers
                    .slice(pIdx + 1)
                    .some((l) => l.id === 'weather-heatmap-scalar' || l.id === 'weather-heatmap-wind');
                if (!coveredAbove) return; // لا شيء فوقها → لا تحريك → لا حلقة
                map.moveLayer(id, getWeatherInsertBeforeId(map));
            } catch { /* تجاهل */ }
        };
        map.on('styledata', reassertRef.current);

        const onStyleData = () => { if (map.isStyleLoaded()) { map.off('styledata', onStyleData); add(); } };
        if (map.isStyleLoaded()) add();
        else map.on('styledata', onStyleData);

        return () => {
            cancelled = true;
            map.off('styledata', onStyleData);
            if (reassertRef.current) map.off('styledata', reassertRef.current);
            reassertRef.current = null;
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
