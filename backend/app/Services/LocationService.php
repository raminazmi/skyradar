<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class LocationService
{
    protected string $baseUrl = 'https://geocoding-api.open-meteo.com/v1';

    public function search(string $name, int $count = 10, string $language = 'en', ?string $countryCode = null): array
    {
        $cacheKey = 'open_meteo_locations_' . md5(json_encode([
            'name' => $name,
            'count' => $count,
            'language' => $language,
            'countryCode' => $countryCode,
        ]));

        return Cache::remember($cacheKey, now()->addHours(6), function () use ($name, $count, $language, $countryCode) {
            $params = array_filter([
                'name' => $name,
                'count' => $count,
                'language' => $language,
                'countryCode' => $countryCode,
            ], fn ($value) => $value !== null && $value !== '');

            $response = Http::acceptJson()
                ->timeout(15)
                ->get("{$this->baseUrl}/search", $params);

            if ($response->failed()) {
                return ['results' => []];
            }

            return $response->json() ?? ['results' => []];
        });
    }
}
