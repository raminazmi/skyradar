/**
 * useMapStyling.ts
 * يجهّز تنسيق الخريطة عند التحميل (خلفية/حدود/تضاريس/سواحل)، ويعيد تطبيقه عند تبديل
 * الثيم، ويحسب أدنى زووم يملأ العرض بلا تكرار. يُرجع معالِجَي onLoad و onMoveEnd.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map as MaplibreMap } from 'maplibre-gl';
import {
    liftAdminBordersAboveBase, hideBaseMapLabels, styleAdminBorders, styleWeatherBase,
    addHillshadeTerrain, addContinentCoastline, applyHillshadeTheme,
} from '../webgl/layerOrder';
import type { GridBounds } from '../utils/gridBounds';

interface Params {
    mapRef: React.RefObject<MapRef | null>;
    darkMode: boolean;
    setMapBounds: (b: GridBounds) => void;
    setZoomLevel: (z: number) => void;
}

/** أدنى زووم يجعل عرض العالم = عرض الكانفاس (بلا نسخ متكرّرة). */
function applyMinZoom(map: MaplibreMap): void {
    const canvas = map.getCanvas();
    const minZoom = Math.log2(canvas.clientWidth / 512);
    map.setMinZoom(Math.max(0, minZoom));
}

export function useMapStyling({ mapRef, darkMode, setMapBounds, setZoomLevel }: Params) {
    const initedRef = useRef(false);

    const handleMapLoad = useCallback(() => {
        if (initedRef.current) return; // يمنع التهيئة المزدوجة (مثلاً عند سباق React.StrictMode)
        const map = mapRef.current;
        if (!map) return;
        const gl = map.getMap();
        if (!gl.isStyleLoaded()) return; // الستايل لم يجهز فعلياً بعد — يُعاد المحاولة عبر آلية المراقبة أدناه
        initedRef.current = true;

        // كل خطوة في حارس مستقل: فشل واحدة (مثلاً التضاريس) يجب ألّا يُلغي البقية —
        // وإلّا تبقى الأسماء الإنجليزية ظاهرة وتختفي السواحل/التفاصيل.
        const step = (fn: () => void) => { try { fn(); } catch { /* تجاهل */ } };
        step(() => styleWeatherBase(gl, darkMode));
        step(() => liftAdminBordersAboveBase(gl));
        step(() => addHillshadeTerrain(gl, darkMode));
        step(() => hideBaseMapLabels(gl));
        step(() => styleAdminBorders(gl, darkMode));
        step(() => addContinentCoastline(gl, darkMode));

        applyMinZoom(gl);
        const b = map.getBounds();
        setMapBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
        setZoomLevel(map.getZoom());
    }, [mapRef, setMapBounds, setZoomLevel, darkMode]);

    // احتياط: حدث onLoad من react-map-gl قد لا يُطلَق (سباق معروف مع React.StrictMode
    // الذي يُركّب/يُفكّك/يُعيد تركيب الخريطة مرّتين في وضع التطوير)، فتبقى mapBounds
    // فارغة للأبد ولا تُجلَب بيانات الطقس أبداً. نراقب جهوزية الستايل صراحةً كحلّ بديل.
    useEffect(() => {
        if (initedRef.current) return;
        const id = window.setInterval(() => {
            if (initedRef.current) { window.clearInterval(id); return; }
            const gl = mapRef.current?.getMap();
            if (gl?.isStyleLoaded()) {
                handleMapLoad();
                window.clearInterval(id);
            }
        }, 150);
        return () => window.clearInterval(id);
    }, [mapRef, handleMapLoad]);

    const handleMoveEnd = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        const b = map.getBounds();
        setMapBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
        setZoomLevel(map.getZoom());
    }, [mapRef, setMapBounds, setZoomLevel]);

    // إعادة تطبيق التنسيق عند تبديل الثيم
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        try {
            const gl = map.getMap();
            styleWeatherBase(gl, darkMode);
            hideBaseMapLabels(gl);          // إبقاء الأسماء الإنجليزية مخفيّة بعد تبديل الثيم
            styleAdminBorders(gl, darkMode);
            addContinentCoastline(gl, darkMode);
            applyHillshadeTheme(gl, darkMode);
        } catch { /* تجاهل */ }
    }, [darkMode, mapRef]);

    // إعادة حساب أدنى زووم عند تغيير حجم النافذة
    useEffect(() => {
        const onResize = () => {
            const gl = mapRef.current?.getMap();
            if (gl) applyMinZoom(gl);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [mapRef]);

    return { handleMapLoad, handleMoveEnd };
}
