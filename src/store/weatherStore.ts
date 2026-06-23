import { create } from 'zustand';
import { FORECAST_LAYER_IDS } from '../config/weatherLayers';
import { createDefaultLayerAnimationSettings } from '../config/layerAnimation';
import { normalizeLongitude, getResponsivePanelPatch } from './helpers';
import type { LayerKey, WeatherState } from './types';

// إعادة تصدير الأنواع للحفاظ على توافق الاستيراد من '../store/weatherStore'.
export type {
    WeatherHourlyData, WeatherData, MapBounds, LayerKey, WeatherModel, WeatherState,
} from './types';
export { WEATHER_MODELS } from './types';

export const useWeatherStore = create<WeatherState>((set) => ({
    currentLocation: { lat: 24.7136, lon: 46.6753 }, // الرياض
    setCurrentLocation: (lat, lon) => set({ currentLocation: { lat, lon: normalizeLongitude(lon) } }),

    mapBounds: null,
    setMapBounds: (bounds) => set({ mapBounds: bounds }),
    zoomLevel: 4,
    setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

    // نموذجان عالميان لهما raster مُولَّد على السيرفر (GFS من NOAA، ECMWF IFS من open data).
    // ICON أُزيل: شبكته icosahedral تحتاج إعادة تشبيك غير عملية على الاستضافة المشتركة.
    availableModels: [
        { id: 'GFS', name: 'GFS', resolution: '22 كم' },
        { id: 'ECMWF', name: 'ECMWF', resolution: '9 كم' },
    ],
    selectedModel: 'GFS',
    setSelectedModel: (model) => set({ selectedModel: model }),
    initializeModels: async () => {
        // القائمة ثابتة (raster-only): لا نعتمد على قائمة الخادم كي لا يعود ICON.
    },

    visibleLayers: {
        satellite: false,
        precipitation: false,
        wind: true, // الافتراضي مثل zoom.earth
        'wind-gusts': false,
        temperature: false,
        'feels-like': false,
        pressure: false,
        humidity: false,
        dewpoint: false,
        clouds: false,
        radar: false,
        hurricanes: false,
        wildfires: false
    },
    layerAnimationSettings: createDefaultLayerAnimationSettings(),
    updateLayerAnimationSettings: (layer, settings) => set((state) => ({
        layerAnimationSettings: {
            ...state.layerAnimationSettings,
            [layer]: { ...state.layerAnimationSettings[layer], ...settings },
        },
    })),
    setLayerParticlesEnabled: (layer, enabled) => set((state) => ({
        layerAnimationSettings: {
            ...state.layerAnimationSettings,
            [layer]: { ...state.layerAnimationSettings[layer], particlesEnabled: enabled },
        },
    })),
    setActiveLayer: (layer) => set((state) => {
        // إخفاء جميع طبقات الخريطة الحرارية، وتفعيل المختارة فقط
        const exclusive: LayerKey[] = [...FORECAST_LAYER_IDS];
        const newLayers = { ...state.visibleLayers };
        if (exclusive.includes(layer)) {
            exclusive.forEach(l => { newLayers[l] = false; });
            newLayers[layer] = true;
        } else {
            newLayers[layer] = !newLayers[layer];
        }
        return { visibleLayers: newLayers };
    }),
    toggleLayer: (layer) => set((state) => ({
        visibleLayers: {
            ...state.visibleLayers,
            [layer]: !state.visibleLayers[layer]
        }
    })),
    closeAllLayers: () => set((state) => {
        const newLayers = { ...state.visibleLayers };
        Object.keys(newLayers).forEach(k => { newLayers[k as LayerKey] = false; });
        return { visibleLayers: newLayers };
    }),

    currentTimeIndex: 0,
    setCurrentTimeIndex: (index) => set({ currentTimeIndex: index }),
    isPlaying: false,
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    playbackSpeed: 1,
    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

    weatherData: null,
    setWeatherData: (data) => set({ weatherData: data }),
    isLoading: false,
    setIsLoading: (loading) => set({ isLoading: loading }),

    units: {
        temperature: 'celsius',
        wind: 'kmh',
        pressure: 'hPa',
        precipitation: 'mm'
    },
    setUnits: (units) => set((state) => ({
        units: { ...state.units, ...units }
    })),
    darkMode: true,
    setDarkMode: (dark) => set({ darkMode: dark }),

    showHurricanes: false,
    setShowHurricanes: (show) => set({ showHurricanes: show }),
    showWildfires: false,
    setShowWildfires: (show) => set({ showWildfires: show }),

    satelliteMode: 'live',
    setSatelliteMode: (mode) => set({ satelliteMode: mode }),

    sidebarOpen: false,
    setSidebarOpen: (open) => set(open ? getResponsivePanelPatch('sidebarOpen') : { sidebarOpen: false }),
    layerControlsOpen: false,
    setLayerControlsOpen: (open) => set(open ? getResponsivePanelPatch('layerControlsOpen') : { layerControlsOpen: false }),
    infoPanelOpen: false,
    setInfoPanelOpen: (open) => set(open ? getResponsivePanelPatch('infoPanelOpen') : { infoPanelOpen: false }),
    settingsOpen: false,
    setSettingsOpen: (open) => set(open ? getResponsivePanelPatch('settingsOpen') : { settingsOpen: false }),
    searchOpen: false,
    setSearchOpen: (open) => set({ searchOpen: open }),
    isobarsEnabled: true,
    setIsobarsEnabled: (enabled) => set({ isobarsEnabled: enabled }),
    legendOpen: true,
    setLegendOpen: (open) => set({ legendOpen: open }),

    // Modal state
    modalOpen: false,
    setModalOpen: (open) => set(open ? getResponsivePanelPatch('modalOpen') : { modalOpen: false }),
    modalCityName: '',
    setModalCityName: (name) => set({ modalCityName: name }),
    modalCountryName: '',
    setModalCountryName: (name) => set({ modalCountryName: name }),
    modalWeatherData: null,
    setModalWeatherData: (data) => set({ modalWeatherData: data }),
    modalLoading: false,
    setModalLoading: (loading) => set({ modalLoading: loading }),
    modalLatitude: 0,
    setModalLatitude: (lat) => set({ modalLatitude: lat }),
    modalLongitude: 0,
    setModalLongitude: (lon) => set({ modalLongitude: normalizeLongitude(lon) }),
}));
