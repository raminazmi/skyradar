import { useEffect, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiLayers, FiX } from 'react-icons/fi';
import { WEATHER_LAYER_CONFIGS, FORECAST_LAYER_IDS, type ForecastGridType } from '../../config/weatherLayers';
import { LayerKey, useWeatherStore } from '../../store/weatherStore';
import { useModelLayers } from './hooks/useModelLayers';

const isForecastLayer = (id: LayerKey): id is ForecastGridType =>
    (FORECAST_LAYER_IDS as string[]).includes(id);

/**
 * بنية قائمة الطبقات بترتيب Zoom Earth نفسه، مع متغيّرات فرعية لكل طبقة رئيسية
 * (الرياح → سرعة/هبّات، الحرارة → فعلي/إحساس، الرطوبة → نسبية/ندى). الطبقات الإضافية
 * (لدينا ولا توجد في Zoom Earth) أسفل القائمة.
 */
interface VariantDef { id: LayerKey; label: string; }
interface GroupDef { parentId: LayerKey; label: string; variants?: VariantDef[]; }

const LAYER_GROUPS: GroupDef[] = [
    { parentId: 'satellite', label: 'قمر اصطناعي' },
    { parentId: 'radar', label: 'رادار' },
    { parentId: 'precipitation', label: 'هطول الأمطار' },
    { parentId: 'wind', label: 'الرياح', variants: [
        { id: 'wind', label: 'سرعة الرياح' },
        { id: 'wind-gusts', label: 'هبّات الرياح' },
    ] },
    { parentId: 'temperature', label: 'درجة الحرارة', variants: [
        { id: 'temperature', label: 'فعلي' },
        { id: 'feels-like', label: 'الإحساس الحراري' },
        { id: 'wet-bulb', label: 'اللمبة الرطبة' },
    ] },
    { parentId: 'humidity', label: 'الرطوبة', variants: [
        { id: 'humidity', label: 'النسبية' },
        { id: 'dewpoint', label: 'نقطة الندى' },
    ] },
    { parentId: 'pressure', label: 'الضغط' },
];

// طبقات إضافية لدينا (غير موجودة في Zoom Earth) — تظهر أسفل القائمة كما طلب المستخدم.
const EXTRA_LAYER_IDS: LayerKey[] = ['clouds', 'hurricanes', 'wildfires'];

