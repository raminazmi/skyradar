<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('satellite_images', function (Blueprint $table) {
            $table->id();
            $table->string('satellite_name', 50)->index();
            $table->string('region', 50);
            $table->text('image_url');
            $table->string('image_type', 20)->default('geocolor'); // geocolor, infrared, water_vapor
            $table->dateTime('captured_at')->index();
            $table->string('resolution', 20)->nullable();
            $table->string('band', 20)->nullable();
            
            // Bounding box
            $table->decimal('bbox_north', 10, 6)->nullable();
            $table->decimal('bbox_south', 10, 6)->nullable();
            $table->decimal('bbox_east', 10, 6)->nullable();
            $table->decimal('bbox_west', 10, 6)->nullable();
            
            $table->timestamps();
            
            $table->index(['satellite_name', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('satellite_images');
    }
};
