<?php

namespace App\Services;

use App\Exceptions\WeatherProviderException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WeatherService
{
    protected array $modelEndpoints;

    protected int $gridChunkSize = 100;

    public function __construct()
    {
        // عنوان أساس Open-Meteo قابل للضبط: اضبط OPEN_METEO_BASE_URL على
        // عنوان المثيل المُستضاف ذاتياً (مثل http://localhost:8080) لإلغاء حدود الحصة،
        // وإلا يستخدم الـ API العام المجاني.
        $base = rtrim((string) config('services.openmeteo.base_url', 'https://api.open-meteo.com'), '/');
        $this->modelEndpoints = [
            'GFS'  => "{$base}/v1/gfs",
            'ICON' => "{$base}/v1/dwd-icon",
        ];
    }

    public function getForecast($latitude, $longitude, $model = 'GFS', $hours = 168)
    {
        $forecastHours = min(max((int) $hours, 1), $this->getMaxForecastHours($model));
        $normalizedLatitude = round((float) $latitude, 3);
        $normalizedLongitude = round($this->normalizeLongitude((float) $longitude), 3);
        $cacheKey = "weather_forecast_v2_{$normalizedLatitude}_{$normalizedLongitude}_{$model}_{$forecastHours}";

        return $this->rememberWithStaleFallback(
            $cacheKey,
            now()->addMinutes(45),
            now()->addHours(24), // إبقاء نسخة احتياطية يوماً كاملاً لتفادي فشل الواجهة عند نفاد حصة المزوّد
            function () use ($normalizedLatitude, $normalizedLongitude, $model, $forecastHours) {
                return $this->requestForecast(
                    [$normalizedLatitude],
                    [$normalizedLongitude],
                    $model,
                    $this->getDefaultVariables(),
                    $forecastHours,
                    true,
                    'auto',
                    true
                );
            }
        );
    }

    public function getGridData($bounds, $model = 'GFS', $type = 'temperature', $timeIndex = 0, $resolution = 12)
    {
        $normalizedBounds = $this->normalizeBounds($bounds);
        $sampleResolution = $this->determineGridSampleResolution($normalizedBounds, (int) $resolution, $model);
        $forecastHours = min(max(((int) $timeIndex) + 3, 3), $this->getMaxForecastHours($model));
        $cacheKey = sprintf(
            'weather_grid_v2_%s_%s_%s_%s_%s_%s_%s_%s',
            $type,
            $model,
            $normalizedBounds['north'],
            $normalizedBounds['south'],
            $normalizedBounds['east'],
            $normalizedBounds['west'],
            $timeIndex,
            $sampleResolution
        );

        return $this->rememberWithStaleFallback(
            $cacheKey,
            now()->addMinutes(60),
            now()->addHours(24), // نسخة احتياطية يوماً كاملاً: البيانات تبقى معروضة حتى لو نفدت حصة Open-Meteo
            function () use ($normalizedBounds, $model, $type, $timeIndex, $sampleResolution, $forecastHours) {
                [$rows, $cols, $coordinates] = $this->buildGridCoordinates($normalizedBounds, $sampleResolution);
                $variables = $this->getVariablesForGridType($type);
                $points = array_fill(0, $rows, array_fill(0, $cols, null));
                $mappedPoints = 0;
                $validTime = null;

                // نجمّع نقاط الشبكة في دفعات، ونرسل كل دفعة كطلب Open-Meteo واحد متعدد المواقع
                // (يدعم latitude=a,b,c). هذا يحوّل عشرات/مئات الطلبات إلى عدد قليل جداً،
                // فيتفادى حظر معدّل الطلبات (429) ويسرّع الاستجابة بشكل كبير.
                $chunks = array_chunk($coordinates, max(1, $this->gridChunkSize));

                $responses = Http::pool(function (\Illuminate\Http\Client\Pool $pool) use ($chunks, $model, $variables, $forecastHours) {
                    $requests = [];
                    foreach ($chunks as $chunk) {
                        $query = [
                            'latitude' => implode(',', array_map(fn ($c) => $this->formatCoordinate($c['lat']), $chunk)),
                            'longitude' => implode(',', array_map(fn ($c) => $this->formatCoordinate($c['lon']), $chunk)),
                            'hourly' => implode(',', $variables),
                            'temperature_unit' => 'celsius',
                            'wind_speed_unit' => 'kmh',
                            'precipitation_unit' => 'mm',
                            'timeformat' => 'unixtime',
                            'timezone' => 'GMT',
                            'forecast_hours' => $forecastHours,
                        ];

                        $requests[] = $pool->acceptJson()
                            ->withHeaders(['User-Agent' => 'zoom-earth-clone-technical-study/1.0', 'Accept-Encoding' => 'gzip, deflate'])
                            ->withOptions(['decode_content' => true])
                            ->connectTimeout(6)
                            ->timeout(25)
                            ->get($this->getForecastEndpoint($model), $query);
                    }
                    return $requests;
                });

                foreach ($responses as $chunkIndex => $response) {
                    if ($response instanceof \Exception || !$response->ok()) {
                        continue;
                    }

                    $payload = $response->json();
                    // طلب متعدد المواقع → مصفوفة قائمة بنفس ترتيب الإدخال؛ موقع واحد → كائن مفرد.
                    $forecastList = (is_array($payload) && array_is_list($payload)) ? $payload : [$payload];
                    $chunk = $chunks[$chunkIndex] ?? [];

                    foreach ($chunk as $offset => $meta) {
                        $forecast = $forecastList[$offset] ?? null;
                        if (!is_array($forecast) || empty($forecast['hourly'])) {
                            continue;
                        }

                        $points[$meta['row']][$meta['col']] = $this->mapForecastToGridPoint(
                            $meta['lat'],
                            $meta['lon'],
                            $forecast,
                            $type,
                            (int) $timeIndex
                        );
                        $mappedPoints++;

                        if ($validTime === null) {
                            $validTime = $this->extractGridValidTime($forecast, (int) $timeIndex);
                        }
                    }
                }

                if ($mappedPoints === 0) {
                    return WeatherGridFallback::make(
                        $normalizedBounds,
                        $rows,
                        $cols,
                        $coordinates,
                        $type,
                        $model,
                        (int) $timeIndex,
                        $sampleResolution
                    );
                }

                $points = $this->fillMissingGridPointsFromProvider($points, $coordinates);

                return [
                    'bounds' => $normalizedBounds,
                    'rows' => $rows,
                    'cols' => $cols,
                    'points' => $points,
                    'timestamp' => now()->toIso8601String(),
                    'type' => $type,
                    'samplingResolution' => $sampleResolution,
                    'source' => 'open-meteo',
                    'provider' => 'Open-Meteo',
                    'model' => $model,
                    'runTime' => now()->startOfHour()->toIso8601String(),
                    'validTime' => $validTime ?? now()->startOfHour()->addHours((int) $timeIndex)->toIso8601String(),
                    'unit' => $this->getUnitForGridType($type),
                    'attribution' => 'Open-Meteo, NOAA/NCEP GFS, DWD ICON',
                ];
            }
        );
    }

    protected function requestForecast(
        array $latitudes,
        array $longitudes,
        string $model,
        array $hourlyVariables,
        int $forecastHours,
        bool $single,
        string $timezone = 'GMT',
        bool $includeCurrent = true
    ): array {
        $query = [
            'latitude' => implode(',', array_map([$this, 'formatCoordinate'], $latitudes)),
            'longitude' => implode(',', array_map([$this, 'formatCoordinate'], $longitudes)),
            'hourly' => implode(',', $hourlyVariables),
            'temperature_unit' => 'celsius',
            'wind_speed_unit' => 'kmh',
            'precipitation_unit' => 'mm',
            'timeformat' => 'unixtime',
            'timezone' => $timezone,
            'forecast_hours' => $forecastHours,
        ];

        if ($includeCurrent) {
            $query['current'] = 'temperature_2m,wind_speed_10m,weather_code';
        }

        $response = $this->sendProviderRequest($this->getForecastEndpoint($model), $query);

        if ($response->status() === 429) {
            throw new WeatherProviderException('تم تجاوز حد مزود الطقس مؤقتًا.', 429);
        } elseif ($response->serverError()) {
            throw new WeatherProviderException('مزود الطقس الخارجي لا يستجيب بشكل سليم حاليًا.', 503);
        } elseif (!$response->successful()) {
            $response->throw();
        }
        $data = $response->json();

        if ($single) {
            return $data;
        }

        if (is_array($data) && array_is_list($data)) {
            return $data;
        }

        return [$data];
    }

    protected function rememberWithStaleFallback(
        string $cacheKey,
        $freshTtl,
        $staleTtl,
        callable $resolver
    ): array {
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $snapshotKey = "{$cacheKey}_snapshot";

        try {
            $data = $resolver();
            Cache::put($cacheKey, $data, $freshTtl);
            Cache::put($snapshotKey, $data, $staleTtl);

            return $data;
        } catch (WeatherProviderException $exception) {
            $snapshot = Cache::get($snapshotKey);
            if (is_array($snapshot)) {
                $snapshot['stale'] = true;
                $snapshot['providerMessage'] = $exception->getMessage();

                Cache::put($cacheKey, $snapshot, now()->addMinutes(5));
                Log::warning('Serving stale weather data after upstream failure.', [
                    'cache_key' => $cacheKey,
                    'message' => $exception->getMessage(),
                ]);

                return $snapshot;
            }

            throw $exception;
        }
    }

    protected function sendProviderRequest(string $endpoint, array $query): Response
    {
        $lastException = null;

        for ($attempt = 0; $attempt < 2; $attempt++) {
            try {
                $response = Http::acceptJson()
                    ->withHeaders([
                        'User-Agent' => 'zoom-earth-clone-technical-study/1.0',
                    ])
                    ->withOptions(['decode_content' => true])
                    ->connectTimeout(8)
                    ->timeout(25)
                    ->get($endpoint, $query);

                if ($response->successful()) {
                    return $response;
                }

                if ($response->status() === 429) {
                    throw new WeatherProviderException(
                        $this->extractProviderMessage($response, 'تم تجاوز حد مزود الطقس مؤقتًا.'),
                        429
                    );
                }

                if ($response->serverError() && $attempt === 0) {
                    usleep(250000);
                    continue;
                }

                $response->throw();
            } catch (ConnectionException $exception) {
                $lastException = $exception;

                if ($attempt === 0) {
                    usleep(250000);
                    continue;
                }

                throw new WeatherProviderException(
                    'تعذر الاتصال بمزود بيانات الطقس حاليًا. حاول مرة أخرى بعد قليل.',
                    503,
                    $exception
                );
            } catch (RequestException $exception) {
                $lastException = $exception;
                throw $this->toWeatherProviderException($exception);
            }
        }

        throw new WeatherProviderException(
            'تعذر تحميل بيانات الطقس حاليًا.',
            503,
            $lastException
        );
    }

    protected function toWeatherProviderException(RequestException $exception): WeatherProviderException
    {
        $response = $exception->response;

        if ($response && $response->status() === 429) {
            return new WeatherProviderException(
                $this->extractProviderMessage($response, 'تم تجاوز حد مزود الطقس مؤقتًا.'),
                429,
                $exception
            );
        }

        if ($response && $response->serverError()) {
            return new WeatherProviderException(
                'مزود الطقس الخارجي لا يستجيب بشكل سليم حاليًا.',
                503,
                $exception
            );
        }

        return new WeatherProviderException(
            'تعذر جلب بيانات الطقس المطلوبة.',
            $response?->status() ?? 503,
            $exception
        );
    }

    protected function extractProviderMessage(Response $response, string $fallback): string
    {
        $payload = $response->json();
        if (is_array($payload)) {
            $reason = $payload['reason'] ?? $payload['message'] ?? null;
            if (is_string($reason) && $reason !== '') {
                return $reason;
            }
        }

        return $fallback;
    }

    protected function normalizeBounds(array $bounds): array
    {
        $north = max(-90, min(90, max((float) $bounds['north'], (float) $bounds['south'])));
        $south = max(-90, min(90, min((float) $bounds['north'], (float) $bounds['south'])));
        $rawEast = (float) $bounds['east'];
        $rawWest = (float) $bounds['west'];
        $span = abs($rawEast - $rawWest);
        $east = $this->normalizeLongitude($rawEast);
        $west = $this->normalizeLongitude($rawWest);

        if ($span >= 330 || $east <= $west) {
            $west = -180.0;
            $east = 180.0;
        }

        return [
            'north' => round($north, 1),
            'south' => round($south, 1),
            'east' => round($east, 1),
            'west' => round($west, 1),
        ];
    }

    protected function normalizeLongitude(float $longitude): float
    {
        $normalized = fmod($longitude + 180.0, 360.0);
        if ($normalized < 0) {
            $normalized += 360.0;
        }

        return $normalized - 180.0;
    }

    protected function determineGridSampleResolution(array $bounds, int $requestedResolution, string $model): int
    {
        $latSpan = max(0.5, abs($bounds['north'] - $bounds['south']));
        $lonSpan = max(0.5, abs($bounds['east'] - $bounds['west']));
        $maxSpan = max($latSpan, $lonSpan);
        // عدد النقاط = res² بغضّ النظر عن المساحة، والمساحة تحدّد كثافة التفاصيل فقط.
        // لذا: مساحة صغيرة (مكبّر) → دقة عالية لتفاصيل دقيقة؛ مساحة كبيرة (مصغّر) → دقة أقل لتوفير الطلبات.
        // ملاحظة: تكلفة حصة Open-Meteo ∝ عدد النقاط (res²). نوازن بين التفاصيل والحصة المجانية.
        $cap = $model === 'ICON' ? 48 : 44;

        // كثافة عالية (مطابقة Zoom Earth): تظهر البقع الساحلية وتباين البر/البحر
        // المخبوز أصلاً في بيانات النموذج. التكلفة ∝ res² — مقبولة وفق اختيار المستخدم.
        $baseResolution = match (true) {
            $maxSpan >= 90 => 24,   // عالمي: ~576 نقطة
            $maxSpan >= 45 => 32,
            $maxSpan >= 15 => 38,   // إقليمي
            default => 44,          // مكبّر
        };

        return max(6, min($requestedResolution, min($baseResolution, $cap)));
    }

    protected function buildGridCoordinates(array $bounds, int $resolution): array
    {
        $rows = $resolution;
        $cols = $resolution;
        $latStep = $rows > 1 ? ($bounds['north'] - $bounds['south']) / ($rows - 1) : 0;
        $lonStep = $cols > 1 ? ($bounds['east'] - $bounds['west']) / ($cols - 1) : 0;
        $coordinates = [];

        for ($row = 0; $row < $rows; $row++) {
            for ($col = 0; $col < $cols; $col++) {
                $coordinates[] = [
                    'row' => $row,
                    'col' => $col,
                    'lat' => $bounds['south'] + ($row * $latStep),
                    'lon' => $bounds['west'] + ($col * $lonStep),
                ];
            }
        }

        return [$rows, $cols, $coordinates];
    }

    protected function getVariablesForGridType(string $type): array
    {
        return match ($type) {
            'wind' => ['wind_speed_10m', 'wind_direction_10m'],
            'wind-gusts' => ['wind_gusts_10m'],
            'temperature' => ['temperature_2m'],
            'feels-like' => ['apparent_temperature'],
            'precipitation' => ['precipitation'],
            'pressure' => ['surface_pressure'],
            'humidity' => ['relative_humidity_2m'],
            'dewpoint' => ['dew_point_2m'],
            'clouds' => ['cloud_cover'],
            default => ['temperature_2m'],
        };
    }

    protected function mapForecastToGridPoint(float $lat, float $lon, array $forecast, string $type, int $timeIndex): array
    {
        $hourly = $forecast['hourly'] ?? [];
        $timeCount = count($hourly['time'] ?? []);
        $index = max(0, min($timeIndex, max(0, $timeCount - 1)));

        if ($type === 'wind') {
            $speed = (float) ($hourly['wind_speed_10m'][$index] ?? 0);
            $direction = (float) ($hourly['wind_direction_10m'][$index] ?? 0);
            $rad = deg2rad(270 - $direction);

            return [
                'lat' => $lat,
                'lon' => $lon,
                'value' => $speed,
                'u' => cos($rad) * $speed,
                'v' => sin($rad) * $speed,
                'speed' => $speed,
                'direction' => $direction,
            ];
        }

        $value = match ($type) {
            'temperature' => (float) ($hourly['temperature_2m'][$index] ?? 0),
            'feels-like' => (float) ($hourly['apparent_temperature'][$index] ?? 0),
            'wind-gusts' => (float) ($hourly['wind_gusts_10m'][$index] ?? 0),
            'precipitation' => (float) ($hourly['precipitation'][$index] ?? 0),
            'pressure' => (float) ($hourly['surface_pressure'][$index] ?? 1013),
            'humidity' => (float) ($hourly['relative_humidity_2m'][$index] ?? 0),
            'dewpoint' => (float) ($hourly['dew_point_2m'][$index] ?? 0),
            'clouds' => (float) ($hourly['cloud_cover'][$index] ?? 0),
            default => 0,
        };

        return [
            'lat' => $lat,
            'lon' => $lon,
            'value' => $value,
        ];
    }

    protected function extractGridValidTime(array $forecast, int $timeIndex): ?string
    {
        $hourly = $forecast['hourly'] ?? [];
        $times = $hourly['time'] ?? [];
        if (!is_array($times) || count($times) === 0) {
            return null;
        }

        $index = max(0, min($timeIndex, count($times) - 1));
        $time = $times[$index] ?? null;

        if (is_numeric($time)) {
            return Carbon::createFromTimestamp((int) $time)->toIso8601String();
        }

        if (is_string($time) && $time !== '') {
            return Carbon::parse($time)->toIso8601String();
        }

        return null;
    }

    protected function fillMissingGridPointsFromProvider(array $points, array $coordinates): array
    {
        $validPoints = [];
        foreach ($points as $row) {
            foreach ($row as $point) {
                if (is_array($point) && isset($point['lat'], $point['lon'], $point['value'])) {
                    $validPoints[] = $point;
                }
            }
        }

        if (empty($validPoints)) {
            return $points;
        }

        foreach ($coordinates as $meta) {
            if ($points[$meta['row']][$meta['col']] !== null) {
                continue;
            }

            $points[$meta['row']][$meta['col']] = $this->nearestProviderPoint(
                $validPoints,
                (float) $meta['lat'],
                (float) $meta['lon']
            );
        }

        return $points;
    }

    protected function nearestProviderPoint(array $validPoints, float $lat, float $lon): array
    {
        $nearest = $validPoints[0];
        $nearestDistance = PHP_FLOAT_MAX;

        foreach ($validPoints as $point) {
            $distance = (($point['lat'] - $lat) ** 2) + (($point['lon'] - $lon) ** 2);
            if ($distance < $nearestDistance) {
                $nearest = $point;
                $nearestDistance = $distance;
            }
        }

        $copy = $nearest;
        $copy['lat'] = $lat;
        $copy['lon'] = $lon;

        return $copy;
    }

    protected function getUnitForGridType(string $type): string
    {
        return match ($type) {
            'wind', 'wind-gusts' => 'km/h',
            'temperature', 'feels-like', 'dewpoint' => 'C',
            'precipitation' => 'mm/h',
            'pressure' => 'hPa',
            'humidity', 'clouds' => '%',
            default => '',
        };
    }

    protected function getForecastEndpoint(string $model): string
    {
        return $this->modelEndpoints[$model] ?? $this->modelEndpoints['GFS'];
    }

    protected function getMaxForecastHours(string $model): int
    {
        return $model === 'ICON' ? 24 * 7 : 24 * 16;
    }

    protected function formatCoordinate(float $value): string
    {
        return rtrim(rtrim(number_format($value, 4, '.', ''), '0'), '.');
    }

    protected function getDefaultVariables(): array
    {
        return [
            'temperature_2m',
            'relative_humidity_2m',
            'dew_point_2m',
            'apparent_temperature',
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
        ];
    }

    public function getTropicalCyclones()
    {
        return [
            [
                'id' => 'AL012024',
                'name' => 'Hurricane Name',
                'category' => 3,
                'maxWindSpeed' => 185,
                'minPressure' => 960,
                'latitude' => 25.5,
                'longitude' => -80.2,
                'movement' => [
                    'direction' => 315,
                    'speed' => 15,
                ],
                'forecast' => [],
                'status' => 'active',
            ],
        ];
    }

    public function getWildfires()
    {
        $response = Http::get('https://firms.modaps.eosdis.nasa.gov/api/collection/VIIRS_VNP14IMGT/download', [
            'lat' => 45,
            'lon' => 0,
            'day' => 1,
        ]);

        return $response->json() ?? [];
    }

    public function getCurrentWeather($latitude, $longitude, $model = 'GFS')
    {
        return $this->requestForecast(
            [(float) $latitude],
            [(float) $longitude],
            $model,
            ['temperature_2m', 'wind_speed_10m', 'weather_code'],
            1,
            true,
            'auto',
            true
        );
    }

    public function decodeWeatherCode($code)
    {
        $codes = [
            0 => ['condition' => 'Clear sky', 'icon' => 'âک€ï¸ڈ'],
            1 => ['condition' => 'Mainly clear', 'icon' => 'ًںŒ¤ï¸ڈ'],
            2 => ['condition' => 'Partly cloudy', 'icon' => 'â›…'],
            3 => ['condition' => 'Overcast', 'icon' => 'âکپï¸ڈ'],
            45 => ['condition' => 'Fog', 'icon' => 'ًںŒ«ï¸ڈ'],
            48 => ['condition' => 'Depositing rime fog', 'icon' => 'ًںŒ«ï¸ڈ'],
            51 => ['condition' => 'Light drizzle', 'icon' => 'ًںŒ§ï¸ڈ'],
            53 => ['condition' => 'Moderate drizzle', 'icon' => 'ًںŒ§ï¸ڈ'],
            55 => ['condition' => 'Dense drizzle', 'icon' => 'ًںŒ§ï¸ڈ'],
            61 => ['condition' => 'Slight rain', 'icon' => 'ًںŒ§ï¸ڈ'],
            63 => ['condition' => 'Moderate rain', 'icon' => 'ًںŒ§ï¸ڈ'],
            65 => ['condition' => 'Heavy rain', 'icon' => 'ًںŒ§'],
            71 => ['condition' => 'Slight snow', 'icon' => 'ًںŒ¨ï¸ڈ'],
            73 => ['condition' => 'Moderate snow', 'icon' => 'ًںŒ¨ï¸ڈ'],
            75 => ['condition' => 'Heavy snow', 'icon' => 'â‌„ï¸ڈ'],
            80 => ['condition' => 'Slight rain showers', 'icon' => 'ًںŒ¦ï¸ڈ'],
            81 => ['condition' => 'Moderate rain showers', 'icon' => 'ًںŒ¦ï¸ڈ'],
            82 => ['condition' => 'Violent rain showers', 'icon' => 'â›ˆï¸ڈ'],
            95 => ['condition' => 'Thunderstorm', 'icon' => 'âڑ،'],
            96 => ['condition' => 'Thunderstorm with hail', 'icon' => 'â›ˆï¸ڈ'],
            99 => ['condition' => 'Thunderstorm with heavy hail', 'icon' => 'â›ˆï¸ڈ'],
        ];

        return $codes[$code] ?? ['condition' => 'Unknown', 'icon' => 'â‌“'];
    }
}
