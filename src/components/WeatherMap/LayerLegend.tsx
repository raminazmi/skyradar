import { useWeatherStore } from '../../store/weatherStore';

/**
 * مفتاح الألوان للطبقة النشطة (Color Legend)
 * يعرض مقياس القيم بالألوان للطبقة الحالية
 */
export function LayerLegend() {
    const { visibleLayers, units } = useWeatherStore();

    // البحث عن الطبقة النشطة الأولى التي لها مفتاح
    const activeLayer = ['temperature', 'precipitation', 'pressure', 'humidity', 'wind', 'clouds']
        .find(l => visibleLayers[l as keyof typeof visibleLayers]);

    if (!activeLayer) return null;

    const legends: Record<string, { title: string; gradient: string; labels: string[] }> = {
        temperature: {
            title: units.temperature === 'celsius' ? 'درجة الحرارة (°م)' : 'درجة الحرارة (°ف)',
            gradient: 'linear-gradient(to right, #5000A0, #4646C8, #64C8FF, #96FFC8, #FFFF64, #FF9632, #FF3232, #B40064)',
            labels: units.temperature === 'celsius' 
                ? ['-40', '-20', '0', '10', '20', '30', '40', '50']
                : ['-40', '-4', '32', '50', '68', '86', '104', '122']
        },
        precipitation: {
            title: units.precipitation === 'mm' ? 'الأمطار (مم/ساعة)' : 'الأمطار (إنش/ساعة)',
            gradient: 'linear-gradient(to right, rgba(150,220,255,0.4), #64B4FF, #3282FF, #1E50DC, #7832C8, #C81E96)',
            labels: units.precipitation === 'mm' 
                ? ['0.1', '1', '3', '8', '15', '30+']
                : ['0.004', '0.04', '0.12', '0.31', '0.59', '1.18+']
        },
        pressure: {
            title: units.pressure === 'hPa' ? 'الضغط الجوي (هكتوباسكال)' : 'الضغط الجوي (إنش زئبق)',
            gradient: 'linear-gradient(to right, #3232C8, #6496DC, #C8DCDC, #DCC896, #DC5050)',
            labels: units.pressure === 'hPa' 
                ? ['970', '990', '1010', '1020', '1040']
                : ['28.6', '29.2', '29.8', '30.1', '30.7']
        },
        humidity: {
            title: 'الرطوبة النسبية (%)',
            gradient: 'linear-gradient(to right, #B47846, #DCC896, #96C8DC, #5096DC, #1E50C8)',
            labels: ['0', '30', '60', '80', '100']
        },
        wind: {
            title: 'سرعة الرياح (كم/س)',
            gradient: 'linear-gradient(to right, #B4DCFF, #96FFC8, #FFFF96, #FFB464, #FF6464, #FF32C8)',
            labels: ['<5', '10', '15', '25', '40', '60+']
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
        <div className="layer-legend">
            <div className="legend-title">{legend.title}</div>
            <div className="legend-bar" style={{ background: legend.gradient }}></div>
            <div className="legend-labels">
                {legend.labels.map((label, i) => (
                    <span key={i} className="legend-label">{label}</span>
                ))}
            </div>
        </div>
    );
}
