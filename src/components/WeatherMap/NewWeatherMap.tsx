/**
 * NewWeatherMap.tsx — MapLibre version
 * الخريطة الرئيسية — تعمل بمحرك MapLibre GL بدلاً من Leaflet
 *
 * المكتبة: react-map-gl/maplibre  (مجانية، مفتوحة المصدر، مبنية على OpenStreetMap)
 * الخريطة: CartoDB Dark Matter (تصميم داكن مجاني مبني على OSM)
 */

import { useCallback, useEffect, useRef } from 'react';
import Map, { Marker, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { LayerSidebar }     from './LayerSidebar';
import { TimeSlider }       from './TimeSlider';
import { WeatherInfoPanel } from './WeatherInfoPanel';
import { LayerControls }    from './LayerControls';
import { SettingsPanel }    from './SettingsPanel';
import { HeatmapWebGLLayer }   from './HeatmapWebGLLayer';
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
import { useForecastGrids }   from './hooks/useForecastGrids';
import { weatherGridService } from '../../services/weatherGridService';
import { getStableGridBounds } from './utils/gridBounds';
import { useAutoplay }        from './hooks/useAutoplay';
import { useMapStyling }      from './hooks/useMapStyling';
import { useHoverTemperatureGrid } from './hooks/useHoverTemperatureGrid';
import { FiMapPin }           from 'react-icons/fi';

import './WeatherMap.css';

// ── خريطة الأساس — CartoDB Dark Matter (مبنية على OpenStreetMap، مجانية) ─────
const DARK_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewWeatherMap() {
    const {
        currentLocation, selectedModel, visibleLayers, darkMode,
        weatherData, currentTimeIndex, isPlaying, playbackSpeed,
        settingsOpen, setSettingsOpen,
        infoPanelOpen, layerControlsOpen, sidebarOpen,
        mapBounds, zoomLevel,
        setCurrentLocation, setInfoPanelOpen,
        setMapBounds, setZoomLevel,
        initializeModels,
        layerAnimationSettings,
    } = useWeatherStore();

    const mapRef = useRef<MapRef | null>(null);

    // ── Init ───────────────────────────────────────────────────────────────
    useEffect(() => { initializeModels(); }, []);

    // ── خطافات الجلب والتنسيق (مُستخرَجة لإبقاء الملف < 300 سطر) ──────────────
    useWeatherData({ currentLocation, selectedModel });
    const { windGrid, heatmapGrid, activeHeatmapType } = useForecastGrids({
        mapBounds, selectedModel, currentTimeIndex, isPlaying, visibleLayers,
    });

    // جهوزية إطار التشغيل: نتقدّم فقط عندما تكون شبكة الطبقة الفعّالة لذلك الإطار
    // مخزّنة (وإلا نحفّز تحميلها مسبقاً وننتظر) — فلا يظهر إطار مجمّد أثناء التشغيل.
    const playbackCanAdvance = useCallback((idx: number) => {
        if (!mapBounds) return true;
        const type = activeHeatmapType ?? (visibleLayers.wind ? 'wind' : null);
        if (!type) return true;
        const bounds = getStableGridBounds(mapBounds);
        if (weatherGridService.getCachedGrid(type, bounds, selectedModel, idx, 6)) return true;
        weatherGridService.prefetchGrid(type, bounds, selectedModel, idx, 6);
        return false;
    }, [mapBounds, activeHeatmapType, visibleLayers.wind, selectedModel]);

    useAutoplay({ isPlaying, playbackSpeed, weatherData, canAdvance: playbackCanAdvance });

    const { handleMapLoad, handleMoveEnd } = useMapStyling({
        mapRef, darkMode, setMapBounds, setZoomLevel,
    });

    const handleMapClick = (e: MapLayerMouseEvent) => {
        setCurrentLocation(e.lngLat.lat, e.lngLat.lng);
        setInfoPanelOpen(true);
    };

    // شبكة حرارة دائمة لتلميح المرور — تظهر درجة الحرارة عند المؤشّر حتى لو لم تكن
    // أي طبقة معروضة (سلوك Zoom Earth).
    const hoverTempGrid = useHoverTemperatureGrid({ mapBounds, selectedModel, currentTimeIndex });

    // التلميح عند المرور (hover): نُفضّل الطبقة العددية المعروضة (حرارة/ضغط...) إن وُجدت،
    // وإلا نعود دائماً إلى درجة الحرارة. هكذا يظهر التلميح في كل الأحوال.
    const hoverGrid = (activeHeatmapType && heatmapGrid) ? heatmapGrid : hoverTempGrid;
    const hoverType = hoverGrid?.type ?? null;

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

                        {/* طبقة هيتماب البيانات الأخرى — WebGL */}
                        {heatmapGrid && activeHeatmapType && (
                            <HeatmapWebGLLayer
                                id="weather-heatmap-scalar"
                                grid={heatmapGrid}
                                type={activeHeatmapType}
                                opacity={activeHeatmapType === 'clouds' ? 0.6 : activeHeatmapType === 'precipitation' ? 0.82 : 0.76}
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
                        <ArabicCityLabels temperatureGrid={hoverTempGrid} />

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
                    <HoverValueTooltip grid={hoverGrid} type={hoverType} windGrid={windGrid} />

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

                    {/* شريط الوقت */}
                    {weatherData && (
                        <TimeSlider
                            times={weatherData.hourly.time}
                            currentTimeIndex={currentTimeIndex}
                            isPlaying={isPlaying}
                        />
                    )}
                </div>

                {/* لوحة الإعدادات */}
                {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

                {/* بوابة نافذة المدينة */}
                <div id="city-modal-portal" />
            </div>
        </MapContext.Provider>
    );
}
