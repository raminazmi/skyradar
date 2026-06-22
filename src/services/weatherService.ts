import axios from 'axios';
import { apiBaseUrl } from './apiBase';
import { isApiCoolingDown, noteApiFailure, noteApiSuccess } from './apiRateLimit';

export interface WeatherResponse {
    latitude: number;
    longitude: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    stale?: boolean;
    providerMessage?: string;
    model?: 'GFS' | 'ICON';
    hourly: {
        time: Array<string | number>;
        temperature_2m: number[];
        apparent_temperature: number[];
        dew_point_2m: number[];
        relative_humidity_2m: number[];
        wind_speed_10m: number[];
        wind_direction_10m: number[];
        wind_gusts_10m: number[];
        precipitation: number[];
        rain: number[];
        snowfall: number[];
        weather_code: number[];
        cloud_cover: number[];
        surface_pressure: number[];
        visibility: number[];
    };
    current?: {
        time: string | number;
        temperature_2m: number;
        wind_speed_10m: number;
        weather_code: number;
    };
}

class WeatherService {
    private baseUrl = apiBaseUrl;
    private cache = new Map<string, { data: WeatherResponse; timestamp: number }>();
    private inFlight = new Map<string, Promise<WeatherResponse>>();
    private readonly cacheTtl = 15 * 60 * 1000;

    private normalizeLongitude(value: number): number {
        return ((((value + 180) % 360) + 360) % 360) - 180;
    }

    private buildCacheKey(lat: number, lon: number, model: 'GFS' | 'ICON', hours: number): string {
        return [lat.toFixed(3), lon.toFixed(3), model, hours].join('_');
    }

    private normalizeTimes(times: Array<string | number>): string[] {
        return times.map((time) => String(time));
    }

    async getAvailableModels(): Promise<any[]> {
        const response = await axios.get(`${this.baseUrl}/models`);
        return response.data.models;
    }

    async getWeatherData(
        lat: number,
        lon: number,
        model: 'GFS' | 'ICON' = 'GFS',
        hours: number = 168
    ): Promise<WeatherResponse> {
        const normalizedLon = this.normalizeLongitude(lon);
        const cacheKey = this.buildCacheKey(lat, normalizedLon, model, hours);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
            return cached.data;
        }

        const existing = this.inFlight.get(cacheKey);
        if (existing) return existing;

        // قاطع الدائرة: أثناء التهدئة لا نُرسل طلباً جديداً للمزوّد.
        if (isApiCoolingDown()) {
            if (cached) return cached.data;
            return Promise.reject(new Error('Weather API temporarily unavailable (rate limited).'));
        }

        const request = axios.get(`${this.baseUrl}/forecast`, {
            params: { latitude: lat, longitude: normalizedLon, model, hours },
            timeout: 30000,
        })
            .then((response) => {
                const data = response.data as WeatherResponse;
                noteApiSuccess();
                this.cache.set(cacheKey, { data, timestamp: Date.now() });
                return data;
            })
            .catch((error) => {
                noteApiFailure(error);
                if (cached) return cached.data;
                throw new Error(error.response?.data?.message ?? 'Unable to fetch live weather data from the API.');
            })
            .finally(() => {
                this.inFlight.delete(cacheKey);
            });

