/**
 * HoverValueTooltip.tsx
 * تلميح (tooltip) يتبع المؤشّر ويعرض قيمة الطبقة الفعّالة عند أي إحداثي على الخريطة —
 * تماماً كأسلوب Zoom Earth: سطر القيمة الأساسية بوحدتها (مثل 33°C)، وسطر الرياح
 * (السرعة + سهم الاتجاه + الجهة WSW) عند توفّر شبكة الرياح.
 *
 * يقرأ القيمة مباشرةً من نُسج GFS المحلّية عبر rasterSampler (بلا أي طلب API)،
 * فتظهر قيمة سلسة في أي نقطة بين عُقد الشبكة عبر استيفاء ثنائي الخطّية على الصورة.
 */

import { useEffect, useRef, useState } from 'react';
import type { MapMouseEvent } from 'maplibre-gl';
import { useMapRef } from './MapContext';
import { useWeatherStore } from '../../store/weatherStore';
import { rasterSampler } from '../../services/rasterSampler';
import type { ForecastGridType } from '../../config/weatherLayers';

interface HoverValueTooltipProps {
    /** الطبقة السلَّمية الفعّالة (للسطر الأساسي). */
    type: ForecastGridType | null;
    /** إطار الوقت الحالي (يحدّد نسيج الإطار المقروء). */
    timeIndex: number;
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

export function HoverValueTooltip({ type, timeIndex }: HoverValueTooltipProps) {
    const mapRef = useMapRef();
    const fahrenheit = useWeatherStore((s) => s.units.temperature === 'fahrenheit');
    const [hover, setHover] = useState<HoverState | null>(null);

    // نحتفظ بأحدث البيانات في ref حتى لا نعيد ربط المستمعات مع كل تغيّر بيانات.
    const dataRef = useRef<{ type: ForecastGridType | null; timeIndex: number; fahrenheit: boolean }>(
        { type, timeIndex, fahrenheit });
    dataRef.current = { type, timeIndex, fahrenheit };

    // نحمّل نسيج الطبقة الفعّالة + الرياح للإطار الحالي مسبقاً ليجهز التلميح فوراً.
    useEffect(() => {
        if (type) rasterSampler.prefetch(type, timeIndex);
        rasterSampler.prefetch('wind', timeIndex);
    }, [type, timeIndex]);

    useEffect(() => {
        let map: ReturnType<NonNullable<typeof mapRef.current>['getMap']> | null = null;
        let pollId: number | undefined;

        let rafId: number | null = null;
        let pending: { lat: number; lon: number; x: number; y: number } | null = null;

        const flush = () => {
            rafId = null;
            if (!pending) return;
            const { type: t, timeIndex: ti, fahrenheit: f } = dataRef.current;
            if (!t) { setHover(null); return; }
            const value = rasterSampler.sampleScalar(t, ti, pending.lat, pending.lon);
            if (value === null || !Number.isFinite(value)) { setHover(null); return; }

            // سطر الرياح: من نسيج الرياح المحلّي (U/V → سرعة واتجاه)
            let wind: WindInfo | null = null;
            const wp = rasterSampler.sampleWind(ti, pending.lat, pending.lon);
            if (wp && wp.speed >= 0.5) {
                wind = { speed: wp.speed, dir: wp.direction, cardinal: dirToCardinal(wp.direction) };
            }
            setHover({ x: pending.x, y: pending.y, main: formatMain(t, value, f), wind });
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
