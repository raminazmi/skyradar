import { useWeatherStore } from '../../store/weatherStore';
import { FORECAST_LAYER_IDS } from '../../config/weatherLayers';

interface LegendSpec {
    title: string;
    gradient: string;
    labels: string[];
}

export function CentralLegend() {
    const { visibleLayers, units } = useWeatherStore();
    const activeLayer = FORECAST_LAYER_IDS.find((layer) => visibleLayers[layer]);
    if (!activeLayer) return null;

    const legends: Record<string, LegendSpec> = {
        wind: {
            title: 'سرعة الرياح (كم/س)',
            gradient: 'linear-gradient(to right, #4b77ae, #67b1c1, #8de6a4, #fef375, #f09a5c, #ce5f64, #973b6b)',
            labels: ['0', '20', '40', '60', '80', '100', '120'],
        },
        'wind-gusts': {
            title: 'هبّات الرياح (كم/س)',
            gradient: 'linear-gradient(to right, #3a4db2, #3ba8b5, #97d878, #f3c75d, #ea7253, #d34a8e, #8c3db0)',
            labels: ['0', '30', '60', '90', '120', '160', '220'],
        },
        temperature: {
            title: units.temperature === 'celsius' ? 'درجة الحرارة (°م)' : 'درجة الحرارة (°ف)',
            gradient: 'linear-gradient(to right, #341f66, #4e3599, #325cc2, #2f8fd7, #42c2d1, #60e0be, #b5e87e, #f6dd56, #f69739, #e04934, #a92354)',
            labels: units.temperature === 'celsius'
                ? ['-50', '-30', '-10', '0', '10', '20', '30', '40', '50']
                : ['-58', '-22', '14', '32', '50', '68', '86', '104', '122'],
        },
        'feels-like': {
            title: units.temperature === 'celsius' ? 'الإحساس الحراري (°م)' : 'الإحساس الحراري (°ف)',
            gradient: 'linear-gradient(to right, #443599, #317ed3, #4bd1cf, #b7e87e, #f6c54a, #ea6548, #b42b6e)',
            labels: units.temperature === 'celsius'
                ? ['-40', '-20', '0', '16', '28', '38', '50']
                : ['-40', '-4', '32', '61', '82', '100', '122'],
        },
        precipitation: {
            title: units.precipitation === 'mm' ? 'الهطول (مم/ساعة)' : 'الهطول (إنش/ساعة)',
            gradient: 'linear-gradient(to right, rgba(154,226,255,0.5), #68cdff, #3f9cff, #2e5be2, #7448da, #cb36ab, #ff4d60, #fff45a)',
            labels: units.precipitation === 'mm'
                ? ['0.1', '1', '2', '5', '10', '20', '40+']
                : ['0.004', '0.04', '0.08', '0.2', '0.4', '0.8', '1.6+'],
        },
        pressure: {
            title: units.pressure === 'hPa' ? 'الضغط الجوي (hPa)' : 'الضغط الجوي (inHg)',
            gradient: 'linear-gradient(to right, #244b95, #3389b2, #75c6ca, #e0e2d8, #e5ab8d, #ca554c)',
            labels: units.pressure === 'hPa'
                ? ['960', '980', '1000', '1013', '1025', '1045']
                : ['28.3', '28.9', '29.5', '29.9', '30.3', '30.9'],
        },
        humidity: {
            title: 'الرطوبة النسبية (%)',
            gradient: 'linear-gradient(to right, #aa764b, #dec891, #98d3cc, #4dabda, #2452be)',
            labels: ['0', '30', '55', '75', '100'],
        },
        dewpoint: {
            title: units.temperature === 'celsius' ? 'نقطة الندى (°م)' : 'نقطة الندى (°ف)',
            gradient: 'linear-gradient(to right, #765c48, #be9c5c, #aedaA8, #50b8ce, #1f75d6, #4638ae)',
            labels: units.temperature === 'celsius'
                ? ['-20', '0', '10', '18', '24', '30']
                : ['-4', '32', '50', '64', '75', '86'],
        },
        clouds: {
            title: 'الغطاء السحابي (%)',
            gradient: 'linear-gradient(to right, rgba(165,210,240,0.2), rgba(211,232,248,0.52), rgba(255,255,255,0.82))',
            labels: ['5', '25', '50', '75', '100'],
        },
    };

    const legend = legends[activeLayer];
    if (!legend) return null;

    return (
        <div className="central-legend">
            <div className="legend-content">
                <div className="legend-title" >{legend.title}</div>
                <div className="legend-bar" style={{ background: legend.gradient }} />
                <div className="legend-labels">
                    {legend.labels.map((label) => <span key={label} className="legend-label">{label}</span>)}
                </div>
            </div>
        </div>
    );
}
