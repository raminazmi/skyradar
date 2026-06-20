<?php

namespace App\Services;

use App\Models\WildfireDetection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WildfireService
{
    protected string $firmsBaseUrl = 'https://firms.modaps.eosdis.nasa.gov/api/';

    public function getActiveFires(float $north, float $south, float $east, float $west, int $limit = 500): array
    {
        $cacheKey = implode('_', ['wildfires', $north, $south, $east, $west, $limit]);

        return Cache::remember($cacheKey, 3600, function () use ($north, $south, $east, $west, $limit) {
            try {
                return $this->fetchFirmsFires($north, $south, $east, $west, $limit);
            } catch (\Throwable $exception) {
                Log::error('Failed to fetch wildfire data: ' . $exception->getMessage());
                return $this->queryStoredFires($north, $south, $east, $west, $limit);
            }
        });
    }

    private function fetchFirmsFires(float $north, float $south, float $east, float $west, int $limit): array
    {
        $mapKey = config('services.nasa_firms.map_key', env('NASA_FIRMS_MAP_KEY'));
        if (!$mapKey) {
            return $this->queryStoredFires($north, $south, $east, $west, $limit);
        }

        $area = implode(',', [$west, $south, $east, $north]);
        $url = "{$this->firmsBaseUrl}area/csv/{$mapKey}/VIIRS_SNPP_NRT/{$area}/1";
        $response = Http::timeout(15)->accept('text/csv')->get($url);
        if (!$response->successful()) {
            $response->throw();
        }

        $fires = $this->parseFirmsCsv($response->body());
        usort($fires, fn ($a, $b) => (float) $b['frp'] <=> (float) $a['frp']);

        return array_slice($fires, 0, $limit);
    }

    private function queryStoredFires(float $north, float $south, float $east, float $west, int $limit): array
    {
        return WildfireDetection::recent(24)
            ->whereBetween('latitude', [$south, $north])
            ->whereBetween('longitude', [$west, $east])
            ->orderByDesc('frp')
            ->limit($limit)
            ->get()
            ->map(fn ($fire) => [
                'latitude' => $fire->latitude,
                'longitude' => $fire->longitude,
                'brightness' => $fire->brightness,
                'frp' => $fire->frp,
                'confidence' => $fire->confidence,
                'acq_date' => optional($fire->acq_date)->format('Y-m-d'),
                'acq_time' => $fire->acq_time,
                'satellite' => $fire->satellite,
                'source' => $fire->source,
            ])
            ->all();
    }

    private function parseFirmsCsv(string $csv): array
    {
        $lines = array_values(array_filter(array_map('trim', explode("\n", $csv))));
        if (count($lines) < 2) {
            return [];
        }

        $headers = str_getcsv(array_shift($lines));

        return array_values(array_filter(array_map(function ($line) use ($headers) {
            $row = array_combine($headers, str_getcsv($line));
            if (!is_array($row)) {
                return null;
            }

            return [
                'latitude' => (float) ($row['latitude'] ?? 0),
                'longitude' => (float) ($row['longitude'] ?? 0),
                'brightness' => (float) ($row['bright_ti4'] ?? $row['brightness'] ?? 0),
                'frp' => (float) ($row['frp'] ?? 0),
                'confidence' => $row['confidence'] ?? null,
                'acq_date' => $row['acq_date'] ?? null,
                'acq_time' => $row['acq_time'] ?? null,
                'satellite' => $row['satellite'] ?? null,
                'source' => 'NASA FIRMS',
            ];
        }, $lines)));
    }

    public function getFireStats(): array
    {
        return [
            'total_detections' => WildfireDetection::count(),
            'active_24h' => WildfireDetection::recent(24)->count(),
            'high_confidence' => WildfireDetection::highConfidence()->count(),
            'last_updated' => now()->toIso8601String(),
        ];
    }

    public function updateFireData(): void
    {
        $fires = $this->getActiveFires(60, -40, 180, -180, 1000);

        foreach ($fires as $fire) {
            WildfireDetection::updateOrCreate(
                [
                    'latitude' => $fire['latitude'],
                    'longitude' => $fire['longitude'],
                    'acq_date' => $fire['acq_date'],
                ],
                [
                    'brightness' => $fire['brightness'],
                    'frp' => $fire['frp'],
                    'confidence' => $fire['confidence'],
                    'acq_time' => $fire['acq_time'],
                    'satellite' => $fire['satellite'],
                    'source' => $fire['source'] ?? 'NASA FIRMS',
                ]
            );
        }
    }
}
