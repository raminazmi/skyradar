import { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiEye, FiEyeOff, FiLayers, FiX } from 'react-icons/fi';
import { LAYER_PRESENTATION } from '../../config/layerAnimation';
import { FORECAST_LAYER_IDS, TILE_OVERLAY_LAYER_IDS, WEATHER_LAYER_CONFIGS } from '../../config/weatherLayers';
import { LayerKey, useWeatherStore } from '../../store/weatherStore';

const CONTROL_LAYER_IDS: LayerKey[] = [
    ...FORECAST_LAYER_IDS,
    ...TILE_OVERLAY_LAYER_IDS,
    'hurricanes',
    'wildfires',
];

export function LayerControls() {
    const {
        visibleLayers,
        setActiveLayer,
        closeAllLayers,
        legendOpen,
        setLegendOpen,
        infoPanelOpen,
        setInfoPanelOpen,
        layerControlsOpen,
        setLayerControlsOpen,
    } = useWeatherStore();
    const [collapsed, setCollapsed] = useState(false);
    const layers = CONTROL_LAYER_IDS.map((id) => WEATHER_LAYER_CONFIGS[id]);
    const activeCount = layers.filter((layer) => visibleLayers[layer.id]).length;

    if (!layerControlsOpen) {
        return (
            <button
                className={`layer-controls-toggle ${infoPanelOpen ? 'with-info-panel' : ''}`}
                onClick={() => setLayerControlsOpen(true)}
                title="فتح الطبقات"
            >
                <FiLayers />
                {activeCount > 0 && <span className="layer-count-badge">{activeCount}</span>}
            </button>
        );
    }

    return (
        <div className={`layer-controls ${collapsed ? 'collapsed' : ''} ${infoPanelOpen ? 'with-info-panel' : ''}`}>
            <div className="layer-controls-header">
                <div className="header-info">
                    <FiLayers className="header-icon" />
                    <span className="header-title">الطبقات النشطة</span>
                </div>
                <div className="header-actions">
                    <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'توسيع' : 'طي'}>
                        {collapsed ? <FiChevronDown /> : <FiChevronUp />}
                    </button>
                    <button className="icon-btn close-btn" onClick={() => setLayerControlsOpen(false)} title="إغلاق">
                        <FiX />
                    </button>
                </div>
            </div>

            {!collapsed && (
                <>
                    <div className="layer-controls-list">
                        {layers.map((layer) => {
                            const isActive = visibleLayers[layer.id];
                            const Icon = layer.icon;
                            const presentation = LAYER_PRESENTATION[layer.id];

                            return (
                                <div key={layer.id} className={`layer-control-block ${isActive ? 'active' : ''}`}>
                                    <button className={`layer-control-item ${isActive ? 'active' : ''}`} onClick={() => setActiveLayer(layer.id)}>
                                        <span className="layer-emoji"><Icon style={{ color: layer.color }} /></span>
                                        <span className="layer-name">{layer.labelAr}</span>
                                        <div className={`layer-toggle ${isActive ? 'on' : ''}`}><div className="toggle-slider" /></div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
