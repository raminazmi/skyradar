import axios from 'axios';
import { apiBaseUrl } from './apiBase';

export interface GeocodingResult {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    country_code: string;
    admin1?: string;
    timezone?: string;
    population?: number;
}

export interface ReverseGeocodingResult {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    country_code: string;
    admin1?: string;
    admin2?: string;
    admin3?: string;
    timezone?: string;
}

class GeocodingService {
    private baseUrl = apiBaseUrl;
    private cache = new Map<string, GeocodingResult[]>();
    private readonly maxCacheEntries = 50;
    private inFlightController: AbortController | null = null;

    async searchCities(query: string, limit: number = 5): Promise<GeocodingResult[]> {
        const cacheKey = `${query.trim().toLowerCase()}_${limit}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        // يُلغي أي طلب سابق لم يكتمل بعد — يمنع نتائج بحث قديمة من الوصول بعد
        // نتيجة أحدث (سباق شبكي) ويوفّر طلب HTTP زائد لا حاجة له.
        this.inFlightController?.abort();
        const controller = new AbortController();
        this.inFlightController = controller;

        try {
            const response = await axios.get(`${this.baseUrl}/locations/search`, {
                params: {
                    name: query,
                    count: limit,
                    language: 'ar'
                },
                signal: controller.signal,
            });

            if (!response.data.results) return [];

            const results: GeocodingResult[] = response.data.results.map((result: any) => ({
                name: result.name,
                latitude: result.latitude,
                longitude: result.longitude,
                country: result.country,
                country_code: result.country_code,
                admin1: result.admin1,
                timezone: result.timezone,
                population: result.population
            }));

            this.cache.set(cacheKey, results);
            while (this.cache.size > this.maxCacheEntries) {
                const oldestKey = this.cache.keys().next().value;
                if (!oldestKey) break;
                this.cache.delete(oldestKey);
            }

            return results;
        } catch (error) {
            if (axios.isCancel(error)) return [];
            console.error('خطأ في البحث عن المدن:', error);
            return [];
        }
    }

    async reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodingResult | null> {
        void lat;
        void lon;
        console.warn('Open-Meteo لا يوفر reverse geocoding رسميًا، لذلك تم تعطيل هذا المسار.');
        return null;
    }
}

export const geocodingService = new GeocodingService();
