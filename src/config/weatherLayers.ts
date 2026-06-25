import type { IconType } from 'react-icons';
import {
    FiActivity,
    FiCloud,
    FiCloudRain,
    FiDroplet,
    FiMap,
    FiRadio,
    FiThermometer,
    FiWind,
    FiZap,
} from 'react-icons/fi';
import type { LayerKey } from '../store/weatherStore';

export type ForecastGridType =
    | 'wind'
    | 'wind-gusts'
    | 'precipitation'
    | 'temperature'
    | 'feels-like'
    | 'wet-bulb'
    | 'pressure'
    | 'humidity'
    | 'dewpoint'
    | 'clouds';

export type LayerKind = 'forecast-scalar' | 'forecast-vector' | 'tile-raster' | 'point-overlay';
export type TimeMode = 'forecast' | 'observed-past' | 'near-real-time' | 'static';
export type DataSource = 'open-meteo' | 'rainviewer' | 'nasa-gibs' | 'nasa-firms' | 'local';

export interface WeatherLayerConfig {
    id: LayerKey;
    labelAr: string;
    labelEn: string;
    kind: LayerKind;
    timeMode: TimeMode;
    source: DataSource;
    sourceLabel: string;
    variables: string[];
    unit: string;
    color: string;
    icon: IconType;
    attribution: string;
    apiType?: ForecastGridType;
    descriptionAr: string;
    opacity: number;
    updateIntervalMinutes: number;
}

export const FORECAST_LAYER_IDS: ForecastGridType[] = [
    'wind',
    'wind-gusts',
    'precipitation',
    'temperature',
    'feels-like',
    'wet-bulb',
    'pressure',
    'humidity',
    'dewpoint',
    'clouds',
];

export const TILE_OVERLAY_LAYER_IDS: LayerKey[] = ['satellite', 'radar'];

