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
import { ModelSwitch } from './ModelSwitch';
import { MapLoadingToast } from './MapLoadingToast';
import { ParticleToggle } from './ParticleToggle';
import { IsobarToggle } from './IsobarToggle';
import { IsobarLayer } from './IsobarLayer';
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
import { rasterSampler }      from '../../services/rasterSampler';
import { queuePrefetchImage } from '../../services/prefetchQueue';
import { getStableGridBounds } from './utils/gridBounds';
import { layerBaseIsDark }     from './webgl/layerOrder';
import { useAutoplay }        from './hooks/useAutoplay';
import { useMapStyling }      from './hooks/useMapStyling';
import { useTiledHeatmap }    from './hooks/useTiledHeatmap';
import { useWindRaster, lerpWindGrid } from './hooks/useWindRaster';
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
    'temperature', 'feels-like', 'wet-bulb', 'dewpoint', 'humidity', 'pressure', 'clouds', 'wind-gusts', 'precipitation',
]);

// روابط النُسج التي أُطلق إحماؤها (Image) — يمنع إعادة إنشاء طلب لكل إطار مجاور عند كل
// تغيّر وقت. يُفرَّغ عند امتلائه فيُعاد الإحماء بما يتوافق مع كاش المتصفح (30 دقيقة).
const warmedRasters = new Set<string>();

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewWeatherMap() {
    const {
        currentLocation, selectedModel, visibleLayers, darkMode,
        weatherData, currentTimeIndex, frameFraction, isPlaying, playbackSpeed,
        settingsOpen, setSettingsOpen, searchOpen, isobarsEnabled,
        infoPanelOpen, layerControlsOpen, sidebarOpen,
        mapBounds, zoomLevel, particlesEnabled,
        setCurrentLocation, setInfoPanelOpen, setCurrentTimeIndex, setFrameFraction,
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

    // نُسج خام متاحة للنماذج الثلاثة: GFS (NOAA) في rasters/، ECMWF (IFS) في rasters/ecmwf/،
    // و ICON (DWD) في rasters/icon/. التبديل يغيّر مجلّد النسيج فعلياً → بيانات نموذج مختلف،
    // بلا أي طلبات Open-Meteo (لا 429).
    const rasterDir = selectedModel === 'ECMWF' ? 'rasters/ecmwf/'
        : selectedModel === 'ICON' ? 'rasters/icon/'
        : 'rasters/';
    // قارئ التلميح/تسميات المدن يتبع نفس المجلّد — وإلا عرض قيم GFS مع نموذج آخر.
    useEffect(() => { rasterSampler.setDir(rasterDir); }, [rasterDir]);
    const useRaster = !!activeHeatmapType && RASTER_TYPES.has(activeHeatmapType)
        && (selectedModel === 'GFS' || selectedModel === 'ECMWF' || selectedModel === 'ICON');

    // حقل الرياح من النسيج المحلّي (R=سرعة، G/B=U/V) — يغذّي الجسيمات وطبقة لون الرياح
    // وتلميح الرياح بلا Open-Meteo، ويتبع مجلّد النموذج المختار.
    const windGridCur = useWindRaster(currentTimeIndex, rasterDir);
    const windGridNext = useWindRaster(currentTimeIndex + 1, rasterDir);
    // مزج حقل الرياح بخطوات ~10 دقائق (CPU خفيف، 6 مرّات/ساعة) — استيفاء زمني ناعم للرياح والجسيمات.
    const windBucket = Math.round(frameFraction * 6) / 6;
    const windGrid = useMemo(
        () => lerpWindGrid(windGridCur, windGridNext, windBucket),
        [windGridCur, windGridNext, windBucket],
    );

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
        setRasterMeta(null);
        // كاش HTTP عادي: .htaccess يمنح meta.json خمس دقائق (الدورة كل 6 ساعات) —
        // no-store كان يفرض رحلة شبكة كاملة عند كل تبديل نموذج.
        fetch(`${import.meta.env.BASE_URL}${rasterDir}meta.json`, { cache: 'default' })
            .then((r) => (r.ok ? r.json() : null))
            .then((m) => { if (!cancelled && m && m.run_epoch) setRasterMeta(m); })
            .catch(() => { /* بلا meta: نسقط على السلوك الافتراضي (إزاحة 0) */ });
        return () => { cancelled = true; };
    }, [rasterDir]);

    // زمن صلاحية الإطار i = زمن الدورة + i ساعة. بلا meta: نبدأ من أقرب ساعة للزمن الحالي
    // (تقريب لا تقليل) كي يكون الإطار 0 = "الآن" تماماً، لا "قبل ساعة" (بداية الساعة الحالية).
    const runEpoch = rasterMeta?.run_epoch ?? Math.round(Date.now() / 3_600_000) * 3600;
    const frameHours = rasterMeta?.hours ?? 25;
    const forecastTimes = useMemo(
        () => Array.from({ length: frameHours }, (_, i) => runEpoch + i * 3600),
        [runEpoch, frameHours],
    );
    // إطار "الآن" = إزاحة الساعات بين الزمن الحالي وزمن دورة النموذج (f000). يُستخدم لفتح
    // الشريط على الآن (لا على بداية الدورة في الماضي) ولإعادة التشغيل إليه عند النهاية.
    const nowFrameIndex = useMemo(() => {
        if (!rasterMeta) return 0;
        const idx = Math.round((Date.now() / 1000 - rasterMeta.run_epoch) / 3600);
        return Math.max(0, Math.min(rasterMeta.hours - 1, idx));
    }, [rasterMeta]);

    // نُعيد ضبط الشريط على إطار "الآن" عند كل تبديل نموذج (تغيّر rasterDir) وعند وصول meta
    // الجديد. مهمّ أن يعمل حتى بلا meta: في حالة السقوط (runEpoch = الساعة الحالية) يكون
    // nowFrameIndex = 0 = الآن، فلا يبقى المؤشّر على إزاحة النموذج السابق (مثل +7 ساعات).
    useEffect(() => {
        setCurrentTimeIndex(nowFrameIndex);
        setFrameFraction(0);
    }, [rasterDir, rasterMeta, nowFrameIndex, setCurrentTimeIndex, setFrameFraction]);

    useAutoplay({ isPlaying, playbackSpeed, frameCount: forecastTimes.length, canAdvance: playbackCanAdvance, homeIndex: nowFrameIndex });

    // تحميل مُسبق لإطارات النسيج المجاورة (الطبقة الفعّالة + الرياح) فتظهر فوراً عند تغيّر
    // الوقت/التشغيل بلا تأخّر تنزيل/فكّ. نعتمد كاش المتصفح: مجرّد إنشاء Image يكفي للإحماء.
    useEffect(() => {
        const dir = `${import.meta.env.BASE_URL}${rasterDir}`;
        const ahead = isPlaying ? 8 : 4;
        const types: string[] = [];
        if (useRaster && activeHeatmapType) types.push(activeHeatmapType);
        if (visibleLayers.wind) types.push('wind');
        for (const type of types) {
            // الإطار الحالي أولاً (يظهر فوراً عند فتح الطبقة) ثم الجوار.
            for (let d = 0; d <= ahead + 1; d += 1) {
                const idx = currentTimeIndex + (d === ahead + 1 ? -1 : d);
                if (idx < 0 || idx >= frameHours) continue;
                const src = `${dir}${type}_${String(idx).padStart(3, '0')}.png`;
                if (warmedRasters.has(src)) continue;   // أُحمي للتوّ — لا نكرّر الطلب كل تغيّر إطار
                warmedRasters.add(src);
                if (warmedRasters.size > 600) warmedRasters.clear();  // يسمح بإعادة الإحماء بعد انتهاء كاش 30د
                queuePrefetchImage(src);                // عبر طابور التزامن — لا نغرق الخادم المشترك
            }
        }
    }, [rasterDir, useRaster, activeHeatmapType, visibleLayers.wind, currentTimeIndex, isPlaying, frameHours]);

    // قاعدة الخريطة تتبع الطبقة الفعّالة (Zoom Earth): الحرارة على قاعدة فاتحة فستقية،
    // الرياح/الأمطار على قاعدة داكنة — بغضّ النظر عن مفتاح الوضع الداكن العام للواجهة.
    const activeLayerKey = visibleLayers.wind ? 'wind' : activeHeatmapType;
    const mapBaseDark = layerBaseIsDark(activeLayerKey, darkMode);

    const { handleMapLoad, handleMoveEnd } = useMapStyling({
        mapRef, darkMode: mapBaseDark, activeLayerKey, setMapBounds, setZoomLevel,
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

                {/* مؤشّر تحميل علوي عند تبديل النموذج/الطبقة (أسلوب Zoom Earth) */}
                <MapLoadingToast
                    rasterDir={rasterDir}
                    activeType={activeHeatmapType}
                    windVisible={visibleLayers.wind}
                    modelName={selectedModel}
                />

                {/* شعار عائم فوق الخريطة — يُخفى عند فتح البحث كي لا يغطّيه */}
                {!searchOpen && (
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
                )}

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

                        {/* خطوط تساوي الضغط — مع طبقة الضغط فقط */}
                        <IsobarLayer
                            timeIndex={currentTimeIndex}
                            dir={rasterDir}
                            enabled={activeHeatmapType === 'pressure' && isobarsEnabled}
                        />

                        {/* طبقة هيتماب الرياح — WebGL */}
                        {visibleLayers.wind && windGrid && (
                            <HeatmapWebGLLayer id="weather-heatmap-wind" grid={windGrid} type="wind" opacity={1} />
                        )}

                        {/* الحرارة: نسيج عالمي خام بدقّة كاملة (GFS GRIB2) — مطابقة Zoom Earth */}
                        {activeHeatmapType && useRaster && (
                            <RasterHeatmapWebGLLayer
                                id="weather-heatmap-scalar"
                                url={`${import.meta.env.BASE_URL}${rasterDir}${activeHeatmapType}_${String(currentTimeIndex).padStart(3, '0')}.png`}
                                urlNext={`${import.meta.env.BASE_URL}${rasterDir}${activeHeatmapType}_${String(Math.min(currentTimeIndex + 1, frameHours - 1)).padStart(3, '0')}.png`}
                                blend={frameFraction}
                                type={activeHeatmapType}
                                opacity={activeHeatmapType === 'clouds' ? 0.6 : activeHeatmapType === 'precipitation' ? 0.85 : 1}
                            />
                        )}

                        {/* بقية الطبقات العددية — WebGL مُبلّطة، تحميل مربّع‑مربّع */}
                        {activeHeatmapType && !useRaster && (
                            <TiledHeatmapWebGLLayer
                                id="weather-heatmap-scalar"
                                tiles={scalarTiles}
                                type={activeHeatmapType}
                                opacity={activeHeatmapType === 'clouds' ? 0.6 : activeHeatmapType === 'precipitation' ? 0.85 : 1}
                            />
                        )}

                        {/* جسيمات الرياح — WebGL (GPU) فوق أي طبقة فعّالة. مفتاح عالمي واحد
                            (particlesEnabled) يبقى عبر كل الطبقات؛ الإعدادات البصرية من طبقة الرياح. */}
                        {(() => {
                            const s = layerAnimationSettings.wind;
                            if (!windGrid || !particlesEnabled || !s || s.reduceMotion) return null;
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

                    {/* لوحة معلومات الطقس — تُفتح بمجرد الضغط على إحداثية، وتعرض حالة تحميل/خطأ
                        حتى لو لم تصل البيانات بعد (بدل ألا تظهر إطلاقاً عند فشل/تأخّر الـ API). */}
                    {infoPanelOpen && (
                        <WeatherInfoPanel
                            weatherData={weatherData}
                            currentTimeIndex={currentTimeIndex}
                            targetEpoch={forecastTimes[currentTimeIndex] ?? forecastTimes[0]}
                            frameCount={forecastTimes.length}
                            location={currentLocation}
                            onRetry={() => currentLocation && setCurrentLocation(currentLocation.lat, currentLocation.lon)}
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

                    {/* زرّ سريع لتبديل جسيمات الرياح للطبقة الفعّالة — أسلوب Zoom Earth */}
                    <ParticleToggle activeLayerKey={activeLayerKey} />

                    {/* زرّ سياقي لخطوط تساوي الضغط — يظهر مع طبقة الضغط فقط */}
                    <IsobarToggle activeLayerKey={activeLayerKey} />

                    {/* مبدّل النموذج (GFS/ECMWF) ظاهر دائماً على الصفحة الرئيسية — أسلوب Zoom Earth */}
                    <ModelSwitch />

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
