<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'nasa_firms' => [
        'map_key' => env('NASA_FIRMS_MAP_KEY'),
    ],

    'openmeteo' => [
        // اضبطه على مثيلك المُستضاف ذاتياً (مثل http://localhost:8080) لإلغاء حدود الحصة.
        'base_url' => env('OPEN_METEO_BASE_URL', 'https://api.open-meteo.com'),
        // مفتاح اشتراك Open-Meteo التجاري (Standard/Professional). عند ضبطه تُستخدَم
        // البوّابة التجارية customer-api تلقائياً ويُمرَّر apikey في كل طلب → حصة أعلى.
        'api_key' => env('OPEN_METEO_API_KEY'),
        'customer_base_url' => env('OPEN_METEO_CUSTOMER_BASE_URL', 'https://customer-api.open-meteo.com'),
    ],

];
