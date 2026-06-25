import axios from 'axios';
import { apiBaseUrl } from './apiBase';
import { isApiCoolingDown, noteApiFailure, noteApiSuccess } from './apiRateLimit';
import type { ForecastGridType } from '../config/weatherLayers';
import type { WeatherModelId } from '../store/types';

export interface GridPoint {
    lat: number;
    lon: number;
    value: number;
    u?: number;
    v?: number;
    speed?: number;
    direction?: number;
}

export interface WeatherGrid {
    bounds: { north: number; south: number; east: number; west: number };
    rows: number;
    cols: number;
    points: GridPoint[][];
    timestamp: string;
    type: ForecastGridType;
    samplingResolution?: number;
    source?: string;
    provider?: string;
    model?: WeatherModelId;
    runTime?: string;
    validTime?: string;
    unit?: string;
    attribution?: string;
    stale?: boolean;
    providerMessage?: string;
    preview?: boolean;
    fallback?: boolean;
}

type GridBounds = { north: number; south: number; east: number; west: number };

class WeatherGridService {
    private cache = new Map<string, { data: WeatherGrid; timestamp: number }>();
    private inFlight = new Map<string, Promise<WeatherGrid>>();
    private readonly cacheTtl = 30 * 60 * 1000;
    private readonly maxCacheEntries = 80;

    /**
     * عدّادات قياس الأداء (قبل/بعد). افحصها من الكونسول عبر:
     *   weatherGridService.stats
     * cacheHits: خُدمت من كاش الذاكرة بلا شبكة | networkFetches: رحلات فعلية للخادم |
     * avgNetworkMs: متوسّط زمن الرحلة | avgServerMs: متوسّط زمن المعالجة بالخادم (X-Grid-Time-Ms).
     */
    public readonly stats = {
        cacheHits: 0,
        networkFetches: 0,
        totalNetworkMs: 0,
        totalServerMs: 0,
        get avgNetworkMs() { return this.networkFetches ? Math.round(this.totalNetworkMs / this.networkFetches) : 0; },
        get avgServerMs() { return this.networkFetches ? Math.round(this.totalServerMs / this.networkFetches) : 0; },
    };

    private normalizeLongitude(value: number): number {
        return ((((value + 180) % 360) + 360) % 360) - 180;
    }

    private normalizeBounds(bounds: GridBounds): GridBounds {
        const north = Math.min(90, Math.max(-90, Math.max(bounds.north, bounds.south)));
        const south = Math.min(90, Math.max(-90, Math.min(bounds.north, bounds.south)));
        const rawSpan = Math.abs(bounds.east - bounds.west);
        let west = this.normalizeLongitude(bounds.west);
        let east = this.normalizeLongitude(bounds.east);

        if (rawSpan >= 330 || east <= west) {
            west = -180;
            east = 180;
        }

        return {
            north: Number(north.toFixed(1)),
            south: Number(south.toFixed(1)),
            east: Number(east.toFixed(1)),
            west: Number(west.toFixed(1)),
        };
    }

    getCachedGrid(type: ForecastGridType, bounds: GridBounds, model: WeatherModelId, timeIndex = 0, resolution = 30) {
        const safeResolution = this.resolveRequestResolution(bounds, resolution);
        const cached = this.cache.get(this.buildCacheKey(type, bounds, model, timeIndex, safeResolution));
        if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
            return cached.data;
        }

