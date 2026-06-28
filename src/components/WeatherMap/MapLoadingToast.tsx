/**
 * MapLoadingToast.tsx
 * مؤشّر تحميل علوي (أسلوب Zoom Earth) يظهر **فقط عند تبديل النموذج أو الطبقة** — لا عند
 * تغيّر الوقت أثناء التشغيل (كي لا يومض كل خطوة). يكشف الجهوزية بتحميل صورة الإطار الحالي
 * للطبقة الفعّالة (يشارك طلب المتصفّح نفسه، فإن كانت مخزّنة يختفي فوراً بلا وميض).
 */
import { useEffect, useRef, useState } from 'react';
import { useWeatherStore } from '../../store/weatherStore';
import type { ForecastGridType } from '../../config/weatherLayers';
import type { WeatherModelId } from '../../store/types';

interface Props {
    rasterDir: string;
    activeType: ForecastGridType | null;
    windVisible: boolean;
    modelName: WeatherModelId;
}

const LAYER_LABELS: Record<string, string> = {
    wind: 'الرياح', 'wind-gusts': 'هبّات الرياح', precipitation: 'الأمطار',
    temperature: 'الحرارة', 'feels-like': 'الإحساس الحراري', 'wet-bulb': 'اللمبة الرطبة',
    pressure: 'الضغط', humidity: 'الرطوبة', dewpoint: 'نقطة الندى', clouds: 'الغيوم',
};

export function MapLoadingToast({ rasterDir, activeType, windVisible, modelName }: Props) {
    const [loading, setLoading] = useState(false);
    const [label, setLabel] = useState('');
    const prevModel = useRef(modelName);

    // يعمل فقط عند تغيّر النموذج (rasterDir) أو الطبقة (activeType/wind) — لا الوقت.
    useEffect(() => {
        const type = activeType ?? (windVisible ? 'wind' : null);
        if (!type) { setLoading(false); return; }

        const idx = useWeatherStore.getState().currentTimeIndex;
        const url = `${import.meta.env.BASE_URL}${rasterDir}${type}_${String(idx).padStart(3, '0')}.png`;

        const modelSwitched = prevModel.current !== modelName;
        prevModel.current = modelName;
        setLabel(modelSwitched ? `جارٍ تحميل نموذج ${modelName}` : `جارٍ تحميل ${LAYER_LABELS[type] ?? type}`);

        let cancelled = false;
        const img = new Image();
        const done = () => { if (!cancelled) setLoading(false); };
        img.onload = done;
        img.onerror = done;
        img.src = url;
        // إن كانت الصورة مخزّنة فعلاً (complete فوراً) فلا نُظهر المؤشّر إطلاقاً (بلا وميض).
        if (img.complete) { setLoading(false); }
        else { setLoading(true); }

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rasterDir, activeType, windVisible, modelName]);

    if (!loading) return null;
    return (
        <div className="map-loading-toast" role="status" aria-live="polite">
            <span className="map-loading-spinner" aria-hidden="true" />
            <span>{label}…</span>
        </div>
    );
}
