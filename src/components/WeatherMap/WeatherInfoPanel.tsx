import { Fragment } from 'react';
import { FiClock, FiDroplet, FiLoader, FiThermometer, FiWind, FiX } from 'react-icons/fi';
import { weatherService } from '../../services/weatherService';
import { type WeatherData, useWeatherStore } from '../../store/weatherStore';
import { WeatherIcon } from './WeatherIcon';

interface WeatherInfoPanelProps {
    weatherData: WeatherData;
    currentTimeIndex: number;
    location: { lat: number; lon: number } | null;
}

const arabicConditionMap: Record<string, string> = {
    'Clear sky': 'سماء صافية',
    'Mainly clear': 'صافية في الغالب',
    'Partly cloudy': 'غائم جزئياً',
    'Overcast': 'غائم كلياً',
    'Fog': 'ضباب',
    'Rime fog': 'ضباب متجمد',
    'Light drizzle': 'رذاذ خفيف',
    'Moderate drizzle': 'رذاذ متوسط',
    'Dense drizzle': 'رذاذ كثيف',
    'Light rain': 'مطر خفيف',
    'Moderate rain': 'مطر متوسط',
    'Heavy rain': 'مطر غزير',
    'Light showers': 'زخات خفيفة',
    'Moderate showers': 'زخات متوسطة',
    'Heavy showers': 'زخات غزيرة',
    'Light snow': 'ثلج خفيف',
    'Moderate snow': 'ثلج متوسط',
    'Heavy snow': 'ثلج كثيف',
    'Thunderstorm': 'عاصفة رعدية',
    'Thunderstorm + hail': 'عاصفة مع برد',
    'Unknown': 'غير محدد',
};

const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const arabicMonths = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
];

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function formatCoordinate(value: number, positive: string, negative: string) {
    const absolute = Math.abs(value);
    let degrees = Math.floor(absolute);
    let minutes = Math.round((absolute - degrees) * 60);

    if (minutes === 60) {
        degrees += 1;
        minutes = 0;
    }

    return `${degrees}° ${String(minutes).padStart(2, '0')}' ${value >= 0 ? positive : negative}`;
}

