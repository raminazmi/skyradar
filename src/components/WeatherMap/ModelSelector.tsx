import { FiDatabase } from 'react-icons/fi';
import { useWeatherStore } from '../../store/weatherStore';

export function ModelSelector() {
    const { selectedModel, setSelectedModel } = useWeatherStore();

    const models = [
        { id: 'GFS' as const, name: 'GFS', provider: 'NOAA الأمريكية', color: '#2196F3' },
        { id: 'ICON' as const, name: 'ICON', provider: 'DWD الألمانية', color: '#4CAF50' }
    ];

    return (
        <div className="model-selector">
            <div className="model-selector-header">
                <FiDatabase className="header-icon" />
                <span className="header-title">النموذج الجوي</span>
            </div>
            <div className="model-tabs">
                {models.map((model) => (
                    <button
                        key={model.id}
                        className={`model-tab ${selectedModel === model.id ? 'active' : ''}`}
                        onClick={() => setSelectedModel(model.id)}
                        style={{ '--model-color': model.color } as React.CSSProperties}
                        title={`${model.name} - ${model.provider}`}
                    >
                        <span className="model-name">{model.name}</span>
                        <span className="model-provider">{model.provider}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
