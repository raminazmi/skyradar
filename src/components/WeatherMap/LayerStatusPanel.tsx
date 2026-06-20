import { FORECAST_LAYER_IDS, getLayerConfig } from '../../config/weatherLayers';
import type { LayerKey } from '../../store/weatherStore';
import { useWeatherStore } from '../../store/weatherStore';
import type { WeatherGrid } from '../../services/weatherGridService';

interface LayerStatusPanelProps {
    forecastGrid: WeatherGrid | null;
}

function formatDateTime(value?: string | number): string {
    if (value === undefined || value === null || value === '') return 'Unknown';

    const date = typeof value === 'number' || /^\d+$/.test(String(value))
        ? new Date(Number(value) * 1000)
        : new Date(value);

    if (Number.isNaN(date.getTime())) return 'Unknown';

    return date.toLocaleString('ar', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
    });
}

export function LayerStatusPanel({ forecastGrid }: LayerStatusPanelProps) {
    const { visibleLayers, selectedModel, availableModels, weatherData, currentTimeIndex } = useWeatherStore();
    const activeForecastLayer = FORECAST_LAYER_IDS.find((layer) => visibleLayers[layer as LayerKey]) as LayerKey | undefined;
    const activeTileLayer = visibleLayers.radar ? 'radar' : visibleLayers.satellite ? 'satellite' : undefined;
    const activeLayer = activeForecastLayer ?? activeTileLayer;

    if (!activeLayer) return null;

    const config = getLayerConfig(activeLayer);
    const model = availableModels.find((item) => item.id === selectedModel);
    const forecastTime = forecastGrid?.validTime ?? weatherData?.hourly.time?.[currentTimeIndex];
    const provider = forecastGrid?.provider ?? config.sourceLabel;
    const unit = forecastGrid?.unit ?? config.unit;

    return (
        <div className="layer-status-panel">
            <div className="layer-status-head">
                <span className="layer-status-dot" style={{ background: config.color }} />
                <div>
                    <div className="layer-status-title">{config.labelAr}</div>
                    <div className="layer-status-desc">{config.descriptionAr}</div>
                </div>
            </div>

            <div className="layer-status-meta">
                <span>{provider}</span>
                <span>{config.timeMode === 'forecast' ? `${selectedModel} ${model?.resolution ?? ''}` : config.sourceLabel}</span>
                <span>{formatDateTime(forecastTime)}</span>
                <span>{unit}</span>
            </div>

            {(visibleLayers.radar || visibleLayers.satellite) && (
                <div className="layer-status-overlays">
                    {visibleLayers.radar && <span>RainViewer radar</span>}
                    {visibleLayers.satellite && <span>NASA GIBS satellite</span>}
                </div>
            )}
        </div>
    );
}
