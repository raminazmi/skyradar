<?php

use App\Http\Controllers\WeatherController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

// API Endpoints for model data fetching
Route::prefix('api')->group(function () {
    Route::get('/forecast', [WeatherController::class, 'forecast'])->name('weather.forecast');
    Route::get('/models/gfs', [WeatherController::class, 'gfsData'])->name('weather.gfs');
    Route::get('/models/icon', [WeatherController::class, 'iconData'])->name('weather.icon');
    Route::get('/satellite', [WeatherController::class, 'satelliteInfo'])->name('weather.satellite');
    Route::get('/cyclones', [WeatherController::class, 'tropicalCyclones'])->name('weather.cyclones');
    Route::get('/wildfires', [WeatherController::class, 'wildfires'])->name('weather.wildfires');
});

// SPA fallback: تخدم بناء React (index.html) لأي مسار ليس API.
// يجب نسخ ناتج بناء الفرونت (dist/*) إلى backend/public قبل النشر.
Route::get('/{any}', function () {
    $index = public_path('index.html');
    abort_unless(file_exists($index), 404);
    return response()->file($index);
})->where('any', '^(?!api).*$');
