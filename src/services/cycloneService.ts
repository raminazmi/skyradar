import axios from 'axios';
import { apiBaseUrl } from './apiBase';

export interface Cyclone {
    id: string;
    name: string;
    nameAr: string;
    category: number;
    maxWind: number;
    pressure: number;
    lat: number;
    lon: number;
    movement: { dir: number; speed: number };
    track: { lat: number; lon: number; time: string; cat: number }[];
    basin: 'atlantic' | 'pacific' | 'indian';
}

interface CycloneApiItem {
    id?: string;
    name?: string;
    basin?: Cyclone['basin'];
    category?: number;
    max_wind_speed?: number;
    min_pressure?: number;
    latitude?: number;
    longitude?: number;
    movement?: { direction?: number; speed?: number };
    forecast_track?: Array<{ lat?: number; lon?: number; time?: string; wind?: number; category?: number }>;
}

function toCyclone(item: CycloneApiItem): Cyclone | null {
    if (!item.id || !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) return null;

    const category = Number(item.category ?? 0);
    const track = Array.isArray(item.forecast_track) ? item.forecast_track : [];

    return {
        id: item.id,
        name: item.name ?? item.id,
        nameAr: item.name ?? item.id,
        category,
        maxWind: Number(item.max_wind_speed ?? 0),
        pressure: Number(item.min_pressure ?? 0),
        lat: Number(item.latitude),
        lon: Number(item.longitude),
        movement: {
            dir: Number(item.movement?.direction ?? 0),
            speed: Number(item.movement?.speed ?? 0),
        },
        basin: item.basin ?? 'atlantic',
        track: [
            { lat: Number(item.latitude), lon: Number(item.longitude), time: 'now', cat: category },
            ...track.map((point) => ({
                lat: Number(point.lat ?? item.latitude),
                lon: Number(point.lon ?? item.longitude),
                time: point.time ?? '',
                cat: Number(point.category ?? category),
            })),
        ],
    };
}

export async function getActiveCyclones(): Promise<Cyclone[]> {
    // مهلة أطول لتحمّل الإقلاع البارد لخادم Laravel في التطوير.
    const response = await axios.get(`${apiBaseUrl}/cyclones/active`, { timeout: 15000 });
    const cyclones = Array.isArray(response.data?.cyclones) ? response.data.cyclones : [];
    return cyclones
        .map((item: CycloneApiItem) => toCyclone(item))
        .filter((item: Cyclone | null): item is Cyclone => item !== null);
}
