<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * نموذج توقعات الطقس
 * يخزن بيانات التوقعات المحلية للوصول السريع
 */
class WeatherForecast extends Model
{
    use HasFactory;

    protected $table = 'weather_forecasts';

    protected $fillable = [
        'latitude',
        'longitude',
        'model',
        'forecast_time',
        'temperature_2m',
        'apparent_temperature',
        'dew_point_2m',
        'relative_humidity_2m',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'precipitation',
        'rain',
        'snowfall',
        'weather_code',
        'cloud_cover',
        'surface_pressure',
        'visibility',
        'cape',
        'uv_index',
    ];

    protected $casts = [
        'forecast_time' => 'datetime',
        'temperature_2m' => 'float',
        'apparent_temperature' => 'float',
        'dew_point_2m' => 'float',
        'relative_humidity_2m' => 'float',
        'wind_speed_10m' => 'float',
        'wind_direction_10m' => 'float',
        'wind_gusts_10m' => 'float',
        'precipitation' => 'float',
        'rain' => 'float',
        'snowfall' => 'float',
        'weather_code' => 'integer',
        'cloud_cover' => 'float',
        'surface_pressure' => 'float',
        'visibility' => 'float',
    ];

    /**
     * نطاق البحث حسب الموقع
     */
    public function scopeNearLocation($query, $lat, $lon, $radiusKm = 25)
    {
        // تقريب: 1 درجة ≈ 111 كم
        $latDelta = $radiusKm / 111;
        $lonDelta = $radiusKm / (111 * cos(deg2rad($lat)));

        return $query
            ->whereBetween('latitude', [$lat - $latDelta, $lat + $latDelta])
            ->whereBetween('longitude', [$lon - $lonDelta, $lon + $lonDelta]);
    }

    /**
     * نطاق البحث حسب النموذج
     */
    public function scopeByModel($query, $model)
    {
        return $query->where('model', $model);
    }

    /**
     * نطاق البحث للتوقعات المستقبلية
     */
    public function scopeFuture($query)
    {
        return $query->where('forecast_time', '>=', now());
    }

    /**
     * الحصول على أحدث توقع
     */
    public function scopeLatest($query)
    {
        return $query->orderBy('forecast_time', 'asc');
    }
}
