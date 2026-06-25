import { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiLayers, FiX } from 'react-icons/fi';
import { WEATHER_LAYER_CONFIGS } from '../../config/weatherLayers';
import { LayerKey, useWeatherStore } from '../../store/weatherStore';

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
        visibleLayers, setActiveLayer,
        infoPanelOpen, layerControlsOpen, setLayerControlsOpen,
    } = useWeatherStore();
    const [collapsed, setCollapsed] = useState(false);

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
                {active && g.variants && (
                    <div className="layer-variants">
                        {g.variants.map((v) => {
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
                    {LAYER_GROUPS.map(renderGroup)}
                    <div className="layer-controls-divider" />
                    {EXTRA_LAYER_IDS.map(renderExtra)}
                </div>
            )}
        </div>
    );
}
