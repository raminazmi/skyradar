/**
 * ArabicCityLabels.tsx — MapLibre version
 * تسميات المدن العربية — تعمل مع MapLibre بدلاً من Leaflet
 */

import { useEffect, useRef } from 'react';
import { useMapRef } from './MapContext';
import { useWeatherStore } from '../../store/weatherStore';
import { weatherGridService, WeatherGrid } from '../../services/weatherGridService';

type LabelKind = 'country' | 'capital' | 'city' | 'sea';
interface MapLabel { lat: number; lon: number; name: string; minZoom: number; maxZoom?: number; kind: LabelKind; priority: number; }

const countries: MapLabel[] = [
    { lat: 23.9, lon: 45.1, name: 'السعودية', minZoom: 2, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 26.8, lon: 30.8, name: 'مصر', minZoom: 2, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 33.1, lon: 43.6, name: 'العراق', minZoom: 2, maxZoom: 7, kind: 'country', priority: 95 },
    { lat: 28.0, lon: 2.6, name: 'الجزائر', minZoom: 2, maxZoom: 7, kind: 'country', priority: 95 },
    { lat: 31.8, lon: -6.0, name: 'المغرب', minZoom: 2, maxZoom: 7, kind: 'country', priority: 90 },
    { lat: 26.3, lon: 17.2, name: 'ليبيا', minZoom: 2, maxZoom: 7, kind: 'country', priority: 90 },
    { lat: 15.8, lon: 30.2, name: 'السودان', minZoom: 2, maxZoom: 7, kind: 'country', priority: 90 },
    { lat: 35.0, lon: 38.5, name: 'سوريا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 85 },
    { lat: 31.2, lon: 36.8, name: 'الأردن', minZoom: 4, maxZoom: 8, kind: 'country', priority: 75 },
    { lat: 23.6, lon: 54.3, name: 'الإمارات', minZoom: 4, maxZoom: 8, kind: 'country', priority: 75 },
    { lat: 20.6, lon: 56.1, name: 'عمان', minZoom: 3, maxZoom: 8, kind: 'country', priority: 85 },
    { lat: 15.5, lon: 47.6, name: 'اليمن', minZoom: 3, maxZoom: 8, kind: 'country', priority: 85 },
    { lat: 34.1, lon: 9.4, name: 'تونس', minZoom: 4, maxZoom: 8, kind: 'country', priority: 75 },
    { lat: 39.0, lon: 35.2, name: 'تركيا', minZoom: 2, maxZoom: 7, kind: 'country', priority: 95 },
    { lat: 32.0, lon: 53.7, name: 'إيران', minZoom: 2, maxZoom: 7, kind: 'country', priority: 95 },
    { lat: 22.9, lon: 79.6, name: 'الهند', minZoom: 2, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 35.9, lon: 104.2, name: 'الصين', minZoom: 2, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 56.0, lon: 37.6, name: 'روسيا', minZoom: 2, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 46.2, lon: 2.2, name: 'فرنسا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 85 },
    { lat: 51.2, lon: 10.4, name: 'ألمانيا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 85 },
    { lat: 37.3, lon: -95.7, name: 'الولايات المتحدة', minZoom: 2, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 57.0, lon: -106.0, name: 'كندا', minZoom: 2, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: -14.2, lon: -51.9, name: 'البرازيل', minZoom: 2, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: -25.3, lon: 133.8, name: 'أستراليا', minZoom: 2, maxZoom: 7, kind: 'country', priority: 95 },
];

const seas: MapLabel[] = [
    { lat: 24.0, lon: 38.0, name: 'البحر الأحمر', minZoom: 3, maxZoom: 8, kind: 'sea', priority: 45 },
    { lat: 26.5, lon: 52.0, name: 'الخليج العربي', minZoom: 3, maxZoom: 8, kind: 'sea', priority: 45 },
    { lat: 34.5, lon: 18.0, name: 'البحر المتوسط', minZoom: 2, maxZoom: 7, kind: 'sea', priority: 50 },
    { lat: 21.0, lon: 62.0, name: 'بحر العرب', minZoom: 2, maxZoom: 7, kind: 'sea', priority: 45 },
    { lat: 15.0, lon: 72.0, name: 'المحيط الهندي', minZoom: 2, maxZoom: 6, kind: 'sea', priority: 45 },
    { lat: 8.0, lon: -35.0, name: 'المحيط الأطلسي', minZoom: 2, maxZoom: 6, kind: 'sea', priority: 45 },
    { lat: 18.0, lon: -145.0, name: 'المحيط الهادئ', minZoom: 2, maxZoom: 6, kind: 'sea', priority: 45 },
];

const cities: MapLabel[] = [
    { lat: 24.7136, lon: 46.6753, name: 'الرياض', minZoom: 4, kind: 'capital', priority: 100 },
    { lat: 21.3891, lon: 39.8579, name: 'جدة', minZoom: 5, kind: 'city', priority: 85 },
    { lat: 30.0444, lon: 31.2357, name: 'القاهرة', minZoom: 4, kind: 'capital', priority: 100 },
    { lat: 33.3152, lon: 44.3661, name: 'بغداد', minZoom: 4, kind: 'capital', priority: 95 },
    { lat: 25.2048, lon: 55.2708, name: 'دبي', minZoom: 4, kind: 'city', priority: 90 },
    { lat: 25.2854, lon: 51.5310, name: 'الدوحة', minZoom: 5, kind: 'capital', priority: 80 },
    { lat: 23.5880, lon: 58.3829, name: 'مسقط', minZoom: 5, kind: 'capital', priority: 80 },
    { lat: 15.3694, lon: 44.1910, name: 'صنعاء', minZoom: 5, kind: 'capital', priority: 80 },
    { lat: 33.5138, lon: 36.2765, name: 'دمشق', minZoom: 4, kind: 'capital', priority: 90 },
    { lat: 33.8938, lon: 35.5018, name: 'بيروت', minZoom: 5, kind: 'capital', priority: 80 },
    { lat: 41.0082, lon: 28.9784, name: 'إسطنبول', minZoom: 4, kind: 'city', priority: 90 },
    { lat: 35.6892, lon: 51.3890, name: 'طهران', minZoom: 4, kind: 'capital', priority: 90 },
    { lat: 28.6139, lon: 77.2090, name: 'نيودلهي', minZoom: 4, kind: 'capital', priority: 90 },
    { lat: 39.9042, lon: 116.4074, name: 'بكين', minZoom: 4, kind: 'capital', priority: 90 },
    { lat: 35.6762, lon: 139.6503, name: 'طوكيو', minZoom: 4, kind: 'capital', priority: 90 },
    { lat: 55.7558, lon: 37.6173, name: 'موسكو', minZoom: 4, kind: 'capital', priority: 90 },
    { lat: 48.8566, lon: 2.3522, name: 'باريس', minZoom: 5, kind: 'capital', priority: 85 },
    { lat: 51.5072, lon: -0.1276, name: 'لندن', minZoom: 5, kind: 'capital', priority: 85 },
    { lat: 40.7128, lon: -74.0060, name: 'نيويورك', minZoom: 4, kind: 'city', priority: 90 },
    { lat: 19.4326, lon: -99.1332, name: 'مكسيكو سيتي', minZoom: 4, kind: 'capital', priority: 85 },
    { lat: -23.5505, lon: -46.6333, name: 'ساو باولو', minZoom: 5, kind: 'city', priority: 80 },
    { lat: -33.8688, lon: 151.2093, name: 'سيدني', minZoom: 5, kind: 'city', priority: 75 },
];

const ALL_LABELS = [...countries, ...seas, ...cities];

interface ArabicCityLabelsProps { temperatureGrid?: WeatherGrid | null; }

export function ArabicCityLabels({ temperatureGrid = null }: ArabicCityLabelsProps) {
    const mapRef = useMapRef();
    const { darkMode, units, setCurrentLocation, setInfoPanelOpen } = useWeatherStore();
    const hostRef  = useRef<HTMLDivElement | null>(null);
    const animRef  = useRef(0);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const container = map.getContainer();
        const host      = document.createElement('div');
        host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:12;overflow:hidden;';
        container.appendChild(host);
        hostRef.current = host;

        const drawLabels = () => {
            if (!mapRef.current || !hostRef.current) return;
            const mapObj = mapRef.current;
            const zoom   = mapObj.getZoom();
            const w      = container.clientWidth;
            const h      = container.clientHeight;

            const visible = ALL_LABELS
                .filter(l => zoom >= l.minZoom && zoom <= (l.maxZoom ?? 20))
                .sort((a, b) => b.priority - a.priority);

            const maxLabels = zoom < 3 ? 18 : zoom < 5 ? 45 : 110;
            const chunks: string[] = [];
            let count = 0;

            for (const label of visible) {
                if (count >= maxLabels) break;
                // MapLibre project: takes [lng, lat]
                const pt = mapObj.project([label.lon, label.lat]);
                if (pt.x < -120 || pt.x > w + 120 || pt.y < -60 || pt.y > h + 60) continue;

                const rawTemp = temperatureGrid && (label.kind === 'city' || label.kind === 'capital')
                    ? weatherGridService.interpolate(temperatureGrid, label.lat, label.lon)?.value
                    : undefined;
                const temp = rawTemp === undefined ? undefined
                    : units.temperature === 'fahrenheit' ? Math.round((rawTemp * 9) / 5 + 32) : Math.round(rawTemp);
                const base  = label.kind === 'country' ? 12 : label.kind === 'sea' ? 11 : label.kind === 'capital' ? 11 : 10;
                const boost = Math.max(0, Math.min(4, zoom - 4));
                const dot   = label.kind === 'capital' ? '<i class="label-dot"></i>' : '';
                const badge = temp !== undefined ? `<b class="label-temp">${temp}°</b>` : '';
                const clickable = label.kind !== 'sea';

                chunks.push(`<div class="map-label map-label-${label.kind} ${darkMode ? 'dark' : 'light'}${clickable ? ' label-clickable' : ''}"
                    style="position:absolute;left:${pt.x}px;top:${pt.y}px;font-size:${base + boost}px;transform:translate(-50%,-50%);${clickable ? 'pointer-events:auto;' : ''}"
                    data-lat="${label.lat}" data-lon="${label.lon}">
                    ${dot}<span class="label-text">${label.name}</span>${badge}
                </div>`);
                count++;
            }

            host.innerHTML = chunks.join('');
            host.querySelectorAll('.label-clickable').forEach(el => {
                el.addEventListener('click', e => {
                    e.stopPropagation();
                    const lat = parseFloat((el as HTMLElement).dataset.lat ?? '0');
                    const lon = parseFloat((el as HTMLElement).dataset.lon ?? '0');
                    setCurrentLocation(lat, lon);
                    setInfoPanelOpen(true);
                }, true);
            });
        };

        // rAF loop for smooth pan updates
        const loop = () => { drawLabels(); animRef.current = requestAnimationFrame(loop); };
        loop();

        return () => {
            cancelAnimationFrame(animRef.current);
            host.remove();
        };
    }, [mapRef, darkMode, units.temperature, temperatureGrid]);

    return null;
}
