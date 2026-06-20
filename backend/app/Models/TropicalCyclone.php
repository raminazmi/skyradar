<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * نموذج تتبع الأعاصير الاستوائية
 */
class TropicalCyclone extends Model
{
    use HasFactory;

    protected $table = 'tropical_cyclones';

    protected $fillable = [
        'cyclone_id',
        'name',
        'basin', // 'atlantic', 'pacific', 'indian'
        'category',
        'max_wind_speed',
        'min_pressure',
        'latitude',
        'longitude',
        'movement_direction',
        'movement_speed',
        'status', // 'active', 'dissipated', 'post-tropical'
        'forecast_track',
        'wind_radii',
        'source',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'max_wind_speed' => 'float',
        'min_pressure' => 'float',
        'movement_direction' => 'float',
        'movement_speed' => 'float',
        'category' => 'integer',
        'forecast_track' => 'json',
        'wind_radii' => 'json',
    ];

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeByBasin($query, $basin)
    {
        return $query->where('basin', $basin);
    }

    public function scopeByCategory($query, $minCategory)
    {
        return $query->where('category', '>=', $minCategory);
    }
}
