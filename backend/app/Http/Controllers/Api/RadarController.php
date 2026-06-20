<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RadarService;
use Illuminate\Http\Request;

class RadarController extends Controller
{
    protected $radarService;

    public function __construct(RadarService $radarService)
    {
        $this->radarService = $radarService;
    }

    /**
     * الحصول على بيانات الرادار لمنطقة
     */
    public function forRegion(Request $request)
    {
        $validated = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lon' => 'required|numeric|between:-180,180',
        ]);

        $radar = $this->radarService->getRadarForRegion(
            $validated['lat'],
            $validated['lon']
        );

        if (!$radar) {
            return response()->json([
                'message' => 'لا يوجد تغطية رادارية لهذه المنطقة',
            ], 404);
        }

        return response()->json([
            'radar' => $radar,
        ]);
    }

    /**
     * الحصول على جميع مصادر الرادار
     */
    public function sources()
    {
        return response()->json([
            'sources' => $this->radarService->getAllRadarSources(),
        ]);
    }

    /**
     * جلب بيانات الرادار
     */
    public function fetch(Request $request)
    {
        $validated = $request->validate([
            'source' => 'required|string|in:US_NEXRAD,EU_EUMETNET,AU_BOM,JP_JMA',
        ]);

        $data = $this->radarService->fetchRadarData($validated['source']);

        return response()->json($data);
    }
}
