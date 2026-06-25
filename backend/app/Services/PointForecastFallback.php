<?php

namespace App\Services;

class PointForecastFallback
{
    public static function make(float $lat, float $lon, string $model, int $hours): array
    {
        $runEpoch = now()->startOfHour()->timestamp;
        $series = [
            'time' => [],
            'temperature_2m' => [],
            'apparent_temperature' => [],
            'dew_point_2m' => [],
            'relative_humidity_2m' => [],
            'wind_speed_10m' => [],
            'wind_direction_10m' => [],
            'wind_gusts_10m' => [],
            'precipitation' => [],
            'rain' => [],
            'snowfall' => [],
            'weather_code' => [],
            'cloud_cover' => [],
            'surface_pressure' => [],
            'visibility' => [],
        ];

        for ($i = 0; $i < $hours; $i++) {
            $wave = sin(deg2rad(($lon * 2.2) + ($i * 7))) + cos(deg2rad(($lat * 2.8) - ($i * 5)));
            $temp = 27 - (abs($lat) * 0.25) + ($wave * 3.2);
            $humidity = max(10, min(100, 60 + ($wave * 18) - (abs($lat) * 0.12)));
            $wind = max(1, 16 + ($wave * 6));
            $clouds = max(0, min(100, 45 + ($wave * 28)));
            $precip = max(0, ($wave + 1.1) * 1.4);

            $series['time'][] = $runEpoch + ($i * 3600);
            $series['temperature_2m'][] = round($temp, 1);
            $series['apparent_temperature'][] = round($temp + (($humidity - 50) * 0.04) - ($wind * 0.05), 1);
            $series['dew_point_2m'][] = round($temp - ((100 - $humidity) / 5), 1);
            $series['relative_humidity_2m'][] = round($humidity, 1);
            $series['wind_speed_10m'][] = round($wind, 1);
            $series['wind_direction_10m'][] = round(fmod(220 + ($lon * 1.4) - ($lat * 0.7) + ($i * 4) + 360, 360), 1);
            $series['wind_gusts_10m'][] = round($wind * 1.45, 1);
            $series['precipitation'][] = round($precip, 2);
            $series['rain'][] = round($precip, 2);
            $series['snowfall'][] = 0;
            $series['weather_code'][] = self::weatherCode($clouds, $precip);
            $series['cloud_cover'][] = round($clouds, 1);
            $series['surface_pressure'][] = round(1014 - ($wave * 4), 1);
            $series['visibility'][] = 10000;
        }

        return [
            'latitude' => $lat,
            'longitude' => $lon,
            'timezone' => 'GMT',
            'timezone_abbreviation' => 'GMT',
            'elevation' => 0,
            'source' => 'Local fallback',
            'model' => $model,
            'fallback' => true,
            'stale' => true,
            'providerMessage' => 'Local raster point data is not available on this server yet.',
            'hourly' => $series,
        ];
    }

    private static function weatherCode(float $clouds, float $precip): int
    {
        if ($precip >= 7) return 65;
        if ($precip >= 2) return 63;
        if ($precip >= 0.2) return 61;
        if ($clouds >= 85) return 3;
        if ($clouds >= 50) return 2;
        if ($clouds >= 20) return 1;
        return 0;
    }
}
