import { useWeatherStore, LayerKey } from '../../store/weatherStore';
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

export function WeatherSidebar() {
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
        sidebarOpen,
        setSidebarOpen
    } = useWeatherStore();

    const layers: { id: LayerKey; name: string; icon: any; color: string; type: 'overlay' | 'point' }[] = [
        { id: 'wind', name: 'الرياح', icon: FiWind, color: '#42a5f5', type: 'overlay' },
        { id: 'precipitation', name: 'الأمطار', icon: FiCloudRain, color: '#1e88e5', type: 'overlay' },
        { id: 'temperature', name: 'درجة الحرارة', icon: FiThermometer, color: '#ef5350', type: 'overlay' },
        { id: 'pressure', name: 'الضغط الجوي', icon: FiActivity, color: '#ab47bc', type: 'overlay' },
        { id: 'humidity', name: 'الرطوبة', icon: FiDroplet, color: '#26c6da', type: 'overlay' },
        { id: 'clouds', name: 'الغيوم', icon: FiCloud, color: '#90a4ae', type: 'overlay' },
    ];

    const trackingLayers: { id: LayerKey; name: string; icon: any; color: string }[] = [
        { id: 'hurricanes', name: 'الأعاصير', icon: FiZap, color: '#ff5722' },
    ];

    if (!sidebarOpen) return null;

    return (
        <div className="weather-sidebar">
            <div className="sidebar-header">
                <h2 className="sidebar-title">الطبقات</h2>
                <div className="sidebar-header-actions">
                    <span className="model-badge">{selectedModel}</span>
                    <button 
                        className="close-sidebar-btn" 
                        onClick={() => setSidebarOpen(false)} 
                        title="إغلاق القائمة"
                    >
                        <FiX />
                    </button>
                </div>
            </div>

            <div className="layer-list">
                <div className="layer-section-title">طبقات الطقس</div>
                {layers.map((layer) => {
                    const Icon = layer.icon;
                    const isActive = visibleLayers[layer.id];
                    return (
                        <button
                            key={layer.id}
                            className={`layer-btn ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveLayer(layer.id)}
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
                    const isActive = visibleLayers[layer.id];
                    return (
                        <button
                            key={layer.id}
                            className={`layer-btn ${isActive ? 'active' : ''}`}
                            onClick={() => toggleLayer(layer.id)}
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

                <button
                    className="clear-layers-btn"
                    onClick={closeAllLayers}
                >
                    <FiX /> إيقاف جميع الطبقات
                </button>
            </div>

            <div className="sidebar-footer">
                <button
                    className="playback-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    {isPlaying ? <FiPause /> : <FiPlay />}
                    <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
                </button>

                <button
                    className="theme-btn"
                    onClick={() => setDarkMode(!darkMode)}
                    title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
                >
                    {darkMode ? <FiSun /> : <FiMoon />}
                </button>
            </div>
        </div>
    );
}
