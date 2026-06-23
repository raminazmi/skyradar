/**
 * store/types.ts
 * أنواع متجر الطقس (Zustand). مفصولة لإبقاء weatherStore.ts < 300 سطر.
 */

import type { LayerAnimationSettings } from '../config/layerAnimation';

export interface WeatherHourlyData {
    time: Array<string | number>;
    temperature_2m?: number[];
    apparent_temperature?: number[];
    dew_point_2m?: number[];
    relative_humidity_2m?: number[];
    wind_speed_10m?: number[];
    wind_direction_10m?: number[];
    wind_gusts_10m?: number[];
    precipitation?: number[];
    rain?: number[];
    snowfall?: number[];
    weather_code?: number[];
    cloud_cover?: number[];
    surface_pressure?: number[];
    visibility?: number[];
}

export interface WeatherData {
    latitude: number;
    longitude: number;
    timezone?: string;
    timezone_abbreviation?: string;
    elevation?: number;
    stale?: boolean;
    providerMessage?: string;
    model?: 'GFS' | 'ECMWF';
    hourly: WeatherHourlyData;
    current?: any;
}

export interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

export type LayerKey =
    | 'satellite'
    | 'precipitation'
    | 'wind'
    | 'wind-gusts'
    | 'temperature'
    | 'feels-like'
    | 'pressure'
    | 'humidity'
    | 'dewpoint'
    | 'clouds'
    | 'radar'
    | 'hurricanes'
    | 'wildfires';

export interface WeatherModel {
    id: 'GFS' | 'ECMWF';
    name: string;
    resolution: string;
}

export const WEATHER_MODELS: WeatherModel[] = []; // تُملأ ديناميكياً

export interface WeatherState {
    currentLocation: { lat: number; lon: number } | null;
    setCurrentLocation: (lat: number, lon: number) => void;

    mapBounds: MapBounds | null;
    setMapBounds: (bounds: MapBounds) => void;
    zoomLevel: number;
    setZoomLevel: (zoom: number) => void;

    availableModels: WeatherModel[];
    selectedModel: 'GFS' | 'ECMWF';
    setSelectedModel: (model: 'GFS' | 'ECMWF') => void;
    initializeModels: () => Promise<void>;

    visibleLayers: Record<LayerKey, boolean>;
    setActiveLayer: (layer: LayerKey) => void;
    toggleLayer: (layer: LayerKey) => void;
    closeAllLayers: () => void;
    layerAnimationSettings: Record<LayerKey, LayerAnimationSettings>;
    updateLayerAnimationSettings: (layer: LayerKey, settings: Partial<LayerAnimationSettings>) => void;
    setLayerParticlesEnabled: (layer: LayerKey, enabled: boolean) => void;

    currentTimeIndex: number;
    setCurrentTimeIndex: (index: number) => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    playbackSpeed: number;
    setPlaybackSpeed: (speed: number) => void;

    weatherData: WeatherData | null;
    setWeatherData: (data: WeatherData) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;

    units: {
        temperature: 'celsius' | 'fahrenheit';
        wind: 'kmh' | 'mph' | 'ms' | 'knots';
        pressure: 'hPa' | 'inHg';
        precipitation: 'mm' | 'inch';
    };
    setUnits: (units: Partial<WeatherState['units']>) => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;

    showHurricanes: boolean;
    setShowHurricanes: (show: boolean) => void;
    showWildfires: boolean;
    setShowWildfires: (show: boolean) => void;

    satelliteMode: 'live' | 'hd';
    setSatelliteMode: (mode: 'live' | 'hd') => void;

    // حالة الواجهة — ظهور اللوحات
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    layerControlsOpen: boolean;
    setLayerControlsOpen: (open: boolean) => void;
    infoPanelOpen: boolean;
    setInfoPanelOpen: (open: boolean) => void;
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    searchOpen: boolean;
    setSearchOpen: (open: boolean) => void;
    legendOpen: boolean;
    setLegendOpen: (open: boolean) => void;

    // حالة النافذة المنبثقة
    modalOpen: boolean;
    setModalOpen: (open: boolean) => void;
    modalCityName: string;
    setModalCityName: (name: string) => void;
    modalCountryName: string;
    setModalCountryName: (name: string) => void;
    modalWeatherData: any;
    setModalWeatherData: (data: any) => void;
    modalLoading: boolean;
    setModalLoading: (loading: boolean) => void;
    modalLatitude: number;
    setModalLatitude: (lat: number) => void;
    modalLongitude: number;
    setModalLongitude: (lon: number) => void;
}
