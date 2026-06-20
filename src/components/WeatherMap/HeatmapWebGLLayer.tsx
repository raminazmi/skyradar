/**
 * HeatmapWebGLLayer.tsx
 * غلاف React لطبقة الـ Heatmap بـ WebGL (HeatmapGLLayer).
 * يسجّل الطبقة المخصّصة في MapLibre عند التركيب، ويزامن grid/type/opacity.
 *
 * يحلّ محلّ HeatmapCanvasLayer القديم (Canvas 2D) بنفس الواجهة تقريباً،
 * بإضافة id ثابت لكل "فتحة" طبقة (الرياح / الطبقة العددية).
 */

import { useEffect, useRef } from 'react';
import { useMapRef } from './MapContext';
import { HeatmapGLLayer } from './webgl/HeatmapGLLayer';
import { getWeatherInsertBeforeId } from './webgl/layerOrder';
import type { WeatherGrid } from '../../services/weatherGridService';
import type { ForecastGridType } from '../../config/weatherLayers';

interface HeatmapWebGLLayerProps {
    /** معرّف فريد وثابت لهذه الفتحة (مثل weather-heatmap-wind) */
    id: string;
    grid: WeatherGrid | null;
    type: ForecastGridType;
    opacity?: number;
}

export function HeatmapWebGLLayer({ id, grid, type, opacity = 0.8 }: HeatmapWebGLLayerProps) {
    const mapRef   = useMapRef();
    const layerRef = useRef<HeatmapGLLayer | null>(null);

    // إنشاء/إزالة الطبقة المخصّصة مرة واحدة لكل id
    useEffect(() => {
        const wrap = mapRef.current;
        if (!wrap) return;
        const map = wrap.getMap();

        let cancelled = false;
        const layer = new HeatmapGLLayer(id, type, opacity);

        const add = () => {
            if (cancelled) return;
            try {
                if (!map.getLayer(id)) map.addLayer(layer, getWeatherInsertBeforeId(map));
                layerRef.current = layer;
                layer.setGrid(grid);
            } catch (e) {
                console.error(`HeatmapWebGLLayer(${id}): تعذّر إضافة الطبقة`, e);
            }
        };

        // الانتظار حتى يجهز الـ style. حدث 'styledata' وحده غير موثوق: إن كان الـstyle
        // قد انتهى تحميله فعلاً قبل تركيب هذا المكوّن (الحالة الشائعة، لأن شبكة البيانات
        // تستغرق ثوانٍ للجلب)، لن يقع أي حدث styledata جديد فيبقى المستمع معلَّقاً للأبد
        // ولا تُضاف الطبقة أبداً. الحلّ: استقصاء دوري احتياطي مثل useMapStyling.
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
            try {
                if (map.getLayer(id)) map.removeLayer(id);
            } catch { /* تجاهل أخطاء الإزالة عند تفكيك الخريطة */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapRef, id]);

    useEffect(() => { layerRef.current?.setType(type); }, [type]);
    useEffect(() => { layerRef.current?.setGrid(grid); }, [grid]);
    useEffect(() => { layerRef.current?.setOpacity(opacity); }, [opacity]);

    return null;
}
