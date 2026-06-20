<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('weather_forecasts', function (Blueprint $table) {
            $table->id();
            $table->decimal('latitude', 10, 6);
            $table->decimal('longitude', 10, 6);
            $table->string('model', 10)->index(); // GFS or ICON
            $table->dateTime('forecast_time')->index();
            
            // Temperature
            $table->decimal('temperature_2m', 6, 2)->nullable();
            $table->decimal('apparent_temperature', 6, 2)->nullable();
            $table->decimal('dew_point_2m', 6, 2)->nullable();
            
            // Humidity
            $table->decimal('relative_humidity_2m', 5, 2)->nullable();
            
            // Wind
            $table->decimal('wind_speed_10m', 6, 2)->nullable();
            $table->decimal('wind_direction_10m', 6, 2)->nullable();
            $table->decimal('wind_gusts_10m', 6, 2)->nullable();
            
            // Precipitation
            $table->decimal('precipitation', 6, 2)->nullable();
            $table->decimal('rain', 6, 2)->nullable();
            $table->decimal('snowfall', 6, 2)->nullable();
            
            // Other
            $table->integer('weather_code')->nullable();
            $table->decimal('cloud_cover', 5, 2)->nullable();
            $table->decimal('surface_pressure', 8, 2)->nullable();
            $table->decimal('visibility', 8, 2)->nullable();
            $table->decimal('cape', 8, 2)->nullable();
            $table->decimal('uv_index', 4, 2)->nullable();
            
            $table->timestamps();
            
            // Indexes for performance
            $table->index(['latitude', 'longitude']);
            $table->index(['model', 'forecast_time']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('weather_forecasts');
    }
};
