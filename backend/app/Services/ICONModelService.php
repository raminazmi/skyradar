<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class ICONModelService
{
    /**
     * ICON Model Information
     * 
     * The ICON (ICOsahedral Nonhydrostatic) model is a numerical weather prediction model
     * developed jointly by Deutscher Wetterdienst (DWD) and Max Planck Institute.
     * 
     * Resolution: 0.1125° (approximately 13km) for global, higher for regional
     * Update Frequency: Every 6 hours (00, 06, 12, 18 UTC)
     * Forecast Range: Up to 180 hours (7.5 days) for global, 48 hours for regional
     */
    
    protected $baseUrl = 'https://api.open-meteo.com/v4/forecast';
    protected $model = 'icon';

    /**
     * Get ICON data for a specific location
     */
    public function getLocationData($latitude, $longitude, $variables = null, $hours = 168)
    {
        $cacheKey = "icon_location_{$latitude}_{$longitude}_{$hours}";
        
        return Cache::remember($cacheKey, 21600, function() use ($latitude, $longitude, $variables, $hours) {
            $response = Http::get($this->baseUrl, [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'hourly' => $variables ?? $this->getDefaultVariables(),
                'timezone' => 'auto',
                'models' => $this->model,
                'forecast_days' => min(ceil($hours / 24), 7)
            ]);

            return $response->json();
        });
    }

    /**
     * Get regional ICON data for map visualization
     */
    public function getRegionalData($centerLat, $centerLon, $variables = null, $hours = 168)
    {
        $points = $this->generateGridPoints($centerLat, $centerLon, 0.3); // Higher resolution for ICON
        
        $data = [];
        foreach ($points as $point) {
            $data[] = $this->getLocationData($point['lat'], $point['lon'], $variables, $hours);
        }

        return [
            'grid' => $data,
            'center' => ['lat' => $centerLat, 'lon' => $centerLon],
            'resolution' => '0.3°',
            'model' => 'ICON',
            'updateTime' => now()->toIso8601String()
        ];
    }

    /**
     * Generate grid points around a center location
     */
    protected function generateGridPoints($lat, $lon, $spacing)
    {
        $points = [];
        $range = 5;
        
        for ($i = -$range; $i <= $range; $i++) {
            for ($j = -$range; $j <= $range; $j++) {
                $points[] = [
                    'lat' => $lat + ($i * $spacing),
                    'lon' => $lon + ($j * $spacing)
                ];
            }
        }
        
        return $points;
    }

    /**
     * Get wind field data for visualization
     */
    public function getWindField($bounds, $hours = 48)
    {
        $centerLat = ($bounds['north'] + $bounds['south']) / 2;
        $centerLon = ($bounds['east'] + $bounds['west']) / 2;

        $data = $this->getLocationData(
            $centerLat, 
            $centerLon, 
            ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'],
            $hours
        );

        return [
            'windSpeed' => $data['hourly']['wind_speed_10m'] ?? [],
            'windDirection' => $data['hourly']['wind_direction_10m'] ?? [],
            'windGusts' => $data['hourly']['wind_gusts_10m'] ?? [],
            'time' => $data['hourly']['time'] ?? []
        ];
    }

    /**
     * Get precipitation forecast
     */
    public function getPrecipitation($latitude, $longitude, $hours = 168)
    {
        $data = $this->getLocationData(
            $latitude,
            $longitude,
            ['precipitation', 'rain', 'snowfall', 'weather_code'],
            $hours
        );

        return [
            'precipitation' => $data['hourly']['precipitation'] ?? [],
            'rain' => $data['hourly']['rain'] ?? [],
            'snowfall' => $data['hourly']['snowfall'] ?? [],
            'weatherCode' => $data['hourly']['weather_code'] ?? [],
            'time' => $data['hourly']['time'] ?? []
        ];
    }

    /**
     * Get temperature forecast
     */
    public function getTemperature($latitude, $longitude, $hours = 168)
    {
        $data = $this->getLocationData(
            $latitude,
            $longitude,
            ['temperature_2m', 'apparent_temperature', 'dew_point_2m'],
            $hours
        );

        return [
            'temperature' => $data['hourly']['temperature_2m'] ?? [],
            'apparentTemperature' => $data['hourly']['apparent_temperature'] ?? [],
            'dewPoint' => $data['hourly']['dew_point_2m'] ?? [],
            'time' => $data['hourly']['time'] ?? []
        ];
    }

    /**
     * Get pressure data
     */
    public function getPressure($latitude, $longitude, $hours = 168)
    {
        $data = $this->getLocationData(
            $latitude,
            $longitude,
            ['surface_pressure', 'isobaric_anomaly_1000hPa'],
            $hours
        );

        return [
            'pressure' => $data['hourly']['surface_pressure'] ?? [],
            'time' => $data['hourly']['time'] ?? []
        ];
    }

    /**
     * Get humidity data
     */
    public function getHumidity($latitude, $longitude, $hours = 168)
    {
        $data = $this->getLocationData(
            $latitude,
            $longitude,
            ['relative_humidity_2m', 'dew_point_2m'],
            $hours
        );

        return [
            'humidity' => $data['hourly']['relative_humidity_2m'] ?? [],
            'dewPoint' => $data['hourly']['dew_point_2m'] ?? [],
            'time' => $data['hourly']['time'] ?? []
        ];
    }

    /**
     * Get cloud cover data
     */
    public function getClouds($latitude, $longitude, $hours = 168)
    {
        $data = $this->getLocationData(
            $latitude,
            $longitude,
            ['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high'],
            $hours
        );

        return [
            'totalCloudCover' => $data['hourly']['cloud_cover'] ?? [],
            'lowCloudCover' => $data['hourly']['cloud_cover_low'] ?? [],
            'midCloudCover' => $data['hourly']['cloud_cover_mid'] ?? [],
            'highCloudCover' => $data['hourly']['cloud_cover_high'] ?? [],
            'time' => $data['hourly']['time'] ?? []
        ];
    }

    /**
     * Get model metadata
     */
    public function getModelInfo()
    {
        return [
            'name' => 'ICON',
            'fullName' => 'ICOsahedral Nonhydrostatic Model',
            'provider' => 'DWD (Deutscher Wetterdienst)',
            'resolution' => '13 كم',
            'updateFrequency' => 'Every 6 hours',
            'forecastRange' => '7.5 days (180 hours)',
            'runTimes' => ['00:00', '06:00', '12:00', '18:00 UTC'],
            'description' => 'ICON is a next-generation numerical weather prediction model developed by DWD and Max Planck Institute. It uses an icosahedral grid for better global coverage.'
        ];
    }

    /**
     * Get default variables for ICON
     */
    protected function getDefaultVariables()
    {
        return [
            'temperature_2m',
            'relative_humidity_2m',
            'dew_point_2m',
            'apparent_temperature',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'precipitation',
            'rain',
            'snowfall',
            'weather_code',
            'cloud_cover',
            'surface_pressure',
            'visibility'
        ];
    }
}
