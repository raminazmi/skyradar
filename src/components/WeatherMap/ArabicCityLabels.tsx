/**
 * ArabicCityLabels.tsx — MapLibre version
 * تسميات المدن العربية — تعمل مع MapLibre بدلاً من Leaflet
 */

import { useEffect, useRef } from 'react';
import { useMapRef } from './MapContext';
import { useWeatherStore } from '../../store/weatherStore';
import { rasterSampler } from '../../services/rasterSampler';
import { getHeatmapColor } from '../../services/colorScales';

/** يختار لون نصّ مقروء (أبيض/أسود) حسب إضاءة لون الخلفية rgba. */
function pickTextColor(rgba: string): string {
    const m = rgba.match(/rgba?\(([^)]+)\)/);
    if (!m) return '#1a1100';
    const [r, g, b] = m[1].split(',').map((s) => parseFloat(s.trim()));
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#1a1100' : '#ffffff';
}

type LabelKind = 'continent' | 'country' | 'capital' | 'city' | 'sea';
interface MapLabel { lat: number; lon: number; name: string; minZoom: number; maxZoom?: number; kind: LabelKind; priority: number; }

// أسماء القارات — تظهر عند التصغير الكامل (قبل أن تظهر الدول) وتختفي عند التقريب.
const continents: MapLabel[] = [
    { lat: 45.0, lon: 90.0, name: 'آسيا', minZoom: 0, maxZoom: 3.2, kind: 'continent', priority: 200 },
    { lat: 2.0, lon: 22.0, name: 'أفريقيا', minZoom: 0, maxZoom: 3.4, kind: 'continent', priority: 200 },
    { lat: 50.0, lon: 12.0, name: 'أوروبا', minZoom: 0, maxZoom: 3.2, kind: 'continent', priority: 200 },
    { lat: 43.0, lon: -100.0, name: 'أمريكا الشمالية', minZoom: 0, maxZoom: 3.2, kind: 'continent', priority: 200 },
    { lat: -12.0, lon: -58.0, name: 'أمريكا الجنوبية', minZoom: 0, maxZoom: 3.4, kind: 'continent', priority: 200 },
    { lat: -25.0, lon: 134.0, name: 'أستراليا', minZoom: 0, maxZoom: 3.4, kind: 'continent', priority: 200 },
];

