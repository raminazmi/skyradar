import { FiActivity } from 'react-icons/fi';
import { useWeatherStore } from '../../store/weatherStore';

interface Props {
    /** الطبقة الفعّالة — الزرّ يظهر فقط عندما تكون "الضغط". */
    activeLayerKey: string | null;
}

/**
 * زرّ سياقي لتشغيل/إطفاء خطوط تساوي الضغط (isobars) — يظهر فقط مع طبقة الضغط (أسلوب Zoom Earth).
 */
export function IsobarToggle({ activeLayerKey }: Props) {
    const { isobarsEnabled, setIsobarsEnabled } = useWeatherStore();
    if (activeLayerKey !== 'pressure') return null;

    return (
        <button
            className={`particle-toggle isobar-toggle ${isobarsEnabled ? 'active' : ''}`}
            onClick={() => setIsobarsEnabled(!isobarsEnabled)}
            title={isobarsEnabled ? 'إخفاء خطوط تساوي الضغط' : 'إظهار خطوط تساوي الضغط'}
            type="button"
        >
            <FiActivity />
            <span>خطوط الضغط</span>
        </button>
    );
}
