<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * نموذج كشف الحرائق
 */
class WildfireDetection extends Model
{
    use HasFactory;

    protected $table = 'wildfire_detections';

    protected $fillable = [
        'detection_id',
        'latitude',
        'longitude',
        'brightness',
        'scan',
        'track',
        'acq_date',
        'acq_time',
        'satellite',
        'confidence',
        'version',
        'bright_t31',
        'frp', // Fire Radiative Power
        'daynight',
        'source',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'brightness' => 'float',
        'scan' => 'float',
        'track' => 'float',
        'confidence' => 'float',
        'bright_t31' => 'float',
        'frp' => 'float',
        'acq_date' => 'date',
    ];

    public function scopeHighConfidence($query)
    {
        return $query->where('confidence', '>=', 80);
    }

    public function scopeRecent($query, $hours = 24)
    {
        return $query->where('created_at', '>=', now()->subHours($hours));
    }

    public function scopeInBounds($query, $north, $south, $east, $west)
    {
        return $query
            ->whereBetween('latitude', [$south, $north])
            ->whereBetween('longitude', [$west, $east]);
    }
}
