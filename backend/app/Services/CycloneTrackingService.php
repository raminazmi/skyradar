<?php

namespace App\Services;

use App\Models\TropicalCyclone;
use Illuminate\Support\Facades\Schema;

class CycloneTrackingService
{
    public function getActiveCyclones(): array
    {
        if (!Schema::hasTable('tropical_cyclones')) {
            return [];
        }

        return TropicalCyclone::where('status', 'active')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn ($cyclone) => $this->mapCyclone($cyclone))
            ->all();
    }

    public function getHistoricalCyclones(int $year = null): array
    {
        $year = $year ?? now()->year;

        return TropicalCyclone::whereYear('created_at', $year)
            ->orderBy('category', 'desc')
            ->get()
            ->map(fn ($cyclone) => $this->mapCyclone($cyclone))
            ->all();
    }

    public function getSeasonStats(int $year = null): array
    {
        $year = $year ?? now()->year;
        $cyclones = TropicalCyclone::whereYear('created_at', $year)->get();

        return [
            'total_cyclones' => $cyclones->count(),
            'category_5' => $cyclones->where('category', 5)->count(),
            'category_4' => $cyclones->where('category', 4)->count(),
            'category_3' => $cyclones->where('category', 3)->count(),
            'active_now' => $cyclones->where('status', 'active')->count(),
            'year' => $year,
        ];
    }

    public function updateCycloneData(): void
    {
        // Cyclone ingestion should write real NHC/JTWC/IBTrACS records into tropical_cyclones.
        // This method intentionally does not create placeholder storms.
    }

    private function mapCyclone(TropicalCyclone $cyclone): array
    {
        return [
            'id' => $cyclone->cyclone_id,
            'name' => $cyclone->name,
            'basin' => $cyclone->basin,
            'category' => $cyclone->category,
            'max_wind_speed' => $cyclone->max_wind_speed,
            'min_pressure' => $cyclone->min_pressure,
            'latitude' => $cyclone->latitude,
            'longitude' => $cyclone->longitude,
            'movement' => [
                'direction' => $cyclone->movement_direction,
                'speed' => $cyclone->movement_speed,
            ],
            'forecast_track' => $cyclone->forecast_track ?? [],
            'wind_radii' => $cyclone->wind_radii ?? [],
            'status' => $cyclone->status,
            'updated_at' => optional($cyclone->updated_at)->toIso8601String(),
        ];
    }
}
