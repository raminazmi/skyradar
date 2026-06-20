<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class GFSModelService
{
    /**
     * GFS Model Information
     * 
     * The Global Forecast System (GFS) is a global numerical weather prediction model
     * run by the National Centers for Environmental Prediction (NCEP).
     * 
     * Resolution: 0.25° (approximately 25km)
     * Update Frequency: Every 6 hours (00, 06, 12, 18 UTC)
     * Forecast Range: Up to 16 days (384 hours)
     */
    
    protected $baseUrl = 'https://api.open-meteo.com/v4/forecast';
    protected $model = 'gfs';

    /**
     * Get GFS data for a specific location
     */
    public function getLocationData($latitude, $longitude, $variables = null, $hours = 168)
    {
        $cacheKey = "gfs_location_{$latitude}_{$longitude}_{$hours}";
        
        return Cache::remember($cacheKey, 21600, function() use ($latitude, $longitude, $variables, $hours) {
            $response = Http::get($this->baseUrl, [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'hourly' => $variables ?? $this->getDefaultVariables(),
                'timezone' => 'auto',
                'models' => $this->model,
                'forecast_days' => min(ceil($hours / 24), 16)
            ]);

            return $response->json();
        });
    }

    /**
     * Get regional GFS data for map visualization
     */
    public function getRegionalData($centerLat, $centerLon, $variables = null, $hours = 168)
    {
        // For regional data, we'd typically fetch multiple points
        // and interpolate for smooth visualization
        $points = $this->generateGridPoints($centerLat, $centerLon, 0.5); // 0.5 degree spacing
        
        $data = [];
        foreach ($points as $point) {
            $data[] = $this->getLocationData($point['lat'], $point['lon'], $variables, $hours);
        }

        return [
            'grid' => $data,
            'center' => ['lat' => $centerLat, 'lon' => $centerLon],
            'resolution' => '0.5°',
            'model' => 'GFS',
            'updateTime' => now()->toIso8601String()
        ];
    }

    /**
     * Generate grid points around a center location
     */
    protected function generateGridPoints($lat, $lon, $spacing)
    {
        $points = [];
        $range = 5; // 5 points in each direction
        
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
            'name' => 'GFS',
            'fullName' => 'Global Forecast System',
            'provider' => 'NOAA/NCEP',
            'resolution' => '22 كم',
            'updateFrequency' => 'Every 6 hours',
            'forecastRange' => '16 days (384 hours)',
            'runTimes' => ['00:00', '06:00', '12:00', '18:00 UTC'],
            'description' => 'The Global Forecast System is a numerical weather prediction model developed by NOAA/NCEP. It provides global coverage with high-resolution forecasts.'
        ];
    }

    /**
     * Get default variables for GFS
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
