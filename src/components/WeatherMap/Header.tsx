import { useWeatherStore } from '../../store/weatherStore';
import { FiMenu, FiSettings } from 'react-icons/fi';

export function Header() {
    const { setSidebarOpen, setSettingsOpen, selectedModel, availableModels } = useWeatherStore();

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
            <div className="absolute left-1/2 -translate-x-1/2 w-[150px] flex justify-center">
                <div
                    className={`flex items-center gap-[6px] px-3 py-1 bg-white/[0.06] border rounded-full text-xs font-bold ${selectedModel.toLowerCase() === 'gfs'
                        ? 'border-[#2196f3] text-[#2196f3]'
                        : selectedModel.toLowerCase() === 'icon'
                            ? 'border-[#4caf50] text-[#4caf50]'
                            : 'border-[var(--border-color)]'
                        }`}
                >
                    <span
                        className={`w-2 h-2 rounded-full bg-current animate-pulse ${selectedModel.toLowerCase() === 'gfs'
                            ? 'bg-[#2196f3]'
                            : selectedModel.toLowerCase() === 'icon'
                                ? 'bg-[#4caf50]'
                                : ''
                            }`}
                    ></span>
                    <span>{selectedModel}</span>
                    <span className="text-[11px] opacity-60 font-medium">
                        {availableModels.find(m => m.id === selectedModel)?.resolution}
                    </span>
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
