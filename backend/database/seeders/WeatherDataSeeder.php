<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\WeatherForecast;
use App\Models\TropicalCyclone;
use Carbon\Carbon;

class WeatherDataSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->seedSampleForecasts();
        $this->seedSampleCyclones();
    }

    private function seedSampleForecasts(): void
    {
        $locations = [
            ['lat' => 24.7136, 'lon' => 46.6753, 'name' => 'الرياض'],
            ['lat' => 21.3891, 'lon' => 39.8579, 'name' => 'جدة'],
            ['lat' => 25.276987, 'lon' => 55.296249, 'name' => 'دبي'],
            ['lat' => 30.0444, 'lon' => 31.2357, 'name' => 'القاهرة'],
            ['lat' => 33.8938, 'lon' => 35.5018, 'name' => 'بيروت'],
        ];

        foreach ($locations as $loc) {
            for ($hour = 0; $hour < 168; $hour += 3) {
                WeatherForecast::create([
                    'latitude' => $loc['lat'],
                    'longitude' => $loc['lon'],
                    'model' => 'GFS',
                    'forecast_time' => now()->addHours($hour),
                    'temperature_2m' => 20 + sin($hour / 24 * pi()) * 10 + rand(-5, 5),
                    'apparent_temperature' => 22 + sin($hour / 24 * pi()) * 8 + rand(-3, 3),
                    'relative_humidity_2m' => rand(20, 80),
                    'wind_speed_10m' => rand(2, 25),
                    'wind_direction_10m' => rand(0, 360),
                    'precipitation' => rand(0, 100) > 80 ? rand(1, 20) : 0,
                    'cloud_cover' => rand(0, 100),
                    'surface_pressure' => 1013 + rand(-20, 20),
                ]);
            }
        }
    }

    private function seedSampleCyclones(): void
    {
        TropicalCyclone::create([
            'cyclone_id' => 'AL012025',
            'name' => 'ألبرتو',
            'basin' => 'atlantic',
            'category' => 1,
            'max_wind_speed' => 130,
            'min_pressure' => 985,
            'latitude' => 25.5,
            'longitude' => -80.2,
            'movement_direction' => 315,
            'movement_speed' => 20,
            'status' => 'active',
            'forecast_track' => json_encode([
                ['time' => '+6h', 'lat' => 26.2, 'lon' => -81.0],
                ['time' => '+12h', 'lat' => 27.0, 'lon' => -81.8],
                ['time' => '+24h', 'lat' => 28.5, 'lon' => -83.0],
            ]),
            'source' => 'NHC',
        ]);
    }
}
