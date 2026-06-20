<?php

return [
    /*
    |--------------------------------------------------------------------------
    | إعدادات خدمة الطقس
    |--------------------------------------------------------------------------
    |
    | هنا يمكنك تكوين مصادر بيانات الطقس والإعدادات العامة
    |
    */

    'default_model' => env('WEATHER_DEFAULT_MODEL', 'GFS'),

    'models' => [
        'GFS' => [
            'name' => 'Global Forecast System',
            'provider' => 'NOAA/NCEP',
            'resolution_km' => 25,
            'forecast_days' => 16,
            'update_hours' => 6,
            'run_times' => ['00', '06', '12', '18'],
        ],
        'ICON' => [
            'name' => 'ICOsahedral Nonhydrostatic',
            'provider' => 'DWD',
            'resolution_km' => 13,
            'forecast_days' => 7,
            'update_hours' => 6,
            'run_times' => ['00', '06', '12', '18'],
        ],
    ],

    'data_sources' => [
        'open_meteo' => [
            'base_url' => 'https://api.open-meteo.com',
            'timeout' => 30,
        ],
        'noaa' => [
            'base_url' => 'https://api.weather.gov',
            'timeout' => 30,
        ],
    ],

    'cache' => [
        'enabled' => true,
        'ttl_minutes' => [
            'forecast' => 60,
            'current' => 15,
            'satellite' => 10,
            'radar' => 5,
        ],
    ],

    'satellites' => [
        'goes_east' => [
            'name' => 'GOES-East',
            'region' => 'Americas',
            'update_interval_minutes' => 10,
        ],
        'goes_west' => [
            'name' => 'GOES-West',
            'region' => 'Pacific',
            'update_interval_minutes' => 10,
        ],
        'himawari_8' => [
            'name' => 'Himawari-8',
            'region' => 'Asia-Pacific',
            'update_interval_minutes' => 10,
        ],
        'meteosat' => [
            'name' => 'Meteosat',
            'region' => 'Europe-Africa',
            'update_interval_minutes' => 15,
        ],
    ],
];
