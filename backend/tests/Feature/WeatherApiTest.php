<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WeatherApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_forecast_returns_provider_error_when_upstream_is_rate_limited(): void
    {
        Http::fake([
            'https://api.open-meteo.com/v1/gfs*' => Http::response([
                'error' => true,
                'reason' => 'Daily API request limit exceeded. Please try again tomorrow.',
            ], 429),
        ]);

        $response = $this->getJson('/api/v1/forecast?latitude=24.7136&longitude=46.6753&model=GFS&hours=24');

        $response
            ->assertStatus(429)
            ->assertJsonPath('error', true)
            ->assertJsonPath('message', 'Daily API request limit exceeded. Please try again tomorrow.')
            ->assertJsonPath('source', 'weather-provider');
    }

    public function test_forecast_serves_stale_snapshot_when_upstream_temporarily_fails(): void
    {
        Http::fake([
            'https://api.open-meteo.com/v1/gfs*' => Http::response([
                'latitude' => 24.7136,
                'longitude' => 46.6753,
                'hourly' => [
                    'time' => ['2026-05-05T00:00'],
                    'temperature_2m' => [31],
                    'apparent_temperature' => [33],
                    'dew_point_2m' => [14],
                    'relative_humidity_2m' => [31],
                    'wind_speed_10m' => [18],
                    'wind_direction_10m' => [250],
                    'wind_gusts_10m' => [25],
                    'precipitation' => [0],
                    'rain' => [0],
                    'snowfall' => [0],
                    'weather_code' => [0],
                    'cloud_cover' => [2],
                    'surface_pressure' => [1008],
                    'visibility' => [24000],
                ],
                'current' => [
                    'time' => '2026-05-05T00:00',
                    'temperature_2m' => 31,
                    'wind_speed_10m' => 18,
                    'weather_code' => 0,
                ],
            ], 200),
        ]);

        $firstResponse = $this->getJson('/api/v1/forecast?latitude=24.7136&longitude=46.6753&model=GFS&hours=24');
        $firstResponse->assertOk()->assertJsonPath('hourly.temperature_2m.0', 31);

        $normalizedLatitude = round((float) 24.7136, 3);
        $normalizedLongitude = round((float) 46.6753, 3);
        $cacheKey = "weather_forecast_{$normalizedLatitude}_{$normalizedLongitude}_GFS_24";

        Cache::forget($cacheKey);

        Http::fake([
            'https://api.open-meteo.com/v1/gfs*' => Http::response([
                'error' => true,
                'reason' => 'Daily API request limit exceeded. Please try again tomorrow.',
            ], 429),
        ]);

        $secondResponse = $this->getJson('/api/v1/forecast?latitude=24.7136&longitude=46.6753&model=GFS&hours=24');

        $secondResponse
            ->assertOk()
            ->assertJsonPath('hourly.temperature_2m.0', 31);
    }

    public function test_grid_returns_provider_error_when_upstream_is_rate_limited(): void
    {
        Http::fake([
            'https://api.open-meteo.com/v1/gfs*' => Http::response([
                'error' => true,
                'reason' => 'Daily API request limit exceeded. Please try again tomorrow.',
            ], 429),
        ]);

        $response = $this->getJson('/api/v1/grid?north=35&south=20&east=55&west=40&model=GFS&type=temperature&timeIndex=0&resolution=8');

        $response
            ->assertStatus(503)
            ->assertJsonPath('error', true)
            ->assertJsonPath('source', 'weather-provider');
    }
}
