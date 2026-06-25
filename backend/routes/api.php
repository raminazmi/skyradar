<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\SatelliteController;
use App\Http\Controllers\Api\RadarController;
use App\Http\Controllers\Api\CycloneController;
use App\Http\Controllers\Api\WildfireController;
use App\Http\Controllers\Api\PointController;
use App\Http\Controllers\WeatherController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| توجيهات API للتطبيق
|
*/

Route::prefix('v1')->group(function () {
    
    // توقعات الطقس
    Route::get('/forecast', [WeatherController::class, 'forecast'])->name('api.forecast');
    // توقّعات نقطة من مكعّبات الـ rasters المحلّية — بلا Open-Meteo (مجاني، سريع، بلا 429).
    Route::get('/point', [PointController::class, 'forecast'])->name('api.point');
    Route::get('/grid', [WeatherController::class, 'grid'])->name('api.grid');
    Route::get('/models', [WeatherController::class, 'availableModels'])->name('api.models');
    Route::get('/models/gfs', [WeatherController::class, 'gfsData'])->name('api.gfs');
    Route::get('/models/icon', [WeatherController::class, 'iconData'])->name('api.icon');

    Route::prefix('locations')->group(function () {
        Route::get('/search', [LocationController::class, 'search'])->name('api.locations.search');
    });
    
    // الأقمار الصناعية
    Route::prefix('satellite')->group(function () {
        Route::get('/info', [SatelliteController::class, 'info'])->name('api.satellite.info');
        Route::get('/best', [SatelliteController::class, 'bestForLocation'])->name('api.satellite.best');
        Route::get('/image', [SatelliteController::class, 'image'])->name('api.satellite.image');
        Route::get('/recent', [SatelliteController::class, 'recent'])->name('api.satellite.recent');
    });
    
    // الرادار
    Route::prefix('radar')->group(function () {
        Route::get('/region', [RadarController::class, 'forRegion'])->name('api.radar.region');
        Route::get('/sources', [RadarController::class, 'sources'])->name('api.radar.sources');
        Route::get('/fetch', [RadarController::class, 'fetch'])->name('api.radar.fetch');
    });
    
    // الأعاصير
    Route::prefix('cyclones')->group(function () {
        Route::get('/active', [CycloneController::class, 'active'])->name('api.cyclones.active');
        Route::get('/history', [CycloneController::class, 'history'])->name('api.cyclones.history');
        Route::get('/stats', [CycloneController::class, 'stats'])->name('api.cyclones.stats');
        Route::get('/{id}', [CycloneController::class, 'show'])->name('api.cyclones.show');
    });
    
    // الحرائق
    Route::prefix('wildfires')->group(function () {
        Route::get('/region', [WildfireController::class, 'inRegion'])->name('api.wildfires.region');
        Route::get('/stats', [WildfireController::class, 'stats'])->name('api.wildfires.stats');
    });
    
});