function formatHour(date: Date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatUtcOffset(date: Date) {
    const offsetHours = -date.getTimezoneOffset() / 60;
    const sign = offsetHours >= 0 ? '+' : '-';
    return `UTC${sign}${Math.abs(offsetHours)}`;
}

function formatDayDivider(date: Date, previousDate: Date | null) {
    if (!previousDate || date.toDateString() !== previousDate.toDateString()) {
        return `${arabicDays[date.getDay()]} ${date.getDate()} ${arabicMonths[date.getMonth()]}`;
    }

    return null;
}

export function WeatherInfoPanel({ weatherData, currentTimeIndex, location }: WeatherInfoPanelProps) {
    const {
        units,
        selectedModel,
        setCurrentTimeIndex,
        setInfoPanelOpen,
        setSelectedModel,
        availableModels,
        isLoading,
    } = useWeatherStore();

    const times = weatherData.hourly.time;
    if (!times.length) {
        return null;
    }

    const safeIndex = clamp(currentTimeIndex, 0, times.length - 1);
    const currentDate = new Date(Number(times[safeIndex]) * 1000);
    const currentWeatherCode = weatherData.hourly.weather_code?.[safeIndex] ?? 0;
    const currentWeather = weatherService.decodeWeatherCode(
        currentWeatherCode,
        weatherService.isDaytime(currentDate)
    );
    const currentCondition = arabicConditionMap[currentWeather.condition] || currentWeather.description;

    const formatTemperature = (value?: number) => {
        if (value === undefined || Number.isNaN(value)) {
            return '--';
        }

        const converted = units.temperature === 'fahrenheit'
            ? weatherService.convertTemperature(value, true)
            : value;

        return `${Math.round(converted)}°`;
    };

    const formatPrecipitation = (value?: number) => {
        if (value === undefined || Number.isNaN(value)) {
            return '0';
        }

        const converted = units.precipitation === 'inch'
            ? weatherService.convertPrecipitation(value, true)
            : value;

        return converted < 10 ? converted.toFixed(1) : Math.round(converted).toString();
    };

    const formatWind = (value?: number) => {
        if (value === undefined || Number.isNaN(value)) {
            return '--';
        }

        const converted = weatherService.convertWindSpeed(value, units.wind);
        const suffix = units.wind === 'mph'
            ? 'mph'
            : units.wind === 'knots'
                ? 'kt'
                : units.wind === 'ms'
                    ? 'm/s'
                    : 'km/h';

        return `${Math.round(converted)} ${suffix}`;
    };

    const temperature = weatherData.hourly.temperature_2m?.[safeIndex];
    const apparentTemperature = weatherData.hourly.apparent_temperature?.[safeIndex];
    const precipitation = weatherData.hourly.precipitation?.[safeIndex];
    const humidity = weatherData.hourly.relative_humidity_2m?.[safeIndex];
    const windSpeed = weatherData.hourly.wind_speed_10m?.[safeIndex];

    const rowEnd = Math.min(times.length, safeIndex + 18);
    const rows = [];
    let previousDate: Date | null = null;

    for (let index = safeIndex; index < rowEnd; index += 1) {
        const rowDate = new Date(Number(times[index]) * 1000);
        const rowWeather = weatherService.decodeWeatherCode(
            weatherData.hourly.weather_code?.[index] ?? 0,
            weatherService.isDaytime(rowDate)
        );

        rows.push({
            index,
            date: rowDate,
            divider: formatDayDivider(rowDate, previousDate),
            temperature: weatherData.hourly.temperature_2m?.[index],
            precipitation: weatherData.hourly.precipitation?.[index],
            weatherIcon: rowWeather.icon,
        });

        previousDate = rowDate;
    }

    return (
        <div className={`weather-info-panel ${isLoading ? 'is-loading' : ''}`}>
            {isLoading && (
                <div className="weather-panel-loading-overlay">
                    <FiLoader className="panel-spinner" />
                    <span>جاري التحديث...</span>
                </div>
            )}
            <div className="weather-panel-header">
                <button
                    className="panel-close-btn"
                    onClick={() => setInfoPanelOpen(false)}
                    title="إغلاق"
                    type="button"
                >
                    <FiX />
                </button>

                <div className="weather-panel-location">
                    <div className="weather-panel-coords">
                        {location
                            ? `${formatCoordinate(location.lat, 'N', 'S')} , ${formatCoordinate(location.lon, 'E', 'W')}`
                            : 'الموقع المحدد'}
                    </div>
                    <div className="weather-panel-meta">
                        <span>توقعات كل ساعة</span>
                        <span>{weatherData.timezone_abbreviation || formatUtcOffset(currentDate)}</span>
                    </div>
                </div>
            </div>

            <div className="weather-panel-current">
                <div className="weather-panel-current-main">
                    <span className="weather-panel-badge">{formatTemperature(temperature)}</span>
                    <div className="weather-panel-current-copy">
                        <div className="weather-panel-condition">{currentCondition}</div>
                        <div className="weather-panel-feels">إحساس {formatTemperature(apparentTemperature)}</div>
                    </div>
                </div>

                <div className="weather-panel-current-side">
                    <div className="weather-panel-icon">
                        <WeatherIcon icon={currentWeather.icon} size={40} title={currentCondition} />
                    </div>
                    <div className="weather-panel-current-time">
                        <FiClock />
                        <span>{formatHour(currentDate)}</span>
                    </div>
                </div>
            </div>

            {weatherData.stale && (
                <div className="weather-panel-warning">
                    {weatherData.providerMessage || 'يتم عرض نسخة محفوظة مؤقتًا من آخر بيانات متاحة.'}
                </div>
            )}

            <div className="weather-panel-stats">
                <div className="weather-panel-stat">
                    <FiWind />
                    <span>{formatWind(windSpeed)}</span>
                </div>
                <div className="weather-panel-stat">
                    <FiDroplet />
                    <span>{formatPrecipitation(precipitation)} {units.precipitation === 'inch' ? 'in' : 'mm'}</span>
                </div>
                <div className="weather-panel-stat">
                    <FiThermometer />
                    <span>{humidity !== undefined ? `${Math.round(humidity)}%` : '--'}</span>
                </div>
            </div>

            <div className="weather-panel-table-head">
                <span>حرارة</span>
                <span>أمطار</span>
                <span>حالة</span>
                <span>الساعة</span>
            </div>

            <div className="weather-panel-rows">
                {rows.map((row) => (
                    <Fragment key={times[row.index]}>
                        {row.divider && <div className="weather-panel-day-divider">{row.divider}</div>}

                        <button
                            className={`weather-panel-row ${row.index === safeIndex ? 'active' : ''}`}
                            onClick={() => setCurrentTimeIndex(row.index)}
                            type="button"
                        >
                            <span className="weather-panel-row-temp">{formatTemperature(row.temperature)}</span>
                            <span className="weather-panel-row-precip">
                                {formatPrecipitation(row.precipitation)}
                            </span>
                            <span className="weather-panel-row-icon">
                                <WeatherIcon icon={row.weatherIcon} size={20} />
                            </span>
                            <span className="weather-panel-row-time">{formatHour(row.date)}</span>
                        </button>
                    </Fragment>
                ))}
            </div>
        </div>
    );
}
