/**
 * NewWeatherMap.tsx — MapLibre version
 * الخريطة الرئيسية — تعمل بمحرك MapLibre GL بدلاً من Leaflet
 *
 * المكتبة: react-map-gl/maplibre  (مجانية، مفتوحة المصدر، مبنية على OpenStreetMap)
 * الخريطة: CartoDB Dark Matter (تصميم داكن مجاني مبني على OSM)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { LayerSidebar }     from './LayerSidebar';
import { TimeSlider }       from './TimeSlider';
import { WeatherInfoPanel } from './WeatherInfoPanel';
import { LayerControls }    from './LayerControls';
import { SettingsPanel }    from './SettingsPanel';
import { HeatmapWebGLLayer }   from './HeatmapWebGLLayer';
import { TiledHeatmapWebGLLayer } from './TiledHeatmapWebGLLayer';
import { RasterHeatmapWebGLLayer } from './RasterHeatmapWebGLLayer';
import { HoverValueTooltip }    from './HoverValueTooltip';
import { ParticleWebGLLayer }  from './ParticleWebGLLayer';
import { ArabicCityLabels }    from './ArabicCityLabels';
import { RightToolbar }        from './RightToolbar';
import { CentralLegend }       from './CentralLegend';
import { CycloneTracker }      from './CycloneTracker';
import { RadarTileLayer }      from './RadarTileLayer';
import { SatelliteTileLayer }  from './SatelliteTileLayer';
import { WildfireLayer }       from './WildfireLayer';
import { MapContext }           from './MapContext';

import { useWeatherStore }    from '../../store/weatherStore';
import { useWeatherData }     from './hooks/useWeatherData';
import { weatherGridService } from '../../services/weatherGridService';
import { getStableGridBounds } from './utils/gridBounds';
import { layerBaseIsDark }     from './webgl/layerOrder';
import { useAutoplay }        from './hooks/useAutoplay';
import { useMapStyling }      from './hooks/useMapStyling';
import { useTiledHeatmap }    from './hooks/useTiledHeatmap';
import { useWindRaster }      from './hooks/useWindRaster';
import { FORECAST_LAYER_IDS, type ForecastGridType } from '../../config/weatherLayers';
import { FiMapPin }           from 'react-icons/fi';

import './WeatherMap.css';

// ── خريطة الأساس — CartoDB Dark Matter (مبنية على OpenStreetMap، مجانية) ─────
const DARK_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// الطبقات ذات نسيج عالمي خام (GFS GRIB2 بدقّة 0.25° كاملة من NOAA، مجاناً، بلا Open-Meteo).
// كلّها متاحة في منتج GFS pgrb2 الأساسي. (الإحساس الحراري APTMP في المنتج الثانوي فيبقى
// على البلاطات؛ والرياح تحتاج قناتي U/V + جسيمات فتُعالَج لاحقاً.)
// ثابت على مستوى الوحدة كي لا يتغيّر مرجعه كل تصيير فيُعيد اشتراك التشغيل بلا داعٍ.
const RASTER_TYPES = new Set<string>([
    'temperature', 'dewpoint', 'humidity', 'pressure', 'clouds', 'wind-gusts', 'precipitation',
]);

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewWeatherMap() {
    const {
        currentLocation, selectedModel, visibleLayers, darkMode,
        weatherData, currentTimeIndex, isPlaying, playbackSpeed,
        settingsOpen, setSettingsOpen,
        infoPanelOpen, layerControlsOpen, sidebarOpen,
        mapBounds, zoomLevel,
        setCurrentLocation, setInfoPanelOpen, setCurrentTimeIndex,
        setMapBounds, setZoomLevel,
        initializeModels,
        layerAnimationSettings,
    } = useWeatherStore();

    const mapRef = useRef<MapRef | null>(null);

    // ── Init ───────────────────────────────────────────────────────────────
    useEffect(() => { initializeModels(); }, []);

    // ── خطافات الجلب والتنسيق (مُستخرَجة لإبقاء الملف < 300 سطر) ──────────────
    useWeatherData({ currentLocation, selectedModel });

    // الطبقة السلَّمية الفعّالة (حرارة/ضغط…) تُشتقّ من الطبقات المرئية مباشرةً — بلا أي
    // جلب نقاط من Open-Meteo (مصدر العرض نُسج PNG محلّية).
    const activeHeatmapType: ForecastGridType | null = useMemo(() => {
        const heatmapTypes = FORECAST_LAYER_IDS.filter((l) => l !== 'wind');
        return heatmapTypes.find((t) => visibleLayers[t]) ?? null;
    }, [visibleLayers]);

    // حقل الرياح من نسيج GFS المحلّي (R=سرعة، G/B=U/V) — يغذّي الجسيمات وطبقة لون الرياح
    // وتلميح الرياح بلا Open-Meteo.
    const windGrid = useWindRaster(currentTimeIndex);

    // نُسج GFS الخام متاحة لنموذج GFS فقط؛ عند اختيار ICON نعود لمسار البلاطات (Open-Meteo
    // يخدم ICON) فتتغيّر بيانات الخريطة فعلياً مع المبدّل. (نُسج ICON من DWD لاحقاً.)
    const useRaster = !!activeHeatmapType && RASTER_TYPES.has(activeHeatmapType) && selectedModel === 'GFS';

    // بلاطات الطبقة العددية الفعّالة (لغير طبقات النسيج) — تُجلب وتُعرض مربّعاً مربّعاً.
    const scalarTiles = useTiledHeatmap({
        mapBounds, mapZoom: zoomLevel ?? 4, selectedModel, currentTimeIndex,
        activeType: useRaster ? null : activeHeatmapType,
    });

    // جهوزية إطار التشغيل: نتقدّم فقط عندما تكون شبكة الطبقة الفعّالة لذلك الإطار
    // مخزّنة (وإلا نحفّز تحميلها مسبقاً وننتظر) — فلا يظهر إطار مجمّد أثناء التشغيل.
    const playbackCanAdvance = useCallback((idx: number) => {
        if (!mapBounds) return true;
        const type = activeHeatmapType ?? (visibleLayers.wind ? 'wind' : null);
        if (!type) return true;
        // الطبقات النسيجية (حرارة/رياح…) تُحمّل صورتها لكل ساعة محلّياً، فلا نُعلّق
        // التشغيل على شبكة نقاط (لا 429). يبقى مسار البلاطات لغير النسيج (ICON) فقط.
        if (type === 'wind' || RASTER_TYPES.has(type)) return true;
        const bounds = getStableGridBounds(mapBounds);
        if (weatherGridService.getCachedGrid(type, bounds, selectedModel, idx, 6)) return true;
        weatherGridService.prefetchGrid(type, bounds, selectedModel, idx, 6);
        return false;
    }, [mapBounds, activeHeatmapType, visibleLayers.wind, selectedModel]);

    // محور زمني مستقلّ عن Open-Meteo: ساعات توقّع GFS (نسيج لكلٍّ منها). نقرأ زمن دورة
    // النموذج من rasters/meta.json كي يطابق رقم الإطار (f000..fNN) زمن صلاحيته الحقيقي،
    // فلا يظهر إطار الليل (f000) تحت تسمية "الآن". يبقى الشريط يعمل حتى بلا Open-Meteo.
    const [rasterMeta, setRasterMeta] = useState<{ run_epoch: number; hours: number } | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetch(`${import.meta.env.BASE_URL}rasters/meta.json`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((m) => { if (!cancelled && m && m.run_epoch) setRasterMeta(m); })
            .catch(() => { /* بلا meta: نسقط على السلوك الافتراضي (إزاحة 0) */ });
        return () => { cancelled = true; };
    }, []);

    // زمن صلاحية الإطار i = زمن الدورة + i ساعة. بلا meta: نبدأ من الساعة الحالية.
    const runEpoch = rasterMeta?.run_epoch ?? Math.floor(Date.now() / 3_600_000) * 3600;
    const frameHours = rasterMeta?.hours ?? 25;
    const forecastTimes = useMemo(
        () => Array.from({ length: frameHours }, (_, i) => runEpoch + i * 3600),
        [runEpoch, frameHours],
    );
    // الإطار المطابق للوقت الحالي (إزاحة من زمن الدورة) — نفتح عليه مرّة واحدة عند وصول meta.
    const nowFrameRef = useRef(false);
    useEffect(() => {
        if (!rasterMeta || nowFrameRef.current) return;
        const idx = Math.round((Date.now() / 1000 - rasterMeta.run_epoch) / 3600);
        setCurrentTimeIndex(Math.max(0, Math.min(rasterMeta.hours - 1, idx)));
        nowFrameRef.current = true;
    }, [rasterMeta, setCurrentTimeIndex]);

    useAutoplay({ isPlaying, playbackSpeed, frameCount: forecastTimes.length, canAdvance: playbackCanAdvance });

    // قاعدة الخريطة تتبع الطبقة الفعّالة (Zoom Earth): الحرارة على قاعدة فاتحة فستقية،
    // الرياح/الأمطار على قاعدة داكنة — بغضّ النظر عن مفتاح الوضع الداكن العام للواجهة.
    const activeLayerKey = visibleLayers.wind ? 'wind' : activeHeatmapType;
    const mapBaseDark = layerBaseIsDark(activeLayerKey, darkMode);

    const { handleMapLoad, handleMoveEnd } = useMapStyling({
        mapRef, darkMode: mapBaseDark, setMapBounds, setZoomLevel,
    });

    const handleMapClick = (e: MapLayerMouseEvent) => {
        setCurrentLocation(e.lngLat.lat, e.lngLat.lng);
        setInfoPanelOpen(true);
    };

    // التلميح عند المرور (hover): نُفضّل الطبقة السلَّمية المعروضة (حرارة/ضغط…) إن وُجدت،
    // وإلا نعود دائماً إلى درجة الحرارة — فيظهر التلميح في كل الأحوال (سلوك Zoom Earth).
    // تُقرأ القيمة مباشرةً من نُسج GFS المحلّية بلا أي طلب API.
    const hoverType: ForecastGridType = activeHeatmapType ?? 'temperature';

    const overlayPanelOpen = infoPanelOpen || layerControlsOpen || sidebarOpen || settingsOpen;
    const initialLng = currentLocation?.lon ?? 46.7;
    const initialLat = currentLocation?.lat ?? 24.7;

    return (
        <MapContext.Provider value={{ mapRef }}>
            <div
                className={`weather-map-container ${darkMode ? 'dark' : 'light'} ${overlayPanelOpen ? 'panel-overlay-open' : ''}`}
                dir="rtl"
            >
                <LayerSidebar />

                {/* شعار عائم فوق الخريطة — بدون هيدر */}
                <div
                    className={` ${darkMode ? 'bg-[#0d1117]' : 'bg-white' } fixed top-[14px] right-16 left-auto z-[950] py-2 px-3 flex items-center [direction:ltr]  rounded-xl shadow-[0_2px_16px_rgba(0,0,0,0.25)] pointer-events-none select-none whitespace-nowrap max-md:hidden`}
                    aria-label="Sky Radar"
                >
                    <img
                        src={darkMode ? '/sky-radar-logo-dark.svg' : '/sky-radar-logo-light.svg'}
                        alt="Sky Radar"
                        className="h-[35px] w-auto shrink-0 block"
                    />
                </div>

                <div className="map-wrapper">
                    <Map
                        ref={mapRef}
                        mapStyle={DARK_MAP_STYLE}
                        initialViewState={{
                            longitude: initialLng,
                            latitude:  initialLat,
                            zoom:      zoomLevel ?? 4,
                        }}
                        style={{ height: '100%', width: '100%' }}
                        attributionControl={false}
                        renderWorldCopies={true}
                        onLoad={handleMapLoad}
                        onMoveEnd={handleMoveEnd}
                        onClick={handleMapClick}
                    >
                        {/* طبقات البيانات (Source/Layer) داخل الخريطة */}
                        <SatelliteTileLayer />
                        <RadarTileLayer />

                        {/* طبقة هيتماب الرياح — WebGL */}
                        {visibleLayers.wind && windGrid && (
                            <HeatmapWebGLLayer id="weather-heatmap-wind" grid={windGrid} type="wind" opacity={0.8} />
                        )}

                        {/* الحرارة: نسيج عالمي خام بدقّة كاملة (GFS GRIB2) — مطابقة Zoom Earth */}
                        {activeHeatmapType && useRaster && (
                            <RasterHeatmapWebGLLayer
                                id="weather-heatmap-scalar"
                                url={`${import.meta.env.BASE_URL}rasters/${activeHeatmapType}_${String(currentTimeIndex).padStart(3, '0')}.png`}
                                type={activeHeatmapType}
                                opacity={0.92}
                            />
                        )}

                        {/* بقية الطبقات العددية — WebGL مُبلّطة، تحميل مربّع‑مربّع */}
                        {activeHeatmapType && !useRaster && (
                            <TiledHeatmapWebGLLayer
                                id="weather-heatmap-scalar"
                                tiles={scalarTiles}
                                type={activeHeatmapType}
                                opacity={activeHeatmapType === 'clouds' ? 0.6 : activeHeatmapType === 'precipitation' ? 0.85 : 0.92}
                            />
                        )}

                        {/* جسيمات الرياح — WebGL (GPU) فوق أي طبقة فعّالة */}
                        {(() => {
                            const key = visibleLayers.wind ? 'wind' : activeHeatmapType;
                            const s = key ? layerAnimationSettings[key] : null;
                            if (!windGrid || !s || !s.particlesEnabled || s.reduceMotion) return null;
                            return <ParticleWebGLLayer id="weather-particles" windGrid={windGrid} settings={s} darkMode={darkMode} />;
                        })()}

                        {/* تسميات المدن والدول (مع حرارة كل مدينة الثابتة) */}
                        <ArabicCityLabels timeIndex={currentTimeIndex} darkBase={mapBaseDark} />

                        {/* متتبع الأعاصير والحرائق */}
                        <CycloneTracker />
                        <WildfireLayer />

                        {/* شريط الأدوات الأيمن */}
                        <RightToolbar />

                        {/* علامة الموقع المحدد */}
                        {currentLocation && (
                            <Marker
                                longitude={currentLocation.lon}
                                latitude={currentLocation.lat}
                                anchor="center"
                            >
                                <div className="marker-pin" />
                            </Marker>
                        )}
                    </Map>

                    {/* تلميح القيمة عند مرور المؤشّر (أسلوب Zoom Earth) */}
                    <HoverValueTooltip type={hoverType} timeIndex={currentTimeIndex} />

                    {/* لوحة التحكم بالطبقات */}
                    <LayerControls />

                    {/* مفتاح الألوان المركزي */}
                    <CentralLegend />

                    {/* لوحة معلومات الطقس */}
                    {weatherData && infoPanelOpen && (
                        <WeatherInfoPanel
                            weatherData={weatherData}
                            currentTimeIndex={currentTimeIndex}
                            location={currentLocation}
                        />
                    )}

                    {/* مؤشر الموقع */}
                    <div className="location-indicator">
                        <FiMapPin />
                        <span>
                            {currentLocation
                                ? `${currentLocation.lat.toFixed(2)}°, ${currentLocation.lon.toFixed(2)}°`
                                : 'لم يتم تحديد موقع'}
                        </span>
                    </div>

                    {/* شريط الوقت — مستقلّ عن Open-Meteo: محوره ساعات توقّع GFS (نُسج النسيج) */}
                    <TimeSlider
                        times={forecastTimes}
                        currentTimeIndex={currentTimeIndex}
                        isPlaying={isPlaying}
                    />
                </div>

                {/* لوحة الإعدادات */}
                {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

                {/* بوابة نافذة المدينة */}
                <div id="city-modal-portal" />
            </div>
        </MapContext.Provider>
    );
}
