/**
 * useModelLayers.ts
 * يقرأ meta.json لمجلّد النموذج المختار فيُحدّد أيّ طبقات توقّع (forecast) مولَّدة فعلاً
 * لذلك النموذج — فتعرض الواجهة فقط الطبقات العاملة وتُخفي ما لا بيانات له:
 *   - status='ready'  : meta موجود → layers = ما ولّده الخادم (حقل meta.layers)؛ بلا الحقل
 *                       (دورات قديمة) نسقط على كل طبقات التوقّع (سلوك متوافق مع السابق).
 *   - status='missing': لا meta (النموذج لم يُولَّد بعد، مثل ICON محلياً) → لا طبقات توقّع،
 *                       فتُظهر القائمة إشعار "قيد التحضير" بدل طبقات فارغة معطوبة.
 *   - status='loading': أثناء الجلب.
 * طبقات البلاطات (قمر/رادار) والمتابعة (أعاصير/حرائق) مستقلّة عن النموذج، فلا يقيّدها هذا.
 */
import { useEffect, useState } from 'react';
import { FORECAST_LAYER_IDS, type ForecastGridType } from '../../../config/weatherLayers';
import type { WeatherModelId } from '../../../store/types';

export type ModelLayersStatus = 'loading' | 'ready' | 'missing';

export interface ModelLayersState {
    status: ModelLayersStatus;
    layers: Set<ForecastGridType>;
}

function rasterDirFor(model: WeatherModelId): string {
    return model === 'ECMWF' ? 'rasters/ecmwf/'
        : model === 'ICON' ? 'rasters/icon/'
        : 'rasters/';
}

export function useModelLayers(model: WeatherModelId): ModelLayersState {
    const [state, setState] = useState<ModelLayersState>({ status: 'loading', layers: new Set() });

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading', layers: new Set() });
        fetch(`${import.meta.env.BASE_URL}${rasterDirFor(model)}meta.json`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no meta'))))
            .then((m) => {
                if (cancelled) return;
                const list: ForecastGridType[] = Array.isArray(m?.layers) && m.layers.length
                    ? m.layers.filter((l: string): l is ForecastGridType =>
                        (FORECAST_LAYER_IDS as string[]).includes(l))
                    : FORECAST_LAYER_IDS;        // دورات قديمة بلا حقل layers → الكل (متوافق)
                setState({ status: 'ready', layers: new Set(list) });
            })
            .catch(() => { if (!cancelled) setState({ status: 'missing', layers: new Set() }); });
        return () => { cancelled = true; };
    }, [model]);

    return state;
}
