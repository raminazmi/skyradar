import { FiX, FiSettings, FiThermometer, FiWind, FiDroplet, FiActivity, FiSun, FiMoon } from 'react-icons/fi';
import { useWeatherStore } from '../../store/weatherStore';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
    const { units, setUnits, darkMode, setDarkMode } = useWeatherStore();

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FiSettings />
                        <h2>الإعدادات</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}><FiX /></button>
                </div>

                <div className="settings-content">
                    <div className="settings-section">
                        <h3 className="section-title">المظهر</h3>
                        <div className="setting-item">
                            <span className="setting-label">السمة</span>
                            <div className="unit-options">
                                <button className={`unit-option ${!darkMode ? 'active' : ''}`} onClick={() => setDarkMode(false)}>
                                    <FiSun /> فاتح
                                </button>
                                <button className={`unit-option ${darkMode ? 'active' : ''}`} onClick={() => setDarkMode(true)}>
                                    <FiMoon /> داكن
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3 className="section-title">وحدات القياس</h3>
                        
                        <div className="setting-item">
                            <span className="setting-label"><FiThermometer /> الحرارة</span>
                            <div className="unit-options">
                                <button className={`unit-option ${units.temperature === 'celsius' ? 'active' : ''}`} onClick={() => setUnits({ temperature: 'celsius' })}>°مئوية</button>
                                <button className={`unit-option ${units.temperature === 'fahrenheit' ? 'active' : ''}`} onClick={() => setUnits({ temperature: 'fahrenheit' })}>°فهرنهايت</button>
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label"><FiWind /> الرياح</span>
                            <div className="unit-options">
                                <button className={`unit-option ${units.wind === 'kmh' ? 'active' : ''}`} onClick={() => setUnits({ wind: 'kmh' })}>كم/س</button>
                                <button className={`unit-option ${units.wind === 'mph' ? 'active' : ''}`} onClick={() => setUnits({ wind: 'mph' })}>ميل/س</button>
                                <button className={`unit-option ${units.wind === 'ms' ? 'active' : ''}`} onClick={() => setUnits({ wind: 'ms' })}>م/ث</button>
                                <button className={`unit-option ${units.wind === 'knots' ? 'active' : ''}`} onClick={() => setUnits({ wind: 'knots' })}>عقدة</button>
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label"><FiActivity /> الضغط</span>
                            <div className="unit-options">
                                <button className={`unit-option ${units.pressure === 'hPa' ? 'active' : ''}`} onClick={() => setUnits({ pressure: 'hPa' })}>هكتوباسكال</button>
                                <button className={`unit-option ${units.pressure === 'inHg' ? 'active' : ''}`} onClick={() => setUnits({ pressure: 'inHg' })}>إنش زئبق</button>
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label"><FiDroplet /> الأمطار</span>
                            <div className="unit-options">
                                <button className={`unit-option ${units.precipitation === 'mm' ? 'active' : ''}`} onClick={() => setUnits({ precipitation: 'mm' })}>ملم</button>
                                <button className={`unit-option ${units.precipitation === 'inch' ? 'active' : ''}`} onClick={() => setUnits({ precipitation: 'inch' })}>إنش</button>
                            </div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3 className="section-title">حول التطبيق</h3>
                        <div className="about-info">
                            <p><strong>Sky Radar</strong></p>
                            <p>منصة عرض حية للطقس حول العالم</p>
                            <p style={{ opacity: 0.5, fontSize: 11 }}>الإصدار 1.0.0</p>
                            <p style={{ opacity: 0.6, fontSize: 11, marginTop: 8 }}>
                                البيانات: <strong>GFS</strong> (NOAA) و <strong>ICON</strong> (DWD) عبر Open-Meteo
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
