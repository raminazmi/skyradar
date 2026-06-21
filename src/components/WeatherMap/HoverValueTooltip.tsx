/**
 * HoverValueTooltip.tsx
 * تلميح (tooltip) يتبع المؤشّر ويعرض قيمة الطبقة الفعّالة عند أي إحداثي على الخريطة —
 * تماماً كأسلوب Zoom Earth: سطر القيمة الأساسية بوحدتها (مثل 33°C)، وسطر الرياح
 * (السرعة + سهم الاتجاه + الجهة WSW) عند توفّر شبكة الرياح.
 *
 * يقرأ القيمة عبر weatherGridService.interpolate (استيفاء ثنائي الخطّية على الشبكة)
 * فتظهر قيمة سلسة في أي نقطة بين عُقد الشبكة، لا قيمة العُقد فقط.
 */

import { useEffect, useRef, useState } from 'react';
import type { MapMouseEvent } from 'maplibre-gl';
import { useMapRef } from './MapContext';
import { useWeatherStore } from '../../store/weatherStore';
import { weatherGridService, type WeatherGrid } from '../../services/weatherGridService';
import type { ForecastGridType } from '../../config/weatherLayers';

interface HoverValueTooltipProps {
    grid: WeatherGrid | null;
    type: ForecastGridType | null;
    windGrid?: WeatherGrid | null;
}

/** تنسيق القيمة الأساسية بوحدتها (مع تحويل الحرارة لفهرنهايت عند الحاجة). */
function formatMain(type: ForecastGridType, value: number, fahrenheit: boolean): string {
    switch (type) {
        case 'temperature':
        case 'feels-like':
        case 'dewpoint': {
            const v = fahrenheit ? value * 9 / 5 + 32 : value;
            return `${Math.round(v)}°${fahrenheit ? 'F' : 'C'}`;
        }
        case 'wind':
        case 'wind-gusts':
            return `${Math.round(value)} km/h`;
        case 'precipitation':
            return `${value.toFixed(1)} mm`;
        case 'pressure':
            return `${Math.round(value)} hPa`;
        case 'humidity':
        case 'clouds':
            return `${Math.round(value)}%`;
        default:
            return `${Math.round(value)}`;
    }
}

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                   'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** يحوّل زاوية اتجاه الرياح (مصدرها، بالدرجات) إلى جهة من 16 جهة. */
function dirToCardinal(deg: number): string {
    return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

interface WindInfo { speed: number; dir: number; cardinal: string }
interface HoverState { x: number; y: number; main: string; wind: WindInfo | null }

export function HoverValueTooltip({ grid, type, windGrid = null }: HoverValueTooltipProps) {
    const mapRef = useMapRef();
    const fahrenheit = useWeatherStore((s) => s.units.temperature === 'fahrenheit');
    const [hover, setHover] = useState<HoverState | null>(null);

    // نحتفظ بأحدث البيانات في ref حتى لا نعيد ربط المستمعات مع كل تغيّر بيانات.
    const dataRef = useRef<{ grid: WeatherGrid | null; type: ForecastGridType | null; windGrid: WeatherGrid | null; fahrenheit: boolean }>(
        { grid, type, windGrid, fahrenheit });
    dataRef.current = { grid, type, windGrid, fahrenheit };

    useEffect(() => {
        let map: ReturnType<NonNullable<typeof mapRef.current>['getMap']> | null = null;
        let pollId: number | undefined;

        let rafId: number | null = null;
        let pending: { lat: number; lon: number; x: number; y: number } | null = null;

        const flush = () => {
            rafId = null;
            if (!pending) return;
            const { grid: g, type: t, windGrid: wg, fahrenheit: f } = dataRef.current;
            if (!g || !t) { setHover(null); return; }
            const gp = weatherGridService.interpolate(g, pending.lat, pending.lon);
            if (!gp || !Number.isFinite(gp.value)) { setHover(null); return; }

            // سطر الرياح: من شبكة الرياح إن توفّرت (تحوي u/v → سرعة واتجاه)
            let wind: WindInfo | null = null;
            const wp = wg ? weatherGridService.interpolate(wg, pending.lat, pending.lon) : null;
            if (wp && wp.speed !== undefined && wp.direction !== undefined && wp.speed >= 0.5) {
                wind = { speed: wp.speed, dir: wp.direction, cardinal: dirToCardinal(wp.direction) };
            }
            setHover({ x: pending.x, y: pending.y, main: formatMain(t, gp.value, f), wind });
        };

        const onMove = (e: MapMouseEvent) => {
            pending = { lat: e.lngLat.lat, lon: e.lngLat.lng, x: e.originalEvent.clientX, y: e.originalEvent.clientY };
            if (rafId === null) rafId = window.requestAnimationFrame(flush);
        };
        const onLeave = () => {
            pending = null;
            if (rafId !== null) { window.cancelAnimationFrame(rafId); rafId = null; }
            setHover(null);
        };

        // الخريطة قد لا تكون جاهزة عند أول تركيب (هذا المكوّن خارج <Map>) — ننتظرها.
        const attach = () => {
            const wrap = mapRef.current;
            if (!wrap) return false;
            map = wrap.getMap();
            map.on('mousemove', onMove);
            map.on('mouseout', onLeave);
            return true;
        };
        if (!attach()) {
            pollId = window.setInterval(() => { if (attach()) window.clearInterval(pollId); }, 200);
        }

        return () => {
            if (pollId !== undefined) window.clearInterval(pollId);
            if (map) { map.off('mousemove', onMove); map.off('mouseout', onLeave); }
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, [mapRef]);

    if (!hover) return null;
    return (
        <div className="hover-value-tooltip" style={{ left: hover.x, top: hover.y }} aria-hidden>
            <span className="hv-main">{hover.main}</span>
            {hover.wind && (
                <span className="hv-wind">
                    <span className="hv-sep" />
                    {Math.round(hover.wind.speed)} km/h
                    <span className="hv-arrow" style={{ transform: `rotate(${hover.wind.dir + 180}deg)` }}>↑</span>
                    {hover.wind.cardinal}
                </span>
            )}
        </div>
    );
}