        return null;
    }

    isUsableGrid(grid: WeatherGrid | null | undefined): grid is WeatherGrid {
        if (!grid || grid.rows < 2 || grid.cols < 2 || !Array.isArray(grid.points)) return false;
        return grid.points.some((row) => Array.isArray(row) && row.some((point) => (
            point &&
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon) &&
            Number.isFinite(point.value)
        )));
    }

    isLiveProviderGrid(grid: WeatherGrid | null | undefined): grid is WeatherGrid {
        return this.isUsableGrid(grid) && grid.source !== 'synthetic';
    }

    prefetchGrid(type: ForecastGridType, bounds: GridBounds, model: WeatherModelId, timeIndex = 0, resolution = 30): void {
        const safeResolution = this.resolveRequestResolution(bounds, resolution);
        if (isApiCoolingDown()) return; // لا تحميل مُسبق أثناء التهدئة
        if (timeIndex < 0 || this.getCachedGrid(type, bounds, model, timeIndex, safeResolution)) return;

        const cacheKey = this.buildCacheKey(type, bounds, model, timeIndex, safeResolution);
        if (this.inFlight.has(cacheKey)) return;

        void this.generateGrid(type, bounds, model, timeIndex, safeResolution).catch(() => {
            // Background warming should never interrupt the visible layer.
        });
    }

    async generateGrid(
        type: ForecastGridType,
        bounds: GridBounds,
        model: WeatherModelId,
        timeIndex = 0,
        resolution = 30
    ): Promise<WeatherGrid> {
        const normalizedBounds = this.normalizeBounds(bounds);
        const safeResolution = this.resolveRequestResolution(normalizedBounds, resolution);
        const cacheKey = this.buildCacheKey(type, normalizedBounds, model, timeIndex, safeResolution);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTtl) { this.stats.cacheHits++; return cached.data; }

        const existing = this.inFlight.get(cacheKey);
        if (existing) return existing;

        // قاطع الدائرة: أثناء التهدئة (بعد بلوغ الحصّة) لا نُرسل طلباً جديداً —
        // نعيد آخر نسخة مخزّنة إن وُجدت، وإلا نفشل بهدوء دون إغراق الخادم/الكونسول.
        if (isApiCoolingDown()) {
            if (cached) return cached.data;
            return Promise.reject(new Error('Weather API temporarily unavailable (rate limited).'));
        }

        const startedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const request = axios.get(`${apiBaseUrl}/grid`, {
            params: { ...normalizedBounds, model, type, timeIndex, resolution: safeResolution },
            timeout: 30000,
        })
            .then((response) => {
                const grid = response.data as WeatherGrid;
                noteApiSuccess();
                this.stats.networkFetches++;
                this.stats.totalNetworkMs += (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
                const serverMs = Number(response.headers?.['x-grid-time-ms']);
                if (Number.isFinite(serverMs)) this.stats.totalServerMs += serverMs;
                this.rememberGrid(cacheKey, grid);
                return grid;
            })
            .catch((error) => {
                noteApiFailure(error);
                if (cached) return cached.data;
                throw new Error(error.response?.data?.message ?? 'Unable to fetch live weather grid from the API.');
            })
            .finally(() => {
                this.inFlight.delete(cacheKey);
            });

        this.inFlight.set(cacheKey, request);
        return request;
    }

    private rememberGrid(cacheKey: string, grid: WeatherGrid): void {
        this.cache.set(cacheKey, { data: grid, timestamp: Date.now() });

        while (this.cache.size > this.maxCacheEntries) {
            const oldestKey = this.cache.keys().next().value;
            if (!oldestKey) break;
            this.cache.delete(oldestKey);
        }
    }

    private resolveRequestResolution(bounds: GridBounds, requested: number): number {
        const normalizedBounds = this.normalizeBounds(bounds);
        const latSpan = Math.abs(normalizedBounds.north - normalizedBounds.south);
        const lonSpan = Math.abs(normalizedBounds.east - normalizedBounds.west);
        const span = Math.max(latSpan, lonSpan);

        // دقّة عالية لإظهار التباين الساحلي (بقع اليابسة/البحر) كما في Zoom Earth.
        // البيانات نفسها (GFS/ICON) تحمل تباين البر/البحر؛ تظهره الكثافة العالية فقط.
        if (span >= 90) return Math.min(requested, 24);
        if (span >= 45) return Math.min(requested, 32);
        return requested;
    }

    private buildCacheKey(
        type: ForecastGridType,
        bounds: GridBounds,
        model: WeatherModelId,
        timeIndex: number,
        resolution: number
    ): string {
        const normalizedBounds = this.normalizeBounds(bounds);
        return [
            type,
            model,
            normalizedBounds.north.toFixed(1),
            normalizedBounds.south.toFixed(1),
            normalizedBounds.east.toFixed(1),
            normalizedBounds.west.toFixed(1),
            timeIndex,
            resolution,
        ].join('_');
    }

    interpolate(grid: WeatherGrid, lat: number, lon: number): GridPoint | null {
        const { bounds, rows, cols, points } = grid;
        const normalizedLon = this.normalizeLongitude(lon);
        if (lat < bounds.south || lat > bounds.north || normalizedLon < bounds.west || normalizedLon > bounds.east) {
            return null;
        }

        const fy = ((lat - bounds.south) / (bounds.north - bounds.south)) * (rows - 1);
        const fx = ((normalizedLon - bounds.west) / (bounds.east - bounds.west)) * (cols - 1);
        const i0 = Math.floor(fy);
        const j0 = Math.floor(fx);
        const i1 = Math.min(rows - 1, i0 + 1);
        const j1 = Math.min(cols - 1, j0 + 1);
        const dy = fy - i0;
        const dx = fx - j0;
        const p00 = points[i0][j0];
        const p01 = points[i0][j1];
        const p10 = points[i1][j0];
        const p11 = points[i1][j1];

        if (![p00, p01, p10, p11].every((point) => point && Number.isFinite(point.value))) {
            return null;
        }

        const value =
            p00.value * (1 - dx) * (1 - dy) +
            p01.value * dx * (1 - dy) +
            p10.value * (1 - dx) * dy +
            p11.value * dx * dy;
        const result: GridPoint = { lat, lon, value };

        if (p00.u !== undefined && p01.u !== undefined && p10.u !== undefined && p11.u !== undefined) {
            result.u = p00.u * (1 - dx) * (1 - dy) + p01.u * dx * (1 - dy) + p10.u * (1 - dx) * dy + p11.u * dx * dy;
            result.v = (p00.v ?? 0) * (1 - dx) * (1 - dy) + (p01.v ?? 0) * dx * (1 - dy) + (p10.v ?? 0) * (1 - dx) * dy + (p11.v ?? 0) * dx * dy;
            result.speed = Math.sqrt((result.u ?? 0) ** 2 + (result.v ?? 0) ** 2);
            result.direction = (270 - Math.atan2(result.v ?? 0, result.u ?? 0) * 180 / Math.PI + 360) % 360;
        }

        return result;
    }
}

export const weatherGridService = new WeatherGridService();
