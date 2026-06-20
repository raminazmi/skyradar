<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LocationService;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function __construct(protected LocationService $locationService)
    {
    }

    public function search(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|min:2|max:120',
            'count' => 'nullable|integer|min:1|max:20',
            'language' => 'nullable|string|min:2|max:5',
            'countryCode' => 'nullable|string|size:2',
        ]);

        $results = $this->locationService->search(
            $validated['name'],
            (int) ($validated['count'] ?? 10),
            $validated['language'] ?? 'ar',
            $validated['countryCode'] ?? null
        );

        return response()->json($results);
    }
}
