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

    async searchCities(query: string, limit: number = 5): Promise<GeocodingResult[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/locations/search`, {
                params: {
                    name: query,
                    count: limit,
                    language: 'ar'
                }
            });

            if (!response.data.results) return [];

            return response.data.results.map((result: any) => ({
                name: result.name,
                latitude: result.latitude,
                longitude: result.longitude,
                country: result.country,
                country_code: result.country_code,
                admin1: result.admin1,
                timezone: result.timezone,
                population: result.population
            }));
        } catch (error) {
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