const countries: MapLabel[] = [
    { lat: 23.9, lon: 45.1, name: 'السعودية', minZoom: 1, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 26.8, lon: 30.8, name: 'مصر', minZoom: 1, maxZoom: 7, kind: 'country', priority: 100 },
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
    { lat: 22.9, lon: 79.6, name: 'الهند', minZoom: 1, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 35.9, lon: 104.2, name: 'الصين', minZoom: 1, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 56.0, lon: 37.6, name: 'روسيا', minZoom: 1, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 46.2, lon: 2.2, name: 'فرنسا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 85 },
    { lat: 51.2, lon: 10.4, name: 'ألمانيا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 85 },
    { lat: 37.3, lon: -95.7, name: 'الولايات المتحدة', minZoom: 1, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: 57.0, lon: -106.0, name: 'كندا', minZoom: 1, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: -14.2, lon: -51.9, name: 'البرازيل', minZoom: 1, maxZoom: 7, kind: 'country', priority: 100 },
    { lat: -25.3, lon: 133.8, name: 'أستراليا', minZoom: 4, maxZoom: 8, kind: 'country', priority: 95 },
    { lat: 9.1, lon: 8.7, name: 'نيجيريا', minZoom: 3, maxZoom: 7, kind: 'country', priority: 80 },
    { lat: -1.3, lon: 36.8, name: 'كينيا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 75 },
    { lat: -30.6, lon: 22.9, name: 'جنوب أفريقيا', minZoom: 2, maxZoom: 7, kind: 'country', priority: 85 },
    { lat: 9.0, lon: 38.7, name: 'إثيوبيا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 75 },
    { lat: 40.4, lon: -3.7, name: 'إسبانيا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 80 },
    { lat: 41.9, lon: 12.6, name: 'إيطاليا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 80 },
    { lat: 30.4, lon: 69.3, name: 'باكستان', minZoom: 2, maxZoom: 7, kind: 'country', priority: 85 },
    { lat: 36.2, lon: 138.3, name: 'اليابان', minZoom: 2, maxZoom: 7, kind: 'country', priority: 90 },
    { lat: 36.5, lon: 127.8, name: 'كوريا الجنوبية', minZoom: 3, maxZoom: 8, kind: 'country', priority: 75 },
    { lat: -0.8, lon: 113.9, name: 'إندونيسيا', minZoom: 2, maxZoom: 7, kind: 'country', priority: 85 },
    { lat: 23.6, lon: -102.5, name: 'المكسيك', minZoom: 2, maxZoom: 7, kind: 'country', priority: 85 },
    { lat: -38.4, lon: -63.6, name: 'الأرجنتين', minZoom: 2, maxZoom: 7, kind: 'country', priority: 85 },
    { lat: 52.1, lon: 19.4, name: 'بولندا', minZoom: 4, maxZoom: 8, kind: 'country', priority: 70 },
    { lat: 52.1, lon: -1.0, name: 'بريطانيا', minZoom: 3, maxZoom: 8, kind: 'country', priority: 85 },
    { lat: 60.1, lon: 18.6, name: 'السويد', minZoom: 4, maxZoom: 8, kind: 'country', priority: 70 },
    { lat: 39.3, lon: 59.6, name: 'تركمانستان', minZoom: 4, maxZoom: 8, kind: 'country', priority: 65 },
    { lat: 48.0, lon: 66.9, name: 'كازاخستان', minZoom: 2, maxZoom: 7, kind: 'country', priority: 80 },
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

const ALL_LABELS = [...continents, ...countries, ...seas, ...cities];

interface ArabicCityLabelsProps {
    /** إطار الوقت الحالي — تُقرأ حرارة المدن من نسيج GFS لهذا الإطار. */
    timeIndex?: number;
    /** ثيم قاعدة الخريطة الفعلي (يتبع الطبقة الفعّالة)؛ يحدّد لون نصّ التسميات. */
    darkBase?: boolean;
}

export function ArabicCityLabels({ timeIndex = 0, darkBase }: ArabicCityLabelsProps) {
    const mapRef = useMapRef();
    const { darkMode, units, setCurrentLocation, setInfoPanelOpen } = useWeatherStore();
    const effectiveDark = darkBase ?? darkMode;
    const hostRef  = useRef<HTMLDivElement | null>(null);
    const animRef  = useRef(0);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        rasterSampler.prefetch('temperature', timeIndex);

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

            const maxLabels = zoom < 3 ? 40 : zoom < 5 ? 60 : 110;
            const chunks: string[] = [];
            let count = 0;

            for (const label of visible) {
                if (count >= maxLabels) break;
                // MapLibre project: takes [lng, lat]
                const pt = mapObj.project([label.lon, label.lat]);
                if (pt.x < -120 || pt.x > w + 120 || pt.y < -60 || pt.y > h + 60) continue;

                const rawTemp = (label.kind === 'city' || label.kind === 'capital')
                    ? rasterSampler.sampleScalar('temperature', timeIndex, label.lat, label.lon) ?? undefined
                    : undefined;
                const temp = rawTemp === undefined ? undefined
                    : units.temperature === 'fahrenheit' ? Math.round((rawTemp * 9) / 5 + 32) : Math.round(rawTemp);
                const base  = label.kind === 'continent' ? 15 : label.kind === 'country' ? 12 : label.kind === 'sea' ? 11 : label.kind === 'capital' ? 11 : 10;
                const boost = Math.max(0, Math.min(4, zoom - 4));
                const dot   = label.kind === 'capital' ? '<i class="label-dot"></i>' : '';
                // شارة الحرارة بخلفية ملوّنة حسب الدرجة (نفس مقياس ألوان Zoom Earth) —
                // اللون يُحسب من القيمة الخام بالسيليزيوس حتى لو عُرضت بالفهرنهايت.
                let badge = '';
                if (temp !== undefined && rawTemp !== undefined) {
                    const bg  = getHeatmapColor(rawTemp, 'temperature') ?? 'rgba(255,160,50,0.95)';
                    const txt = pickTextColor(bg);
                    badge = `<b class="label-temp" style="background:${bg};color:${txt}">${temp}°</b>`;
                }
                const clickable = label.kind !== 'sea';

                chunks.push(`<div class="map-label map-label-${label.kind} ${effectiveDark ? 'dark' : 'light'}${clickable ? ' label-clickable' : ''}"
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
    }, [mapRef, effectiveDark, units.temperature, timeIndex]);

    return null;
}
