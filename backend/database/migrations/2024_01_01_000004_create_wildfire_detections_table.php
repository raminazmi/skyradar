<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wildfire_detections', function (Blueprint $table) {
            $table->id();
            $table->string('detection_id', 50)->nullable()->index();
            $table->decimal('latitude', 10, 6);
            $table->decimal('longitude', 10, 6);
            $table->decimal('brightness', 8, 2)->nullable();
            $table->decimal('scan', 6, 2)->nullable();
            $table->decimal('track', 6, 2)->nullable();
            $table->date('acq_date');
            $table->string('acq_time', 10)->nullable();
            $table->string('satellite', 20)->nullable();
            $table->decimal('confidence', 5, 2)->nullable();
            $table->string('version', 20)->nullable();
            $table->decimal('bright_t31', 8, 2)->nullable();
            $table->decimal('frp', 8, 2)->nullable(); // Fire Radiative Power
            $table->string('daynight', 1)->nullable(); // D or N
            $table->string('source', 50)->nullable();
            $table->timestamps();
            
            $table->index(['latitude', 'longitude']);
            $table->index(['acq_date', 'confidence']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wildfire_detections');
    }
};
