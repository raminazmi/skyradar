<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SatelliteService;
use Illuminate\Http\Request;

class SatelliteController extends Controller
{
    protected $satelliteService;

    public function __construct(SatelliteService $satelliteService)
    {
        $this->satelliteService = $satelliteService;
    }

    /**
     * الحصول على معلومات الأقمار الصناعية
     */
    public function info()
    {
        return response()->json([
            'satellites' => $this->satelliteService->getSatelliteInfo(),
            'last_updated' => now()->toIso8601String(),
        ]);
    }

    /**
     * الحصول على أفضل قمر صناعي للموقع
     */
    public function bestForLocation(Request $request)
    {
        $validated = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lon' => 'required|numeric|between:-180,180',
        ]);

        $satellite = $this->satelliteService->getBestSatelliteForLocation(
            $validated['lat'],
            $validated['lon']
        );

        return response()->json([
            'satellite' => $satellite,
            'location' => ['lat' => $validated['lat'], 'lon' => $validated['lon']],
        ]);
    }

    /**
     * الحصول على رابط صورة القمر الصناعي
     */
    public function image(Request $request)
    {
        $validated = $request->validate([
            'satellite' => 'required|string|in:GOES-East,GOES-West,Himawari-8,Meteosat-0',
            'type' => 'string|in:geocolor,infrared,water_vapor',
        ]);

        $url = $this->satelliteService->getSatelliteImageUrl(
            $validated['satellite'],
            $validated['type'] ?? 'geocolor'
        );

        return response()->json([
            'url' => $url,
            'satellite' => $validated['satellite'],
            'type' => $validated['type'] ?? 'geocolor',
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * الحصول على الصور الحديثة
     */
    public function recent(Request $request)
    {
        $minutes = $request->input('minutes', 60);
        $images = $this->satelliteService->getRecentImages($minutes);

        return response()->json([
            'images' => $images,
            'count' => count($images),
        ]);
    }
}
