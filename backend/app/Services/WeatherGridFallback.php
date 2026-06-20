<?php

namespace App\Services;

class WeatherGridFallback
{
    public static function make(
        array $bounds,
        int $rows,
        int $cols,
        array $coordinates,
        string $type,
        string $model,
        int $timeIndex,
        int $sampleResolution
    ): array {
        $points = array_fill(0, $rows, array_fill(0, $cols, null));
        $centerLat = ($bounds['north'] + $bounds['south']) / 2;
        $centerLon = ($bounds['east'] + $bounds['west']) / 2;

        foreach ($coordinates as $meta) {
            $lat = (float) $meta['lat'];
            $lon = (float) $meta['lon'];
            $point = self::point($lat, $lon, $centerLat, $centerLon, $type, $timeIndex);
            $points[$meta['row']][$meta['col']] = $point;
        }

        return [
            'bounds' => $bounds,
            'rows' => $rows,
            'cols' => $cols,
            'points' => $points,
            'timestamp' => now()->toIso8601String(),
            'type' => $type,
            'samplingResolution' => $sampleResolution,
            'source' => 'fallback',
            'provider' => 'Local fallback',
            'model' => $model,
            'runTime' => now()->startOfHour()->toIso8601String(),
            'validTime' => now()->startOfHour()->addHours($timeIndex)->toIso8601String(),
            'unit' => self::unit($type),
            'fallback' => true,
            'providerMessage' => 'Weather provider returned no valid grid points for this layer.',
            'attribution' => 'Fallback preview generated locally when live provider data is unavailable.',
        ];
    }

    private static function point(
        float $lat,
        float $lon,
        float $centerLat,
        float $centerLon,
        string $type,
        int $timeIndex
    ): array {
        $wave = sin(deg2rad(($lon * 2.3) + ($timeIndex * 8))) + cos(deg2rad(($lat * 3.1) - ($timeIndex * 5)));
        $distance = sqrt((($lat - $centerLat) ** 2) + ((($lon - $centerLon) * cos(deg2rad($lat))) ** 2));

        if ($type === 'wind') {
            $speed = max(1, 18 + ($wave * 7) + min(14, $distance * 0.45));
            $direction = fmod(220 + ($lon * 1.7) - ($lat * 0.8) + ($timeIndex * 4), 360);
            $rad = deg2rad(270 - $direction);

            return [
                'lat' => $lat,
                'lon' => $lon,
                'value' => round($speed, 2),
                'u' => round(cos($rad) * $speed, 3),
                'v' => round(sin($rad) * $speed, 3),
                'speed' => round($speed, 2),
                'direction' => round($direction < 0 ? $direction + 360 : $direction, 1),
            ];
        }

        return [
            'lat' => $lat,
            'lon' => $lon,
            'value' => round(self::value($type, $lat, $wave, $distance), 2),
        ];
    }

    private static function value(string $type, float $lat, float $wave, float $distance): float
    {
        return match ($type) {
            'temperature' => 28 - (abs($lat) * 0.28) + ($wave * 3.5),
            'feels-like' => 31 - (abs($lat) * 0.22) + ($wave * 4.2),
            'wind-gusts' => max(0, 26 + ($wave * 9) + min(18, $distance * 0.7)),
            'precipitation' => max(0, ($wave + 1.2) * 1.8),
            'pressure' => 1014 - ($wave * 5) - min(18, $distance * 0.35),
            'humidity' => max(10, min(100, 58 + ($wave * 18) - (abs($lat) * 0.15))),
            'dewpoint' => 18 - (abs($lat) * 0.12) + ($wave * 2.5),
            'clouds' => max(0, min(100, 48 + ($wave * 30))),
            default => $wave,
        };
    }

    private static function unit(string $type): string
    {
        return match ($type) {
            'wind', 'wind-gusts' => 'km/h',
            'temperature', 'feels-like', 'dewpoint' => 'C',
            'precipitation' => 'mm/h',
            'pressure' => 'hPa',
            'humidity', 'clouds' => '%',
            default => '',
        };
    }
}
