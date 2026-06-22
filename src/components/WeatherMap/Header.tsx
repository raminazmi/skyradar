import { useWeatherStore } from '../../store/weatherStore';
import { FiMenu, FiSettings } from 'react-icons/fi';

export function Header() {
    const { setSidebarOpen, setSettingsOpen, selectedModel, setSelectedModel, availableModels } = useWeatherStore();

    return (
        <div className="app-header">
            <div className="flex items-center gap-3 w-[220px] min-w-0">
                <button
                    className="menu-btn w-8 h-8 flex items-center justify-center bg-white/[0.08] border border-[var(--border-color)] rounded-lg text-inherit cursor-pointer text-base transition-all duration-200 hover:bg-white/[0.12]"
                    onClick={() => setSidebarOpen(true)}
                    title="القائمة"
                >
                    <FiMenu />
                </button>
                <div className="flex items-center gap-[10px] min-w-0">
                    <img src="/sky-radar-logo-dark.svg" alt="Sky Radar" className="h-14 w-auto shrink-0" />
                </div>
            </div>
            {/* مبدّل النموذج الجوي (مثل Zoom Earth): زرّان GFS/ICON — النقر يبدّل بيانات الخريطة */}
            <div className="absolute left-1/2 -translate-x-1/2 flex justify-center">
                <div className="flex items-center gap-0.5 p-0.5 bg-black/40 border border-[var(--border-color)] rounded-full backdrop-blur-sm">
                    {availableModels.map((model) => {
                        const active = selectedModel === model.id;
                        return (
                            <button
                                key={model.id}
                                onClick={() => setSelectedModel(model.id)}
                                title={`${model.name} — ${model.resolution}`}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs cursor-pointer transition-all duration-200 ${active
                                    ? 'bg-white text-gray-900 shadow font-bold'
                                    : 'text-white/60 hover:text-white/90 font-semibold'
                                    }`}
                            >
                                <span>{model.name}</span>
                                <span className={`text-[11px] font-medium ${active ? 'opacity-60' : 'opacity-50'}`}>
                                    {model.resolution}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="flex items-center">
                <button
                    className="w-8 h-8 flex items-center justify-center bg-white/[0.08] border border-[var(--border-color)] rounded-lg text-inherit cursor-pointer text-base transition-all duration-200 hover:bg-white/[0.12]"
                    onClick={() => setSettingsOpen(true)}
                    title="الإعدادات"
                >
                    <FiSettings />
                </button>
            </div>
        </div>
    );
}
