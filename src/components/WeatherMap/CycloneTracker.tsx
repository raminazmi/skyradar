/**
 * CycloneTracker.tsx — MapLibre version
 * مراقب الأعاصير — بدون Leaflet، يستخدم DOM مباشرة مع MapLibre
 */

import { useEffect, useRef, useState } from 'react';
import { useMapRef } from './MapContext';
import { useWeatherStore } from '../../store/weatherStore';
import { getActiveCyclones, type Cyclone } from '../../services/cycloneService';

function categoryColor(cat: number): string {
    if (cat >= 5) return '#7e1bd9';
    if (cat >= 4) return '#dc143c';
    if (cat >= 3) return '#ff4500';
    if (cat >= 2) return '#ff8c00';
    if (cat >= 1) return '#ffd700';
    return '#87ceeb';
}

function categoryLabel(cat: number): string {
    return cat >= 1 ? `Category ${cat}` : 'Tropical storm';
}

export function CycloneTracker() {
    const mapRef = useMapRef();
    const { visibleLayers, showHurricanes, layerAnimationSettings } = useWeatherStore();
    const overlayRef    = useRef<HTMLDivElement | null>(null);
    const cyclonesRef   = useRef<Cyclone[]>([]);
    const animIdRef     = useRef(0);
    const [selected, setSelected] = useState<Cyclone | null>(null);
    const isVisible   = visibleLayers.hurricanes || showHurricanes;
    const reduceMotion = layerAnimationSettings.hurricanes.reduceMotion;

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const container = map.getContainer();
        const overlay   = document.createElement('div');
        overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;overflow:hidden;';
        container.appendChild(overlay);
        overlayRef.current = overlay;

        const render = () => {
            if (!overlayRef.current || !mapRef.current) return;
            const host = overlayRef.current;
            const mapObj = mapRef.current;

            let html = '';
            for (const c of cyclonesRef.current) {
                const pt = mapObj.project([c.lon, c.lat]);
                const color = categoryColor(c.category);
                html += `<div class="cyclone-marker" style="position:absolute;left:${pt.x}px;top:${pt.y}px;transform:translate(-50%,-50%);--cyc-color:${color};pointer-events:auto;" data-id="${c.id}">
                    <div class="cyc-spinner ${reduceMotion ? 'reduced-motion' : ''}"></div>
                    <div class="cyc-info"><div class="cyc-name">${c.nameAr}</div><div class="cyc-cat" style="background:${color}">${c.category}</div></div>
                </div>`;
                // track dots
                for (let i = 1; i < c.track.length; i++) {
                    const tp = mapObj.project([c.track[i].lon, c.track[i].lat]);
                    html += `<div style="position:absolute;left:${tp.x}px;top:${tp.y}px;width:10px;height:10px;border-radius:50%;background:${categoryColor(c.track[i].cat)};border:2px solid #fff;transform:translate(-50%,-50%);pointer-events:auto;" data-id="${c.id}"></div>`;
                }
            }
            host.innerHTML = html;

            host.querySelectorAll('[data-id]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = (el as HTMLElement).dataset.id;
                    const cyc = cyclonesRef.current.find(c => c.id === id) ?? null;
                    setSelected(cyc);
                });
            });
        };

        const loop = () => { render(); animIdRef.current = requestAnimationFrame(loop); };
        loop();

        return () => {
            cancelAnimationFrame(animIdRef.current);
            overlay.remove();
        };
    }, [mapRef, reduceMotion]);

    useEffect(() => {
        if (!isVisible) { cyclonesRef.current = []; return; }
        let cancelled = false;
        getActiveCyclones()
            .then(c => { if (!cancelled) cyclonesRef.current = c; })
            .catch(() => { if (!cancelled) cyclonesRef.current = []; }); // لا أعاصير / تعذّر الجلب — ليست حالة خطأ
        return () => { cancelled = true; };
    }, [isVisible]);

    if (!selected) return null;

    return (
        <div className="cyclone-detail-card" dir="rtl">
            <button className="cyclone-close" onClick={() => setSelected(null)}>x</button>
            <div className="cyclone-detail-header">
                <span className="cyclone-detail-icon" />
                <div>
                    <div className="cyclone-detail-name">{selected.nameAr}</div>
                    <div className="cyclone-detail-cat" style={{ background: categoryColor(selected.category) }}>
                        {categoryLabel(selected.category)}
                    </div>
                </div>
            </div>
            <div className="cyclone-detail-grid">
                <div className="cyc-stat"><div className="cyc-stat-label">Wind speed</div><div className="cyc-stat-value">{selected.maxWind} km/h</div></div>
                <div className="cyc-stat"><div className="cyc-stat-label">Pressure</div><div className="cyc-stat-value">{selected.pressure} hPa</div></div>
                <div className="cyc-stat"><div className="cyc-stat-label">Direction</div><div className="cyc-stat-value">{selected.movement.dir} deg</div></div>
                <div className="cyc-stat"><div className="cyc-stat-label">Movement</div><div className="cyc-stat-value">{selected.movement.speed} km/h</div></div>
            </div>
            <div className="cyclone-track-list">
                <div className="cyc-track-title">Forecast track</div>
                {selected.track.map((point, i) => (
                    <div key={`${point.lat}_${point.lon}_${i}`} className="cyc-track-item">
                        <span className="cyc-time">{point.time}</span>
                        <span className="cyc-cat-pill" style={{ background: categoryColor(point.cat) }}>{categoryLabel(point.cat)}</span>
                        <span className="cyc-coords">{point.lat.toFixed(1)}, {point.lon.toFixed(1)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
