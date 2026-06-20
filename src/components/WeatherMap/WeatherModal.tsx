import React, { useEffect, useState } from 'react';
import { FiX, FiMapPin, FiThermometer, FiWind, FiCloud, FiDroplet } from 'react-icons/fi';
import { WeatherResponse } from '../../services/weatherService';
import './WeatherModal.css';

interface WeatherModalProps {
    isOpen: boolean;
    onClose: () => void;
    cityName: string;
    countryName: string;
    latitude: number;
    longitude: number;
    weatherData: WeatherResponse | null;
    loading: boolean;
}

interface CurrentWeatherSnapshot {
    time: string | number;
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    windGusts: number;
    precipitation: number;
    cloudCover: number;
    pressure: number;
    visibility: number;
    weatherCode: number;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
    isOpen,
    onClose,
    cityName,
    countryName,
    latitude,
    longitude,
    weatherData,
    loading
}) => {
    const [currentWeather, setCurrentWeather] = useState<CurrentWeatherSnapshot | null>(null);

    const toDate = (value: string | number): Date => {
        const numericValue = Number(value);

        if (Number.isFinite(numericValue)) {
            return new Date(numericValue < 100000000000 ? numericValue * 1000 : numericValue);
        }

        return new Date(value);
    };

    useEffect(() => {
        if (weatherData && weatherData.hourly.time.length > 0) {
            const now = Date.now();
            let latestIndex = 0;
            let smallestDiff = Number.POSITIVE_INFINITY;

            weatherData.hourly.time.forEach((time, index) => {
                const diff = Math.abs(toDate(time).getTime() - now);
                if (diff < smallestDiff) {
                    smallestDiff = diff;
                    latestIndex = index;
                }
            });

            setCurrentWeather({
                time: weatherData.hourly.time[latestIndex],
                temperature: weatherData.hourly.temperature_2m[latestIndex],
                apparentTemperature: weatherData.hourly.apparent_temperature[latestIndex],
                humidity: weatherData.hourly.relative_humidity_2m[latestIndex],
                windSpeed: weatherData.hourly.wind_speed_10m[latestIndex],
                windDirection: weatherData.hourly.wind_direction_10m[latestIndex],
                windGusts: weatherData.hourly.wind_gusts_10m[latestIndex],
                precipitation: weatherData.hourly.precipitation[latestIndex],
                cloudCover: weatherData.hourly.cloud_cover[latestIndex],
                pressure: weatherData.hourly.surface_pressure[latestIndex],
                visibility: weatherData.hourly.visibility[latestIndex],
                weatherCode: weatherData.hourly.weather_code?.[latestIndex] ?? 0
            });
        } else {
            setCurrentWeather(null);
        }
    }, [weatherData]);

    if (!isOpen) return null;

    const getWeatherDescription = (code: number): string => {
        const descriptions: Record<number, string> = {
            0: 'صافي',
            1: 'غائم جزئيًا',
            2: 'غائم',
            3: 'غائم كثيف',
            45: 'ضباب',
            48: 'ضباب متجمد',
            51: 'رذاذ خفيف',
            53: 'رذاذ متوسط',
            55: 'رذاذ ثقيل',
            61: 'مطر خفيف',
            63: 'مطر متوسط',
            65: 'مطر ثقيل',
            71: 'ثلج خفيف',
            73: 'ثلج متوسط',
            75: 'ثلج ثقيل',
            77: 'حبيبات ثلجية',
            80: 'زخات مطر خفيفة',
            81: 'زخات مطر متوسطة',
            82: 'زخات مطر ثقيلة',
            85: 'زخات ثلجية خفيفة',
            86: 'زخات ثلجية ثقيلة',
            95: 'عاصفة رعدية',
            96: 'عاصفة رعدية خفيفة',
            99: 'عاصفة رعدية قوية'
        };
        return descriptions[code] || 'غير محدد';
    };

    return (
        <div className="weather-modal-overlay" onClick={onClose}>
            <div className="weather-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="weather-modal-header">
                    <div className="weather-modal-title">
                        <FiMapPin className="modal-icon" />
                        <div>
                            <h2>{cityName || 'موقع محدد'}</h2>
                            {countryName && <p className="country-name">{countryName}</p>}
                        </div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <FiX size={24} />
                    </button>
                </div>

                {loading ? (
                    <div className="modal-loading">
                        <div className="spinner"></div>
                        <p>جارٍ تحميل بيانات الطقس...</p>
                    </div>
                ) : currentWeather ? (
                    <div className="weather-modal-body">
                        <div className="coordinates">
                            <small>الإحداثيات: {latitude.toFixed(4)}, {longitude.toFixed(4)}</small>
                        </div>

                        <div className="weather-main-section">
                            <div className="temperature-display">
                                <div className="temp-value">
                                    <FiThermometer size={32} />
                                    <span>{Math.round(currentWeather.temperature)}°C</span>
                                </div>
                                <div className="temp-details">
                                    <p>درجة الحرارة المحسوسة: {Math.round(currentWeather.apparentTemperature)}°C</p>
                                    <p className="weather-description">{getWeatherDescription(currentWeather.weatherCode)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="weather-grid">
                            <div className="weather-item">
                                <FiWind className="weather-item-icon" />
                                <div className="weather-item-content">
                                    <span className="label">الرياح</span>
                                    <span className="value">{Math.round(currentWeather.windSpeed)} كم/س</span>
                                    <small>الاتجاه: {Math.round(currentWeather.windDirection)}°</small>
                                </div>
                            </div>

                            <div className="weather-item">
                                <FiDroplet className="weather-item-icon" />
                                <div className="weather-item-content">
                                    <span className="label">الرطوبة</span>
                                    <span className="value">{Math.round(currentWeather.humidity)}%</span>
                                </div>
                            </div>

                            <div className="weather-item">
                                <FiCloud className="weather-item-icon" />
                                <div className="weather-item-content">
                                    <span className="label">الغيوم</span>
                                    <span className="value">{Math.round(currentWeather.cloudCover)}%</span>
                                </div>
                            </div>

                            <div className="weather-item">
                                <div className="weather-item-icon">🌧</div>
                                <div className="weather-item-content">
                                    <span className="label">الهطول</span>
                                    <span className="value">{(currentWeather.precipitation || 0).toFixed(1)} ملم</span>
                                </div>
                            </div>

                            <div className="weather-item">
                                <div className="weather-item-icon">📏</div>
                                <div className="weather-item-content">
                                    <span className="label">الضغط</span>
                                    <span className="value">{Math.round(currentWeather.pressure || 0)} hPa</span>
                                </div>
                            </div>

                            <div className="weather-item">
                                <div className="weather-item-icon">👁️</div>
                                <div className="weather-item-content">
                                    <span className="label">الرؤية</span>
                                    <span className="value">{Math.round((currentWeather.visibility || 10000) / 1000)} كم</span>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <p className="update-time">آخر تحديث: {toDate(currentWeather.time).toLocaleString('ar-SA')}</p>
                        </div>
                    </div>
                ) : (
                    <div className="modal-error">
                        <p>لم نتمكن من تحميل بيانات الطقس</p>
                    </div>
                )}
            </div>
        </div>
    );
};
