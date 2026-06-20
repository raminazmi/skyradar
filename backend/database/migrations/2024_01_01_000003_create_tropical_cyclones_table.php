<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tropical_cyclones', function (Blueprint $table) {
            $table->id();
            $table->string('cyclone_id', 20)->unique()->index();
            $table->string('name', 100);
            $table->string('basin', 20)->index(); // atlantic, pacific, indian
            $table->integer('category')->default(0);
            $table->decimal('max_wind_speed', 6, 2)->nullable();
            $table->decimal('min_pressure', 8, 2)->nullable();
            $table->decimal('latitude', 10, 6);
            $table->decimal('longitude', 10, 6);
            $table->decimal('movement_direction', 6, 2)->nullable();
            $table->decimal('movement_speed', 6, 2)->nullable();
            $table->string('status', 20)->default('active')->index(); // active, dissipated, post-tropical
            $table->json('forecast_track')->nullable();
            $table->json('wind_radii')->nullable();
            $table->string('source', 50)->nullable();
            $table->timestamps();
            
            $table->index(['status', 'basin']);
            $table->index(['latitude', 'longitude']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tropical_cyclones');
    }
};
