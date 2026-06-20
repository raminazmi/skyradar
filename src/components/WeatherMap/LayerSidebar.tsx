import { FiMoon, FiPause, FiPlay, FiSun, FiX } from 'react-icons/fi';
import { FORECAST_LAYER_IDS, TILE_OVERLAY_LAYER_IDS, WEATHER_LAYER_CONFIGS } from '../../config/weatherLayers';
import { LayerKey, useWeatherStore } from '../../store/weatherStore';

const TRACKING_LAYER_IDS: LayerKey[] = ['hurricanes', 'wildfires'];

export function LayerSidebar() {
    const {
        visibleLayers,
        setActiveLayer,
        isPlaying,
        setIsPlaying,
        darkMode,
        setDarkMode,
        selectedModel,
        setSelectedModel,
        sidebarOpen,
        setSidebarOpen,
        availableModels,
    } = useWeatherStore();

    if (!sidebarOpen) return null;

    const forecastLayers = FORECAST_LAYER_IDS.map((id) => WEATHER_LAYER_CONFIGS[id]);
    const tileOverlays = TILE_OVERLAY_LAYER_IDS.map((id) => WEATHER_LAYER_CONFIGS[id]);
    const trackers = TRACKING_LAYER_IDS.map((id) => WEATHER_LAYER_CONFIGS[id]);

    return (
        <>
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            <div className="layer-sidebar">
                <div className="sidebar-header">
                    <span className="sidebar-title">الطبقات</span>
                    <button className="sidebar-close" onClick={() => setSidebarOpen(false)} title="إغلاق">
                        <FiX />
                    </button>
                </div>

                <div className="sidebar-models">
                    {availableModels.map((model) => (
                        <button
                            key={model.id}
                            className={`model-option ${selectedModel === model.id ? 'active' : ''}`}
                            onClick={() => setSelectedModel(model.id)}
                        >
                            <span className="model-dot" />
                            <span>{model.name} - {model.resolution}</span>
                        </button>
                    ))}
                </div>

                <div className="sidebar-layers">
                    <LayerGroup title="طبقات التوقعات" layers={forecastLayers} visibleLayers={visibleLayers} onSelect={setActiveLayer} />
                    <div className="sidebar-section-divider" />
                    <LayerGroup title="الرادار والقمر الصناعي" layers={tileOverlays} visibleLayers={visibleLayers} onSelect={setActiveLayer} />
                    <div className="sidebar-section-divider" />
                    <LayerGroup title="المتابعة" layers={trackers} visibleLayers={visibleLayers} onSelect={setActiveLayer} />
                </div>

                <div className="sidebar-footer">
                    <button className="play-btn" onClick={() => setIsPlaying(!isPlaying)}>
                        {isPlaying ? <FiPause /> : <FiPlay />}
                        <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
                    </button>
                    <button className={`theme-btn ${darkMode ? 'dark' : ''}`} onClick={() => setDarkMode(!darkMode)}>
                        {darkMode ? <FiSun /> : <FiMoon />}
                    </button>
                </div>
            </div>
        </>
    );
}

function LayerGroup({ title, layers, visibleLayers, onSelect }: {
    title: string;
    layers: Array<(typeof WEATHER_LAYER_CONFIGS)[LayerKey]>;
    visibleLayers: Record<LayerKey, boolean>;
    onSelect: (layer: LayerKey) => void;
}) {
    return (
        <>
            <div className="sidebar-section-label">{title}</div>
            {layers.map((layer) => {
                const Icon = layer.icon;
                const isActive = visibleLayers[layer.id];
                return (
                    <button key={layer.id} className={`layer-item ${isActive ? 'active' : ''}`} onClick={() => onSelect(layer.id)}>
                        <div className="layer-icon-wrap">
                            <Icon style={{ color: layer.color }} />
                        </div>
                        <span className="layer-name">{layer.labelAr}</span>
                        {isActive && <div className="layer-active-dot" style={{ background: layer.color }} />}
                    </button>
                );
            })}
        </>
    );
}
