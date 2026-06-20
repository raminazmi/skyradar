<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * نموذج صور الأقمار الصناعية
 */
class SatelliteImage extends Model
{
    use HasFactory;

    protected $table = 'satellite_images';

    protected $fillable = [
        'satellite_name',
        'region',
        'image_url',
        'image_type', // 'live', 'hd', 'infrared', 'water_vapor'
        'captured_at',
        'resolution',
        'band',
        'bbox_north',
        'bbox_south',
        'bbox_east',
        'bbox_west',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
        'resolution' => 'float',
        'bbox_north' => 'float',
        'bbox_south' => 'float',
        'bbox_east' => 'float',
        'bbox_west' => 'float',
    ];

    public function scopeBySatellite($query, $name)
    {
        return $query->where('satellite_name', $name);
    }

    public function scopeByRegion($query, $region)
    {
        return $query->where('region', $region);
    }

    public function scopeLatest($query)
    {
        return $query->orderBy('captured_at', 'desc');
    }

    public function scopeRecent($query, $minutes = 30)
    {
        return $query->where('captured_at', '>=', now()->subMinutes($minutes));
    }
}