export function LayerControls() {
    const {
        visibleLayers, setActiveLayer, closeAllLayers,
        infoPanelOpen, layerControlsOpen, setLayerControlsOpen,
        selectedModel,
    } = useWeatherStore();
    const [collapsed, setCollapsed] = useState(false);

    // الطبقات العاملة للنموذج المختار (من meta.json). نُخفي غير المتاحة من القائمة.
    const { status: modelStatus, layers: availableLayers } = useModelLayers(selectedModel);
    const layerAvailable = (id: LayerKey): boolean =>
        !isForecastLayer(id) || availableLayers.has(id);   // البلاطات/المتابعة دائماً متاحة

    // عند تبديل النموذج: إن كانت طبقة التوقّع المعروضة غير متاحة في النموذج الجديد، ننتقل
    // لأوّل طبقة متاحة (منطق متّسق، بلا طبقة فارغة معطوبة). إن لم تتوفّر أيّ طبقة توقّع
    // (النموذج قيد التحضير) نُغلق طبقات التوقّع المعروضة فقط.
    useEffect(() => {
        if (modelStatus === 'loading') return;
        const shownForecast = FORECAST_LAYER_IDS.filter((id) => visibleLayers[id]);
        const brokenShown = shownForecast.filter((id) => !availableLayers.has(id));
        if (brokenShown.length === 0) return;
        const firstAvailable = FORECAST_LAYER_IDS.find((id) => availableLayers.has(id));
        if (firstAvailable) setActiveLayer(firstAvailable);
        else closeAllLayers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelStatus, selectedModel]);

    const groupActive = (g: GroupDef): boolean =>
        g.variants ? g.variants.some((v) => visibleLayers[v.id]) : !!visibleLayers[g.parentId];

    const activeCount = LAYER_GROUPS.filter(groupActive).length
        + EXTRA_LAYER_IDS.filter((id) => visibleLayers[id]).length;

    if (!layerControlsOpen) {
        return (
            <button
                className={`layer-controls-toggle ${infoPanelOpen ? 'with-info-panel' : ''}`}
                onClick={() => setLayerControlsOpen(true)}
                title="فتح الطبقات"
            >
                <FiLayers />
                {activeCount > 0 && <span className="layer-count-badge">{activeCount}</span>}
            </button>
        );
    }

    const renderGroup = (g: GroupDef) => {
        // أخفِ مجموعات التوقّع (ومتغيّراتها) غير المتاحة للنموذج؛ البلاطات (قمر/رادار) تبقى.
        const variants = g.variants?.filter((v) => layerAvailable(v.id));
        if (g.variants) {
            if (!variants || variants.length === 0) return null;
        } else if (!layerAvailable(g.parentId)) {
            return null;
        }
        const cfg = WEATHER_LAYER_CONFIGS[g.parentId];
        const Icon = cfg.icon;
        const active = groupActive(g);
        // النقر على الرئيسية: المجموعات ذات المتغيّرات تُفعّل أوّل متغيّر (وتُبقيه عند إعادة
        // النقر)؛ الطبقات المفردة (قمر/رادار) تُبدّل عبر setActiveLayer مباشرةً (تشغيل/إيقاف).
        const onParent = () => {
            if (g.variants) {
                if (!active) setActiveLayer(g.variants[0].id);
            } else {
                setActiveLayer(g.parentId);
            }
        };
        return (
            <div key={g.parentId} className={`layer-control-block ${active ? 'active' : ''}`}>
                <button className={`layer-control-item ${active ? 'active' : ''}`} onClick={onParent}>
                    <span className="layer-emoji"><Icon style={{ color: cfg.color }} /></span>
                    <span className="layer-name">{g.label}</span>
                    <div className={`layer-toggle ${active ? 'on' : ''}`}><div className="toggle-slider" /></div>
                </button>

                {/* المتغيّرات الفرعية تظهر عند تفعيل المجموعة (كـ Zoom Earth) */}
                {active && variants && (
                    <div className="layer-variants">
                        {variants.map((v) => {
                            const on = visibleLayers[v.id];
                            return (
                                <button
                                    key={v.id}
                                    className={`layer-variant-item ${on ? 'active' : ''}`}
                                    onClick={() => setActiveLayer(v.id)}
                                >
                                    <span className={`variant-dot ${on ? 'on' : ''}`} />
                                    <span className="variant-name">{v.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderExtra = (id: LayerKey) => {
        if (!layerAvailable(id)) return null;   // مثل الغيوم: تُخفى إن لم يولّدها النموذج
        const cfg = WEATHER_LAYER_CONFIGS[id];
        const Icon = cfg.icon;
        const active = !!visibleLayers[id];
        return (
            <div key={id} className={`layer-control-block ${active ? 'active' : ''}`}>
                <button className={`layer-control-item ${active ? 'active' : ''}`} onClick={() => setActiveLayer(id)}>
                    <span className="layer-emoji"><Icon style={{ color: cfg.color }} /></span>
                    <span className="layer-name">{cfg.labelAr}</span>
                    <div className={`layer-toggle ${active ? 'on' : ''}`}><div className="toggle-slider" /></div>
                </button>
            </div>
        );
    };

    return (
        <div className={`layer-controls ${collapsed ? 'collapsed' : ''} ${infoPanelOpen ? 'with-info-panel' : ''}`}>
            <div className="layer-controls-header">
                <div className="header-info">
                    <FiLayers className="header-icon" />
                    <span className="header-title">خرائط الطقس</span>
                </div>
                <div className="header-actions">
                    <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'توسيع' : 'طي'}>
                        {collapsed ? <FiChevronDown /> : <FiChevronUp />}
                    </button>
                    <button className="icon-btn close-btn" onClick={() => setLayerControlsOpen(false)} title="إغلاق">
                        <FiX />
                    </button>
                </div>
            </div>

            {!collapsed && (
                <div className="layer-controls-list">
                    {modelStatus === 'missing' && (
                        <div className="layer-model-notice">
                            طبقات هذا النموذج قيد التحضير على الخادم — اختر نموذجاً آخر مؤقّتاً.
                        </div>
                    )}
                    {LAYER_GROUPS.map(renderGroup)}
                    <div className="layer-controls-divider" />
                    {EXTRA_LAYER_IDS.map(renderExtra)}
                </div>
            )}
        </div>
    );
}
