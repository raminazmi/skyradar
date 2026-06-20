<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use App\Models\SatelliteImage;

class SatelliteService
{
    /**
     * مصادر الأقمار الصناعية
     */
    protected $satellites = [
        'GOES-East' => [
            'region' => 'Americas',
            'update_interval' => 10,
            'resolution' => '1km',
            'url_template' => 'https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/{timestamp}.jpg',
            'bounds' => ['north' => 60, 'south' => -60, 'east' => -20, 'west' => -130],
        ],
        'GOES-West' => [
            'region' => 'Pacific',
            'update_interval' => 10,
            'resolution' => '1km',
            'url_template' => 'https://cdn.star.nesdis.noaa.gov/GOES17/ABI/FD/GEOCOLOR/{timestamp}.jpg',
            'bounds' => ['north' => 60, 'south' => -60, 'east' => -100, 'west' => -180],
        ],
        'Himawari-8' => [
            'region' => 'Asia-Pacific',
            'update_interval' => 10,
            'resolution' => '0.5km',
            'url_template' => 'https://himawari8-dl.nict.go.jp/himawari8/img/D531106/{timestamp}.png',
            'bounds' => ['north' => 60, 'south' => -60, 'east' => 180, 'west' => 80],
        ],
        'Meteosat-0' => [
            'region' => 'Europe-Africa',
            'update_interval' => 15,
            'resolution' => '1km',
            'url_template' => 'https://eumetview.eumetsat.int/static-images/latestImages/EUMETSAT_MSGIODC_RGBNatColour_WesternIndianOcean.jpg',
            'bounds' => ['north' => 60, 'south' => -40, 'east' => 60, 'west' => -20],
        ],
    ];

    /**
     * الحصول على معلومات الأقمار الصناعية
     */
    public function getSatelliteInfo(): array
    {
        return $this->satellites;
    }

    /**
     * تحديد القمر الصناعي الأنسب للموقع
     */
    public function getBestSatelliteForLocation(float $lat, float $lon): ?string
    {
        foreach ($this->satellites as $name => $sat) {
            $b = $sat['bounds'];
            if ($lat >= $b['south'] && $lat <= $b['north'] && 
                $lon >= $b['west'] && $lon <= $b['east']) {
                return $name;
            }
        }
        return 'GOES-East'; // افتراضي
    }

    /**
     * الحصول على رابط صورة القمر الصناعي
     */
    public function getSatelliteImageUrl(string $satellite, string $type = 'geocolor'): string
    {
        $cacheKey = "satellite_image_{$satellite}_{$type}";
        
        return Cache::remember($cacheKey, 600, function() use ($satellite, $type) {
            // في بيئة الإنتاج، يتم جلب الصور الفعلية من NOAA/NASA
            // هنا نعيد رابطاً نموذجياً
            $timestamp = now()->format('Ymd_Hi');
            return str_replace('{timestamp}', $timestamp, $this->satellites[$satellite]['url_template'] ?? '');
        });
    }

    /**
     * الحصول على جميع الصور الحديثة
     */
    public function getRecentImages(int $minutes = 60): array
    {
        return SatelliteImage::recent($minutes)
            ->latest()
            ->get()
            ->groupBy('satellite_name')
            ->toArray();
    }

    /**
     * تحديث بيانات الأقمار الصناعية (يتم استدعاؤها عبر Cron)
     */
    public function updateSatelliteData(): void
    {
        foreach ($this->satellites as $name => $sat) {
            try {
                // جلب الصورة الأحدث
                $imageUrl = $this->getSatelliteImageUrl($name);
                
                SatelliteImage::updateOrCreate(
                    [
                        'satellite_name' => $name,
                        'captured_at' => now()->startOfHour(),
                    ],
                    [
                        'region' => $sat['region'],
                        'image_url' => $imageUrl,
                        'image_type' => 'geocolor',
                        'resolution' => $sat['resolution'],
                        'bbox_north' => $sat['bounds']['north'],
                        'bbox_south' => $sat['bounds']['south'],
                        'bbox_east' => $sat['bounds']['east'],
                        'bbox_west' => $sat['bounds']['west'],
                    ]
                );
            } catch (\Exception $e) {
                \Log::error("فشل تحديث بيانات القمر الصناعي {$name}: " . $e->getMessage());
            }
        }
    }
}
