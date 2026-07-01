import { FiWind } from 'react-icons/fi';
import { useWeatherStore } from '../../store/weatherStore';
import { LAYER_PRESENTATION } from '../../config/layerAnimation';
import type { LayerKey } from '../../config/layerAnimation';

interface Props {
    /** الطبقة الفعّالة (نفس منطق NewWeatherMap). */
    activeLayerKey: string | null;
}

/**
 * زرّ سريع لتشغيل/إطفاء جسيمات الرياح للطبقة الفعّالة (أسلوب Zoom Earth).
 * يظهر فقط للطبقات التي تدعم الجسيمات (الرياح + كل الطبقات العددية).
 */
export function ParticleToggle({ activeLayerKey }: Props) {
    const { particlesEnabled, setParticlesEnabled } = useWeatherStore();
    if (!activeLayerKey) return null;

    const key = activeLayerKey as LayerKey;
    const cfg = LAYER_PRESENTATION[key];
    const supportsParticles = key === 'wind' || !!cfg?.requiresWindGrid;
    if (!supportsParticles) return null;

    // مفتاح عالمي: يبقى مُفعّلاً عبر كل الطبقات (لا يتوقّف عند تبديل الطبقة).
    const enabled = particlesEnabled;

    return (
        <button
            className={`particle-toggle ${enabled ? 'active' : ''}`}
            onClick={() => setParticlesEnabled(!enabled)}
            title={enabled ? 'إخفاء جسيمات الرياح' : 'إظهار جسيمات الرياح'}
            type="button"
        >
            <FiWind />
            <span>جسيمات الرياح</span>
        </button>
    );
}
