/**
 * IsobarLayer.tsx — يرسم خطوط تساوي الضغط المُستخرَجة كـ GeoJSON على MapLibre.
 * يظهر فقط عند تفعيل طبقة الضغط + تفعيل الخطوط. خطوط بيضاء رفيعة فوق القاعدة الرمادية.
 */
import { Source, Layer } from 'react-map-gl/maplibre';
import { usePressureIsobars } from './hooks/usePressureIsobars';

interface Props {
    timeIndex: number;
    dir: string;      // مجلّد النموذج (rasters/ أو rasters/ecmwf/)
    enabled: boolean;
}

export function IsobarLayer({ timeIndex, dir, enabled }: Props) {
    const data = usePressureIsobars(timeIndex, dir, enabled);
    if (!enabled || !data) return null;

    return (
        <Source id="isobars" type="geojson" data={data}>
            <Layer
                id="isobars-line"
                type="line"
                paint={{
                    'line-color': 'rgba(40, 40, 50, 0.55)',
                    'line-width': 1,
                }}
            />
        </Source>
    );
}
