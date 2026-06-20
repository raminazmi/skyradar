import iconStormDay from '../../assets/weather-icons/icons-01.svg';
import iconSandstorm from '../../assets/weather-icons/icons-02.svg';
import iconOvercast from '../../assets/weather-icons/icons-03.svg';
import iconPartlyCloudyNight from '../../assets/weather-icons/icons-04.svg';
import iconPartlyCloudyDay from '../../assets/weather-icons/icons-05.svg';
import iconPartlyCloudyNightAlt from '../../assets/weather-icons/icons-06.svg';
import iconPartlyCloudyDayAlt from '../../assets/weather-icons/icons-07.svg';
import iconStormNight from '../../assets/weather-icons/icons-08.svg';
import iconRainDay from '../../assets/weather-icons/icons-09.svg';
import iconRainGeneric from '../../assets/weather-icons/icons-10.svg';
import iconWind from '../../assets/weather-icons/icons-11.svg';
import iconOvercastAlt from '../../assets/weather-icons/icons-12.svg';
import iconClearNight from '../../assets/weather-icons/icons-13.svg';
import iconClearDay from '../../assets/weather-icons/icons-14.svg';
import iconStormGeneric from '../../assets/weather-icons/icons-15.svg';
import iconRainWind from '../../assets/weather-icons/icons-16.svg';
import iconRainHeavy from '../../assets/weather-icons/icons-17.svg';
import iconSnow from '../../assets/weather-icons/icons-18.svg';
import iconSnowGeneric from '../../assets/weather-icons/icons-19.svg';
import iconRainNight from '../../assets/weather-icons/icons-20.svg';

/**
 * Maps the icon keys produced by `weatherService.decodeWeatherCode` to the
 * actual SVG asset. These icons use white/light fills designed for the
 * app's dark theme (`.weather-map-container.dark`).
 */
const ICON_MAP: Record<string, string> = {
    'clear-day': iconClearDay,
    'clear-night': iconClearNight,
    'partly-cloudy-day': iconPartlyCloudyDay,
    'partly-cloudy-day-alt': iconPartlyCloudyDayAlt,
    'partly-cloudy-night': iconPartlyCloudyNight,
    'partly-cloudy-night-alt': iconPartlyCloudyNightAlt,
    overcast: iconOvercast,
    'overcast-alt': iconOvercastAlt,
    'rain-day': iconRainDay,
    'rain-night': iconRainNight,
    'rain-generic': iconRainGeneric,
    'rain-heavy': iconRainHeavy,
    'rain-wind': iconRainWind,
    snow: iconSnow,
    'snow-generic': iconSnowGeneric,
    'storm-day': iconStormDay,
    'storm-night': iconStormNight,
    'storm-generic': iconStormGeneric,
    sandstorm: iconSandstorm,
    wind: iconWind,
};

interface WeatherIconProps {
    icon: string;
    size?: number;
    className?: string;
    title?: string;
}

export function WeatherIcon({ icon, size = 32, className, title }: WeatherIconProps) {
    const src = ICON_MAP[icon] ?? iconOvercast;

    return (
        <img
            src={src}
            alt={title ?? icon}
            title={title}
            width={size}
            height={size}
            className={className ? `weather-icon ${className}` : 'weather-icon'}
            draggable={false}
        />
    );
}
