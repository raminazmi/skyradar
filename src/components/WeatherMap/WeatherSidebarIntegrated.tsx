import { useWeatherStore } from '../../store/weatherStore';
import { 
    FiPlay, 
    FiPause, 
    FiSun, 
    FiMoon, 
    FiWind, 
    FiCloudRain,
    FiThermometer,
    FiActivity,
    FiCloud,
    FiDroplet,
    FiX,
    FiZap
} from 'react-icons/fi';
import { useState } from 'react';

export function WeatherSidebarIntegrated() {
    const {
        visibleLayers,
        setActiveLayer,
        toggleLayer,
        closeAllLayers,
        isPlaying,
        setIsPlaying,
        darkMode,
        setDarkMode,
        selectedModel,
        setSelectedModel,
        sidebarOpen,
        setSidebarOpen
    } = useWeatherStore();

    const [collapsed] = useState(false);

    const layers: { id: string; name: string; icon: any; color: string; type: 'overlay' | 'point' }[] = [
        { id: 'wind', name: 'الرياح', icon: FiWind, color: '#42a5f5', type: 'overlay' },
        { id: 'precipitation', name: 'الأمطار', icon: FiCloudRain, color: '#1e88e5', type: 'overlay' },
        { id: 'temperature', name: 'درجة الحرارة', icon: FiThermometer, color: '#ef5350', type: 'overlay' },
        { id: 'pressure', name: 'الضغط الجوي', icon: FiActivity, color: '#ab47bc', type: 'overlay' },
        { id: 'humidity', name: 'الرطوبة', icon: FiDroplet, color: '#26c6da', type: 'overlay' },
        { id: 'clouds', name: 'الغيوم', icon: FiCloud, color: '#90a4ae', type: 'overlay' },
    ];

    const trackingLayers: { id: string; name: string; icon: any; color: string }[] = [
        { id: 'hurricanes', name: 'الأعاصير', icon: FiZap, color: '#ff5722' },
    ];

    if (!sidebarOpen) {
        return (
            <button 
                className="sidebar-toggle-btn" 
                onClick={() => setSidebarOpen(true)}
                title="فتح القائمة"
            >
                <FiWind />
            </button>
        );
    }

    return (
        <div className={`weather-sidebar-integrated ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-integrated-header">
                <h2 className="sidebar-title">الطبقات</h2>
                <div className="sidebar-header-actions">
                    <span className="model-badge">{selectedModel}</span>
                    <button 
                        className="close-sidebar-btn" 
                        onClick={() => setSidebarOpen(false)} 
                        title="إغلاق"
                    >
                        <FiX />
                    </button>
                </div>
            </div>

            {!collapsed && (
                <>
                    {/* Model Selector */}
                    <div className="model-selector-integrated">
                        <div className="model-label">النموذج الجوي</div>
                        <div className="model-buttons">
                            <button
                                className={`model-btn ${selectedModel === 'GFS' ? 'active' : ''}`}
                                onClick={() => setSelectedModel('GFS')}
                                title="NOAA Global Forecast System"
                            >
                                <span className="model-name">GFS</span>
                                <span className="model-res">25كم</span>
                            </button>
                            {/* <button
                                className={`model-btn ${selectedModel === 'ICON' ? 'active' : ''}`}
                                onClick={() => setSelectedModel('ICON')}
                                title="DWD ICON Model"
                            >
                                <span className="model-name">ICON</span>
                                <span className="model-res">13كم</span>
                            </button> */}
                        </div>
                    </div>

                    {/* Layers */}
                    <div className="layers-integrated">
                        <div className="layer-section-title">طبقات الطقس</div>
                        {layers.map((layer) => {
                            const Icon = layer.icon;
                            const isActive = (visibleLayers as any)[layer.id];
                            return (
                                <button
                                    key={layer.id}
                                    className={`layer-btn-integrated ${isActive ? 'active' : ''}`}
                                    onClick={() => setActiveLayer(layer.id as any)}
                                    style={{ '--layer-color': layer.color } as React.CSSProperties}
                                >
                                    <div className="layer-btn-icon-wrap">
                                        <Icon className="layer-icon" />
                                    </div>
                                    <span className="layer-name">{layer.name}</span>
                                    {isActive && <span className="layer-indicator"></span>}
                                </button>
                            );
                        })}

                        <div className="layer-section-title">المتابعة</div>
                        {trackingLayers.map((layer) => {
                            const Icon = layer.icon;
                            const isActive = (visibleLayers as any)[layer.id];
                            return (
                                <button
                                    key={layer.id}
                                    className={`layer-btn-integrated ${isActive ? 'active' : ''}`}
                                    onClick={() => toggleLayer(layer.id as any)}
                                    style={{ '--layer-color': layer.color } as React.CSSProperties}
                                >
                                    <div className="layer-btn-icon-wrap">
                                        <Icon className="layer-icon" />
                                    </div>
                                    <span className="layer-name">{layer.name}</span>
                                    {isActive && <span className="layer-indicator"></span>}
                                </button>
                            );
                        })}

                        {Object.values(visibleLayers).some(v => v) && (
                            <button
                                className="clear-layers-btn"
                                onClick={closeAllLayers}
                            >
                                <FiX /> إيقاف الطبقات
                            </button>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="sidebar-controls-integrated">
                        <button
                            className="playback-btn"
                            onClick={() => setIsPlaying(!isPlaying)}
                        >
                            {isPlaying ? <FiPause /> : <FiPlay />}
                            <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
                        </button>

                        <button
                            className={`theme-btn ${darkMode ? 'dark' : 'light'}`}
                            onClick={() => setDarkMode(!darkMode)}
                            title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
                        >
                            {darkMode ? <FiSun /> : <FiMoon />}
                        </button>
                    </div>
                </>
            )}

            {collapsed && (
                <div className="collapse-hint">
                    <div className="hint-dots"></div>
                </div>
            )}
        </div>
    );
}
