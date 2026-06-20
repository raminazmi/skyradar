import axios from 'axios';
import { apiBaseUrl } from './apiBase';

export interface WildfireHotspot {
    id: string;
    name: string;
    lat: number;
    lon: number;
    confidence: 'low' | 'medium' | 'high';
    intensity: number;
    observed: string;
}

interface WildfireApiItem {
    id?: string | number;
    latitude?: number | string;
    longitude?: number | string;
    confidence?: number | string;
    frp?: number | string;
    acq_date?: string;
    acq_time?: string;
    satellite?: string;
    source?: string;
}

function normalizeConfidence(value: unknown): WildfireHotspot['confidence'] {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        if (numeric >= 80) return 'high';
        if (numeric >= 50) return 'medium';
    }

    const text = String(value ?? '').toLowerCase();
    if (text.includes('high')) return 'high';
    if (text.includes('medium') || text.includes('nominal')) return 'medium';
    return 'low';
}

function normalizeIntensity(value: unknown): number {
    const frp = Number(value);
    if (!Number.isFinite(frp) || frp <= 0) return 0.2;
    return Math.max(0.15, Math.min(1, frp / 500));
}

function toHotspot(item: WildfireApiItem, index: number): WildfireHotspot | null {
    const lat = Number(item.latitude);
    const lon = Number(item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return {
        id: String(item.id ?? `${lat.toFixed(4)}_${lon.toFixed(4)}_${index}`),
        name: item.satellite ? `NASA FIRMS ${item.satellite}` : 'NASA FIRMS hotspot',
        lat,
        lon,
        confidence: normalizeConfidence(item.confidence),
        intensity: normalizeIntensity(item.frp),
        observed: [item.acq_date, item.acq_time].filter(Boolean).join(' ') || item.source || 'NASA FIRMS',
    };
}

export async function getWildfiresForBounds(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
}): Promise<WildfireHotspot[]> {
    const response = await axios.get(`${apiBaseUrl}/wildfires/region`, {
        params: { ...bounds, limit: 500 },
        timeout: 7000,
    });

    const fires = Array.isArray(response.data?.fires) ? response.data.fires : [];
    return fires
        .map((item: WildfireApiItem, index: number) => toHotspot(item, index))
        .filter((item: WildfireHotspot | null): item is WildfireHotspot => item !== null);
}
