import { useWeatherStore } from '../../store/weatherStore';

/**
 * مبدّل النموذج الجوي على الصفحة الرئيسية (أسلوب Zoom Earth): زرّان GFS/ECMWF
 * ظاهران دائماً فوق الخريطة — النقر يبدّل مجموعة الـ rasters فوراً.
 */
export function ModelSwitch() {
    const { availableModels, selectedModel, setSelectedModel } = useWeatherStore();

    return (
        <div className="main-model-switch">
            {availableModels.map((model) => (
                <button
                    key={model.id}
                    className={`main-model-btn ${selectedModel === model.id ? 'active' : ''}`}
                    onClick={() => setSelectedModel(model.id)}
                    type="button"
                    title={`النموذج: ${model.name} (${model.resolution})`}
                >
                    <span className="main-model-name">{model.name}</span>
                    <span className="main-model-res">{model.resolution}</span>
                </button>
            ))}
        </div>
    );
}