        this.inFlight.set(cacheKey, request);
        return request;
    }

    async getWindData(lat: number, lon: number, model: 'GFS' | 'ICON' = 'GFS', hours = 48) {
        const data = await this.getWeatherData(lat, lon, model, hours);
        return {
            time: this.normalizeTimes(data.hourly.time),
            windSpeed: data.hourly.wind_speed_10m,
            windDirection: data.hourly.wind_direction_10m,
            windGusts: data.hourly.wind_gusts_10m,
        };
    }

    async getPrecipitationData(lat: number, lon: number, model: 'GFS' | 'ICON' = 'GFS', hours = 168) {
        const data = await this.getWeatherData(lat, lon, model, hours);
        return {
            time: this.normalizeTimes(data.hourly.time),
            precipitation: data.hourly.precipitation,
            rain: data.hourly.rain,
            snowfall: data.hourly.snowfall,
        };
    }

    async getTemperatureData(lat: number, lon: number, model: 'GFS' | 'ICON' = 'GFS', hours = 168) {
        const data = await this.getWeatherData(lat, lon, model, hours);
        return {
            time: this.normalizeTimes(data.hourly.time),
            temperature: data.hourly.temperature_2m,
            apparentTemperature: data.hourly.apparent_temperature,
            dewPoint: data.hourly.dew_point_2m,
        };
    }

    async getPressureData(lat: number, lon: number, model: 'GFS' | 'ICON' = 'GFS', hours = 168) {
        const data = await this.getWeatherData(lat, lon, model, hours);
        return { time: this.normalizeTimes(data.hourly.time), pressure: data.hourly.surface_pressure };
    }

    async getHumidityData(lat: number, lon: number, model: 'GFS' | 'ICON' = 'GFS', hours = 168) {
        const data = await this.getWeatherData(lat, lon, model, hours);
        return {
            time: this.normalizeTimes(data.hourly.time),
            humidity: data.hourly.relative_humidity_2m,
            dewPoint: data.hourly.dew_point_2m,
        };
    }

    async getCloudData(lat: number, lon: number, model: 'GFS' | 'ICON' = 'GFS', hours = 168) {
        const data = await this.getWeatherData(lat, lon, model, hours);
        return { time: this.normalizeTimes(data.hourly.time), cloudCover: data.hourly.cloud_cover };
    }

    /**
     * Determine whether a given moment is "day" or "night".
     * Falls back to a simple 6:00-18:00 local-hour heuristic when no
     * sunrise/sunset data is available.
     */
    isDaytime(date: Date = new Date()): boolean {
        const hour = date.getHours();
        return hour >= 6 && hour < 18;
    }

    decodeWeatherCode(
        code: number,
        isDay: boolean = true
    ): { condition: string; icon: string; description: string } {
        const codes: Record<number, { condition: string; icon: string; description: string }> = {
            0: {
                condition: 'Clear sky',
                icon: isDay ? 'clear-day' : 'clear-night',
                description: 'Clear sky',
            },
            1: {
                condition: 'Mainly clear',
                icon: isDay ? 'partly-cloudy-day' : 'partly-cloudy-night',
                description: 'Mainly clear',
            },
            2: {
                condition: 'Partly cloudy',
                icon: isDay ? 'partly-cloudy-day-alt' : 'partly-cloudy-night-alt',
                description: 'Partly cloudy',
            },
            3: { condition: 'Overcast', icon: 'overcast', description: 'Overcast' },
            45: { condition: 'Fog', icon: 'overcast-alt', description: 'Fog' },
            48: { condition: 'Rime fog', icon: 'overcast-alt', description: 'Depositing rime fog' },
            51: {
                condition: 'Light drizzle',
                icon: isDay ? 'rain-day' : 'rain-night',
                description: 'Light drizzle',
            },
            53: {
                condition: 'Moderate drizzle',
                icon: isDay ? 'rain-day' : 'rain-night',
                description: 'Moderate drizzle',
            },
            55: { condition: 'Dense drizzle', icon: 'rain-heavy', description: 'Dense drizzle' },
            61: {
                condition: 'Light rain',
                icon: isDay ? 'rain-day' : 'rain-night',
                description: 'Slight rain',
            },
            63: { condition: 'Moderate rain', icon: 'rain-generic', description: 'Moderate rain' },
            65: { condition: 'Heavy rain', icon: 'rain-heavy', description: 'Heavy rain' },
            71: { condition: 'Light snow', icon: 'snow', description: 'Slight snow' },
            73: { condition: 'Moderate snow', icon: 'snow', description: 'Moderate snow' },
            75: { condition: 'Heavy snow', icon: 'snow-generic', description: 'Heavy snow' },
            80: {
                condition: 'Light showers',
                icon: isDay ? 'rain-day' : 'rain-night',
                description: 'Slight rain showers',
            },
            81: { condition: 'Moderate showers', icon: 'rain-wind', description: 'Moderate rain showers' },
            82: { condition: 'Heavy showers', icon: 'storm-generic', description: 'Violent rain showers' },
            95: {
                condition: 'Thunderstorm',
                icon: isDay ? 'storm-day' : 'storm-night',
                description: 'Thunderstorm',
            },
            96: { condition: 'Thunderstorm + hail', icon: 'storm-generic', description: 'Thunderstorm with hail' },
            99: {
                condition: 'Thunderstorm + hail',
                icon: 'storm-generic',
                description: 'Thunderstorm with heavy hail',
            },
        };

        return codes[code] || { condition: 'Unknown', icon: 'overcast', description: 'Unknown condition' };
    }

    convertTemperature(temp: number, toFahrenheit: boolean): number {
        return toFahrenheit ? (temp * 9 / 5) + 32 : temp;
    }

    convertWindSpeed(speed: number, unit: 'kmh' | 'mph' | 'ms' | 'knots'): number {
        switch (unit) {
            case 'mph': return speed * 0.621371;
            case 'knots': return speed * 0.539957;
            case 'ms': return speed / 3.6;
            default: return speed;
        }
    }

    convertPressure(pressure: number, toInHg: boolean): number {
        return toInHg ? pressure / 33.8639 : pressure;
    }

    convertPrecipitation(precip: number, toInch: boolean): number {
        return toInch ? precip / 25.4 : precip;
    }
}

export const weatherService = new WeatherService();
