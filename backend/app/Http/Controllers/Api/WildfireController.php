<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WildfireService;
use Illuminate\Http\Request;

class WildfireController extends Controller
{
    protected $wildfireService;

    public function __construct(WildfireService $wildfireService)
    {
        $this->wildfireService = $wildfireService;
    }

    /**
     * الحصول على الحرائق النشطة في منطقة
     */
    public function inRegion(Request $request)
    {
        $validated = $request->validate([
            'north' => 'required|numeric|between:-90,90',
            'south' => 'required|numeric|between:-90,90',
            'east' => 'required|numeric|between:-180,180',
            'west' => 'required|numeric|between:-180,180',
            'limit' => 'integer|min:1|max:1000',
        ]);

        $fires = $this->wildfireService->getActiveFires(
            $validated['north'],
            $validated['south'],
            $validated['east'],
            $validated['west'],
            $validated['limit'] ?? 500
        );

        return response()->json([
            'fires' => $fires,
            'count' => count($fires),
            'bounds' => [
                'north' => $validated['north'],
                'south' => $validated['south'],
                'east' => $validated['east'],
                'west' => $validated['west'],
            ],
            'last_updated' => now()->toIso8601String(),
        ]);
    }

    /**
     * الحصول على إحصائيات الحرائق
     */
    public function stats()
    {
        $stats = $this->wildfireService->getFireStats();

        return response()->json($stats);
    }
}
