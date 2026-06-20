<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class RadarService
{
    /**
     * مصادر رادار الطقس حول العالم
     */
    protected $radarSources = [
        'US_NEXRAD' => [
            'name' => 'NEXRAD (USA)',
            'url' => 'https://radar.weather.gov/ridge/standard/CONUS_loop.gif',
            'bounds' => ['north' => 50, 'south' => 24, 'east' => -66, 'west' => -125],
            'update_interval' => 10,
        ],
        'EU_EUMETNET' => [
            'name' => 'EUMETNET (Europe)',
            'url' => 'https://www.eumetnet.eu/wp-content/themes/eumetnet/images/radar-composite.png',
            'bounds' => ['north' => 72, 'south' => 35, 'east' => 30, 'west' => -10],
            'update_interval' => 15,
        ],
        'AU_BOM' => [
            'name' => 'BOM (Australia)',
            'url' => 'https://www.bom.gov.au/radar/IDR.loop.south-east-queensland.gif',
            'bounds' => ['north' => -10, 'south' => -44, 'east' => 154, 'west' => 112],
            'update_interval' => 10,
        ],
        'JP_JMA' => [
            'name' => 'JMA (Japan)',
            'url' => 'https://www.jma.go.jp/bosai/nowc/const/ radar/latest.png',
            'bounds' => ['north' => 46, 'south' => 24, 'east' => 146, 'west' => 122],
            'update_interval' => 5,
        ],
    ];

    /**
     * الحصول على بيانات الرادار لمنطقة معينة
     */
    public function getRadarForRegion(float $lat, float $lon): ?array
    {
        foreach ($this->radarSources as $key => $source) {
            $b = $source['bounds'];
            if ($lat >= $b['south'] && $lat <= $b['north'] && 
                $lon >= $b['west'] && $lon <= $b['east']) {
                return [
                    'source' => $key,
                    'name' => $source['name'],
                    'url' => $source['url'],
                    'bounds' => $source['bounds'],
                    'update_interval' => $source['update_interval'],
                ];
            }
        }
        return null;
    }

    /**
     * الحصول على جميع مصادر الرادار
     */
    public function getAllRadarSources(): array
    {
        return $this->radarSources;
    }

    /**
     * جلب بيانات الرادار الفعلية
     */
    public function fetchRadarData(string $source): array
    {
        $cacheKey = "radar_data_{$source}";
        
        return Cache::remember($cacheKey, 300, function() use ($source) {
            try {
                $response = Http::timeout(30)->get($this->radarSources[$source]['url'] ?? '');
                
                if ($response->successful()) {
                    return [
                        'status' => 'success',
                        'data' => $response->body(),
                        'timestamp' => now()->toIso8601String(),
                    ];
                }
            } catch (\Exception $e) {
                \Log::error("فشل جلب بيانات الرادار: " . $e->getMessage());
            }
            
            return [
                'status' => 'error',
                'message' => 'تعذر جلب بيانات الرادار',
            ];
        });
    }

    /**
     * تحويل شدة الرادار إلى معدل هطول
     */
    public function radarIntensityToPrecipitation(float $dbz): float
    {
        // معادلة Z-R: Z = 200R^1.6
        // R = (Z/200)^(1/1.6)
        if ($dbz <= 0) return 0;
        $z = pow(10, $dbz / 10);
        return pow($z / 200, 1 / 1.6);
    }
}
