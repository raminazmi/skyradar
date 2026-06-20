/**
 * WildfireLayer.tsx — MapLibre version
 * طبقة الحرائق — بدون Leaflet، يستخدم DOM مباشرة مع MapLibre
 */

import { useEffect, useRef } from 'react';
import { useMapRef } from './MapContext';
import { useWeatherStore } from '../../store/weatherStore';
import { getWildfiresForBounds, type WildfireHotspot } from '../../services/wildfireService';

export function WildfireLayer() {
    const mapRef       = useMapRef();
    const { visibleLayers, layerAnimationSettings } = useWeatherStore();
    const overlayRef   = useRef<HTMLDivElement | null>(null);
    const hotspotsRef  = useRef<WildfireHotspot[]>([]);
    const animIdRef    = useRef(0);
    const reduceMotion = layerAnimationSettings.wildfires?.reduceMotion ?? false;

    // ── Mount overlay ─────────────────────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const container = map.getContainer();
        const overlay   = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9;overflow:hidden;';
        container.appendChild(overlay);
        overlayRef.current = overlay;

        const render = () => {
            if (!overlayRef.current || !mapRef.current) return;
            const mapObj = mapRef.current;
            let html = '';

            for (const h of hotspotsRef.current) {
                const pt     = mapObj.project([h.lon, h.lat]);
                const color  = getWildfireColor(h);
                const radius = 8 + Math.round(h.intensity * 12);
                const area   = radius * 2.5;
                html += `<div class="wildfire-marker ${reduceMotion ? 'reduced-motion' : ''}" 
                    style="position:absolute;left:${pt.x}px;top:${pt.y}px;transform:translate(-50%,-50%);
                           --fire-color:${color};--fire-size:${radius}px;--fire-area:${area}px;pointer-events:auto;"
                    title="${h.name}">
                    <span class="wildfire-pulse"></span>
                    <span class="wildfire-core"></span>
                </div>`;
            }

            overlay.innerHTML = html;
        };

        const loop = () => { render(); animIdRef.current = requestAnimationFrame(loop); };
        loop();

        return () => {
            cancelAnimationFrame(animIdRef.current);
            overlay.remove();
        };
    }, [mapRef, reduceMotion]);

    // ── Fetch hotspots ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!visibleLayers.wildfires) { hotspotsRef.current = []; return; }
        const map = mapRef.current;
        if (!map) return;

        let cancelled = false;
        const bounds = map.getBounds();
        const requestBounds = {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east:  bounds.getEast(),
            west:  bounds.getWest(),
        };

        getWildfiresForBounds(requestBounds)
            .then(h => { if (!cancelled) hotspotsRef.current = h; })
            .catch(err => console.error('Failed to fetch wildfire data:', err));

        return () => { cancelled = true; };
    }, [mapRef, visibleLayers.wildfires]);

    return null;
}

function getWildfireColor(hotspot: WildfireHotspot): string {
    if (hotspot.confidence === 'high')   return '#ff3d00';
    if (hotspot.confidence === 'medium') return '#ff8f00';
    return '#ffd166';
}
