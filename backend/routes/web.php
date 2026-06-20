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

// Weather Map Dashboard (Inertia View)
Route::get('/', [WeatherController::class, 'index'])->name('weather.index');

// API Endpoints for model data fetching
Route::prefix('api')->group(function () {
    Route::get('/forecast', [WeatherController::class, 'forecast'])->name('weather.forecast');
    Route::get('/models/gfs', [WeatherController::class, 'gfsData'])->name('weather.gfs');
    Route::get('/models/icon', [WeatherController::class, 'iconData'])->name('weather.icon');
    Route::get('/satellite', [WeatherController::class, 'satelliteInfo'])->name('weather.satellite');
    Route::get('/cyclones', [WeatherController::class, 'tropicalCyclones'])->name('weather.cyclones');
    Route::get('/wildfires', [WeatherController::class, 'wildfires'])->name('weather.wildfires');
});
