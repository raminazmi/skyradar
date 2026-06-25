import { useWeatherStore } from '../../store/weatherStore';

export function LegendBar() {
    const { visibleLayers, units, selectedModel } = useWeatherStore();

    const activeLayer = ['wind', 'temperature', 'precipitation', 'pressure', 'humidity', 'clouds']
        .find(l => (visibleLayers as any)[l]);

    if (!activeLayer) return null;

    const legends: Record<string, { title: string; gradient: string; labels: string[] }> = {
        wind: {
            title: 'سرعة الرياح (كم/س)',
            gradient: 'linear-gradient(to right, #312c78, #3a5cb0, #3a96c6, #4ac4b4, #7cd68a, #c8e262, #f8d04e, #f08a40, #d63c42)',
            labels: ['0', '20', '40', '60', '80', '100', '120']
        },
        temperature: {
            title: units.temperature === 'celsius' ? 'درجة الحرارة (°م)' : 'درجة الحرارة (°ف)',
            gradient: 'linear-gradient(to right, #781487, #3046b9, #2db2dc, #78dac6, #b6e480, #f2d84e, #f8b442, #f08430, #d22828, #821230)',
            labels: units.temperature === 'celsius'
                ? ['-40', '-20', '0', '10', '20', '30', '40', '50']
                : ['-40', '-4', '32', '50', '68', '86', '104', '122']
        },
        'wet-bulb': {
            title: 'اللمبة الرطبة (°م)',
            gradient: 'linear-gradient(to right, #f6f5e0, #faf2aa, #fadd6e, #f9c65a, #f59f46, #f0773a, #e44632, #c3232d, #a0142d, #780a28)',
            labels: ['0', '5', '10', '15', '20', '25', '30', '35', '40']
        },
        precipitation: {
            title: units.precipitation === 'mm' ? 'الأمطار (مم/ساعة)' : 'الأمطار (إنش/ساعة)',
            gradient: 'linear-gradient(to right, rgba(150,220,255,0.4), #64b4ff, #3282ff, #1e50dc, #7832c8, #c81e96)',
            labels: units.precipitation === 'mm' ? ['0.1', '1', '3', '8', '15', '30+'] : ['0.004', '0.04', '0.12', '0.31', '0.59', '1.18+']
        },
        pressure: {
            title: units.pressure === 'hPa' ? 'الضغط الجوي (هكتوباسكال)' : 'الضغط الجوي (إنش زئبق)',
            gradient: 'linear-gradient(to right, #3232c8, #6496dc, #c8dcdc, #dcc896, #dc5050)',
            labels: units.pressure === 'hPa' ? ['970', '990', '1010', '1020', '1040'] : ['28.6', '29.2', '29.8', '30.1', '30.7']
        },
        humidity: {
            title: 'الرطوبة النسبية (%)',
            gradient: 'linear-gradient(to right, #b47846, #dcc896, #96c8dc, #5096dc, #1e50c8)',
            labels: ['0', '30', '60', '80', '100']
        },
        clouds: {
            title: 'الغطاء السحابي (%)',
            gradient: 'linear-gradient(to right, transparent, rgba(240,240,255,0.7))',
            labels: ['0', '25', '50', '75', '100']
        }
    };

    const legend = legends[activeLayer];
    if (!legend) return null;

    return (
        <div className="legend-bar-container">
            <div className="legend-title">{legend.title}</div>
            <div className="legend-gradient-bar" style={{ background: legend.gradient }}></div>
            <div className="legend-labels">
                {legend.labels.map((label, i) => (
                    <span key={i} className="legend-label">{label}</span>
                ))}
            </div>
            <div className="legend-model-info">
                <span className="model-indicator">
                    <span className={`model-dot-indicator ${selectedModel.toLowerCase()}`}></span>
                    {selectedModel} {selectedModel === 'GFS' ? '22 كم' : '9 كم'}
                </span>
            </div>
        </div>
    );
}
