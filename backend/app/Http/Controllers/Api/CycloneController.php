<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CycloneTrackingService;
use Illuminate\Http\Request;

class CycloneController extends Controller
{
    protected $cycloneService;

    public function __construct(CycloneTrackingService $cycloneService)
    {
        $this->cycloneService = $cycloneService;
    }

    /**
     * الحصول على الأعاصير النشطة
     */
    public function active()
    {
        $cyclones = $this->cycloneService->getActiveCyclones();

        return response()->json([
            'cyclones' => $cyclones,
            'count' => count($cyclones),
            'last_updated' => now()->toIso8601String(),
        ]);
    }

    /**
     * الحصول على تاريخ الأعاصير
     */
    public function history(Request $request)
    {
        $year = $request->input('year', now()->year);
        $cyclones = $this->cycloneService->getHistoricalCyclones($year);

        return response()->json([
            'cyclones' => $cyclones,
            'year' => $year,
        ]);
    }

    /**
     * الحصول على إحصائيات الموسم
     */
    public function stats(Request $request)
    {
        $year = $request->input('year', now()->year);
        $stats = $this->cycloneService->getSeasonStats($year);

        return response()->json($stats);
    }

    /**
     * الحصول على تفاصيل إعصار محدد
     */
    public function show(string $id)
    {
        $cyclones = $this->cycloneService->getActiveCyclones();
        $cyclone = collect($cyclones)->firstWhere('id', $id);

        if (!$cyclone) {
            return response()->json([
                'message' => 'الإعصار غير موجود',
            ], 404);
        }

        return response()->json([
            'cyclone' => $cyclone,
        ]);
    }
}