export const WEATHER_LAYER_CONFIGS: Record<LayerKey, WeatherLayerConfig> = {
    wind: {
        id: 'wind',
        labelAr: 'الرياح',
        labelEn: 'Wind speed',
        kind: 'forecast-vector',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['wind_speed_10m', 'wind_direction_10m'],
        unit: 'km/h',
        color: '#42a5f5',
        icon: FiWind,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'wind',
        descriptionAr: 'خريطة سرعة الرياح مع جسيمات متحركة فوقها لقراءة الاتجاه والحركة.',
        opacity: 0.66,
        updateIntervalMinutes: 60,
    },
    'wind-gusts': {
        id: 'wind-gusts',
        labelAr: 'هبّات الرياح',
        labelEn: 'Wind gusts',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['wind_gusts_10m'],
        unit: 'km/h',
        color: '#64b5f6',
        icon: FiWind,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'wind-gusts',
        descriptionAr: 'أعلى سرعة رياح متوقعة في الهبات، مفيدة لتمييز مناطق الخطر عن سرعة الرياح المتوسطة.',
        opacity: 0.64,
        updateIntervalMinutes: 60,
    },
    precipitation: {
        id: 'precipitation',
        labelAr: 'هطول الأمطار',
        labelEn: 'Precipitation forecast',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['precipitation', 'rain', 'snowfall'],
        unit: 'mm/h',
        color: '#1e88e5',
        icon: FiCloudRain,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'precipitation',
        descriptionAr: 'توقعات الهطول من النموذج العددي، وهي منفصلة عن الرادار المرصود.',
        opacity: 0.7,
        updateIntervalMinutes: 60,
    },
    temperature: {
        id: 'temperature',
        labelAr: 'درجة الحرارة',
        labelEn: 'Temperature',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['temperature_2m'],
        unit: 'C',
        color: '#ef5350',
        icon: FiThermometer,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'temperature',
        descriptionAr: 'درجة الحرارة عند ارتفاع مترين فوق السطح.',
        opacity: 0.66,
        updateIntervalMinutes: 60,
    },
    'feels-like': {
        id: 'feels-like',
        labelAr: 'الإحساس الحراري',
        labelEn: 'Feels like',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['apparent_temperature'],
        unit: 'C',
        color: '#ff8a65',
        icon: FiThermometer,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'feels-like',
        descriptionAr: 'درجة الحرارة المحسوسة بعد تأثير الرطوبة والرياح.',
        opacity: 0.64,
        updateIntervalMinutes: 60,
    },
    'wet-bulb': {
        id: 'wet-bulb',
        labelAr: 'اللمبة الرطبة',
        labelEn: 'Wet-bulb temperature',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'local',
        sourceLabel: 'مُشتقّة من الحرارة والرطوبة (GFS/ECMWF)',
        variables: ['temperature_2m', 'relative_humidity_2m'],
        unit: 'C',
        color: '#c81e96',
        icon: FiThermometer,
        attribution: 'مُشتقّة محلياً (صيغة Stull) من نُسج NOAA GFS / ECMWF',
        apiType: 'wet-bulb',
        descriptionAr: 'درجة حرارة اللمبة الرطبة — مؤشّر إجهاد حراري؛ تجاوز ~31°م خطير و~35°م حدّ بقاء الإنسان.',
        opacity: 0.66,
        updateIntervalMinutes: 60,
    },
    pressure: {
        id: 'pressure',
        labelAr: 'الضغط الجوي',
        labelEn: 'Surface pressure',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['surface_pressure'],
        unit: 'hPa',
        color: '#ab47bc',
        icon: FiActivity,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'pressure',
        descriptionAr: 'ضغط السطح من النموذج، وتمهيد لاحق لخطوط الضغط.',
        opacity: 0.6,
        updateIntervalMinutes: 60,
    },
    humidity: {
        id: 'humidity',
        labelAr: 'الرطوبة النسبية',
        labelEn: 'Relative humidity',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['relative_humidity_2m'],
        unit: '%',
        color: '#26c6da',
        icon: FiDroplet,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'humidity',
        descriptionAr: 'الرطوبة النسبية عند ارتفاع مترين.',
        opacity: 0.62,
        updateIntervalMinutes: 60,
    },
    dewpoint: {
        id: 'dewpoint',
        labelAr: 'نقطة الندى',
        labelEn: 'Dew point',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['dew_point_2m'],
        unit: 'C',
        color: '#00acc1',
        icon: FiDroplet,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'dewpoint',
        descriptionAr: 'طبقة مستقلة لفهم الرطوبة الفعلية وليس النسبة فقط.',
        opacity: 0.62,
        updateIntervalMinutes: 60,
    },
    clouds: {
        id: 'clouds',
        labelAr: 'الغيوم',
        labelEn: 'Cloud cover',
        kind: 'forecast-scalar',
        timeMode: 'forecast',
        source: 'open-meteo',
        sourceLabel: 'Open-Meteo GFS/ICON',
        variables: ['cloud_cover'],
        unit: '%',
        color: '#90a4ae',
        icon: FiCloud,
        attribution: 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
        apiType: 'clouds',
        descriptionAr: 'تغطية سحابية متوقعة من النموذج.',
        opacity: 0.5,
        updateIntervalMinutes: 60,
    },
    radar: {
        id: 'radar',
        labelAr: 'رادار المطر',
        labelEn: 'Observed radar',
        kind: 'tile-raster',
        timeMode: 'observed-past',
        source: 'rainviewer',
        sourceLabel: 'RainViewer',
        variables: ['radar-reflectivity'],
        unit: 'dBZ',
        color: '#64b5f6',
        icon: FiRadio,
        attribution: 'RainViewer weather radar',
        descriptionAr: 'أمطار مرصودة شبه حية، وليست توقعات النموذج.',
        opacity: 0.72,
        updateIntervalMinutes: 10,
    },
    satellite: {
        id: 'satellite',
        labelAr: 'قمر صناعي',
        labelEn: 'Satellite imagery',
        kind: 'tile-raster',
        timeMode: 'near-real-time',
        source: 'nasa-gibs',
        sourceLabel: 'NASA GIBS',
        variables: ['VIIRS_SNPP_CorrectedReflectance_TrueColor'],
        unit: 'imagery',
        color: '#8bc34a',
        icon: FiMap,
        attribution: 'NASA GIBS',
        descriptionAr: 'صور أقمار صناعية مجانية عبر WMTS، وقد تتأخر عن الزمن الحقيقي.',
        opacity: 0.82,
        updateIntervalMinutes: 180,
    },
    hurricanes: {
        id: 'hurricanes',
        labelAr: 'الأعاصير',
        labelEn: 'Tropical cyclones',
        kind: 'point-overlay',
        timeMode: 'near-real-time',
        source: 'local',
        sourceLabel: 'Local tracker',
        variables: ['track', 'category', 'wind'],
        unit: 'track',
        color: '#ff5722',
        icon: FiZap,
        attribution: 'Local demo tracker',
        descriptionAr: 'متتبع أنظمة مدارية، ويحتاج مصدرًا رسميًا لاحقًا للإنتاج.',
        opacity: 1,
        updateIntervalMinutes: 60,
    },
    wildfires: {
        id: 'wildfires',
        labelAr: 'الحرائق',
        labelEn: 'Wildfires',
        kind: 'point-overlay',
        timeMode: 'near-real-time',
        source: 'nasa-firms',
        sourceLabel: 'NASA FIRMS',
        variables: ['hotspots'],
        unit: 'points',
        color: '#ff7043',
        icon: FiZap,
        attribution: 'NASA FIRMS, free key required for production',
        descriptionAr: 'نقاط ساخنة من FIRMS، تحتاج مفتاحًا مجانيًا للإنتاج.',
        opacity: 1,
        updateIntervalMinutes: 180,
    },
};

export function getLayerConfig(layer: LayerKey): WeatherLayerConfig {
    return WEATHER_LAYER_CONFIGS[layer];
}
