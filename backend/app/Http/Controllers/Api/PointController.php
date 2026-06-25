<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/**
 * PointController
 * توقّعات نقطة من مكعّبات الـ rasters المحلّية (public/rasters/cubes/*.cube) — *بلا Open-Meteo*.
 * يقرأ قيمة النقطة عبر كل الساعات بإزاحة بايت مباشرة (لا فكّ صور)، فيُرجع نفس بنية WeatherData
 * التي تتوقّعها الواجهة. المصدر NOAA GFS / ECMWF IFS: مجاني تماماً وبلا حدّ طلبات.
 */
class PointController extends Controller
{
    /** مجالات التطبيع — مطابقة VALUE_RANGES في الواجهة و VAR_CONFIG في مولّد النُسج. */
    private const RANGES = [
        'temperature' => [-50, 55],
        'dewpoint'    => [-35, 35],
        'humidity'    => [0, 100],
        'pressure'    => [955, 1050],
        'clouds'      => [0, 100],
        'wind-gusts'  => [0, 160],
        'precipitation' => [0, 50],
    ];
    private const WIND_UV_MAX = 60.0;

    public function forecast(Request $request)
    {
        $validated = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-540,540',
            'model' => 'nullable|in:GFS,ECMWF,ICON',
            'hours' => 'nullable|integer|min:1|max:384',
        ]);

        $lat = (float) $validated['latitude'];
        $lon = (float) $validated['longitude'];
        $model = $validated['model'] ?? 'GFS';
        // كل نموذج له مجلّد rasters خاص: GFS في rasters/، والبقية في rasters/<model>/.
        $modelDir = $model === 'ECMWF' ? 'rasters/ecmwf'
            : ($model === 'ICON' ? 'rasters/icon' : 'rasters');
        $subdir = $modelDir . '/cubes';
        $cubeDir = public_path($subdir);

        $meta = @json_decode(@file_get_contents(public_path($modelDir . '/meta.json')), true);
        $runEpoch = (int) ($meta['run_epoch'] ?? time());

        // نفتح كل مكعّب مرّة، ونأخذ عيّنة النقطة لكل ساعة.
        $scalars = ['temperature', 'dewpoint', 'humidity', 'pressure', 'clouds', 'wind-gusts', 'precipitation'];
        $series = [];
        $hours = 0;

        foreach ($scalars as $var) {
            $sampled = $this->sampleScalarCube("{$cubeDir}/{$var}.cube", $lat, $lon);
            if ($sampled !== null) {
                [$values, $n, $cubeRunEpoch] = $sampled;
                $series[$var] = $values;
                $hours = max($hours, $n);
                if ($cubeRunEpoch > 0) {
                    $runEpoch = $cubeRunEpoch;
                }
            }
        }

        $wind = $this->sampleWindCube("{$cubeDir}/wind.cube", $lat, $lon);
        if ($wind !== null) {
            [$windSpeed, $windDir, $wn, $windRunEpoch] = $wind;
            $hours = max($hours, $wn);
            if ($windRunEpoch > 0) {
                $runEpoch = $windRunEpoch;
            }
        } else {
            $windSpeed = $windDir = [];
        }

        if ($hours === 0) {
            return response()->json([
                'error' => true,
                'message' => 'لا تتوفّر بيانات النقطة (لم تُبنَ المكعّبات بعد).',
            ], 503);
        }

        // اشتقاق: الإحساس (feels-like) وكود الحالة — لا نسيج لهما.
        $time = [];
        $temperature = [];
        $apparent = [];
        $code = [];
        for ($i = 0; $i < $hours; $i++) {
            $time[$i] = $runEpoch + $i * 3600;
            $t = $series['temperature'][$i] ?? null;
            $rh = $series['humidity'][$i] ?? null;
            $ws = $windSpeed[$i] ?? null;
            $temperature[$i] = $t;
            $apparent[$i] = $this->apparentTemperature($t, $rh, $ws);
            $code[$i] = $this->weatherCode($series['clouds'][$i] ?? 0, $series['precipitation'][$i] ?? 0);
        }

        return response()->json([
            'latitude' => $lat,
            'longitude' => $lon,
            'timezone' => 'GMT',
            'timezone_abbreviation' => 'GMT',
            'source' => $model === 'ECMWF' ? 'ECMWF IFS (raster)'
                : ($model === 'ICON' ? 'DWD ICON (raster)' : 'NOAA GFS (raster)'),
            'hourly' => [
                'time' => $time,
                'temperature_2m' => $temperature,
                'apparent_temperature' => $apparent,
                'dew_point_2m' => array_slice($series['dewpoint'] ?? [], 0, $hours),
                'relative_humidity_2m' => array_slice($series['humidity'] ?? [], 0, $hours),
                'wind_speed_10m' => array_slice($windSpeed, 0, $hours),
                'wind_direction_10m' => array_slice($windDir, 0, $hours),
                'wind_gusts_10m' => array_slice($series['wind-gusts'] ?? [], 0, $hours),
                'precipitation' => array_slice($series['precipitation'] ?? [], 0, $hours),
                'cloud_cover' => array_slice($series['clouds'] ?? [], 0, $hours),
                'surface_pressure' => array_slice($series['pressure'] ?? [], 0, $hours),
                'weather_code' => $code,
            ],
        ])->header('Cache-Control', 'public, max-age=600');
    }

    /** يقرأ ترويسة المكعّب: [channels, hours, H, W, runEpoch, headerSize] أو null. */
    private function readHeader($fh): ?array
    {
        $magic = fread($fh, 4);
        if ($magic !== 'RCUB') {
            return null;
        }
        $h = unpack('Cversion/Cchannels/vhours/vheight/vwidth/Vrun', fread($fh, 12));
        return [$h['channels'], $h['hours'], $h['height'], $h['width'], $h['run'], 16];
    }

    private function sampleScalarCube(string $path, float $lat, float $lon): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        $fh = fopen($path, 'rb');
        $header = $this->readHeader($fh);
        if ($header === null) {
            fclose($fh);
            return null;
        }
        [$channels, $hours, $H, $W, $run, $base] = $header;
        $values = [];
        for ($t = 0; $t < $hours; $t++) {
            $g = $this->bilinear($fh, $base, $t, $H, $W, $channels, 0, $lat, $lon);
            $values[$t] = $this->denorm($path, $g);
        }
        fclose($fh);
        return [$values, $hours, $run];
    }

    private function sampleWindCube(string $path, float $lat, float $lon): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        $fh = fopen($path, 'rb');
        $header = $this->readHeader($fh);
        if ($header === null) {
            fclose($fh);
            return null;
        }
        [$channels, $hours, $H, $W, $run, $base] = $header;
        $speed = [];
        $dir = [];
        for ($t = 0; $t < $hours; $t++) {
            $gu = $this->bilinear($fh, $base, $t, $H, $W, $channels, 1, $lat, $lon); // U في القناة G
            $gv = $this->bilinear($fh, $base, $t, $H, $W, $channels, 2, $lat, $lon); // V في القناة B
            $u = ($gu / 255 - 0.5) * 2 * self::WIND_UV_MAX;
            $v = ($gv / 255 - 0.5) * 2 * self::WIND_UV_MAX;
            $speed[$t] = round(sqrt($u * $u + $v * $v), 1);
            $dir[$t] = round(fmod(270 - atan2($v, $u) * 180 / M_PI + 360, 360), 1);
        }
        fclose($fh);
        return [$speed, $dir, $hours, $run];
    }

    /** استيفاء ثنائي الخطّية لقناة عند lat/lon → 0..255 (مطابق rasterSampler في الواجهة). */
    private function bilinear($fh, int $base, int $t, int $H, int $W, int $channels, int $channel, float $lat, float $lon): float
    {
        $lonN = fmod(fmod($lon + 180, 360) + 360, 360) - 180;
        $fx = (($lonN + 180) / 360) * $W;
        $fy = (($lat + 90) / 180) * ($H - 1);
        $x0 = (int) floor($fx);
        $y0 = (int) floor($fy);
        $dx = $fx - $x0;
        $dy = $fy - $y0;
        $c00 = $this->byteAt($fh, $base, $t, $y0, $x0, $H, $W, $channels, $channel);
        $c10 = $this->byteAt($fh, $base, $t, $y0, $x0 + 1, $H, $W, $channels, $channel);
        $c01 = $this->byteAt($fh, $base, $t, $y0 + 1, $x0, $H, $W, $channels, $channel);
        $c11 = $this->byteAt($fh, $base, $t, $y0 + 1, $x0 + 1, $H, $W, $channels, $channel);
        return $c00 * (1 - $dx) * (1 - $dy) + $c10 * $dx * (1 - $dy) + $c01 * (1 - $dx) * $dy + $c11 * $dx * $dy;
    }

    private function byteAt($fh, int $base, int $t, int $y, int $x, int $H, int $W, int $channels, int $channel): int
    {
        $xx = (($x % $W) + $W) % $W;
        $yy = max(0, min($H - 1, $y));
        $offset = $base + (($t * $H * $W) + ($yy * $W) + $xx) * $channels + $channel;
        fseek($fh, $offset);
        $b = fread($fh, 1);
        return $b === false || $b === '' ? 0 : ord($b);
    }

    private function denorm(string $path, float $g): float
    {
        $var = basename($path, '.cube');
        [$vmin, $vmax] = self::RANGES[$var] ?? [0, 1];
        return round($vmin + ($g / 255) * ($vmax - $vmin), 1);
    }

    /**
     * الإحساس (apparent temperature) بصيغة BoM الأسترالية القياسية — سليمة عبر كل المدى
     * وتشمل أثر الرطوبة والرياح:  AT = Ta + 0.33·e − 0.70·ws − 4.00
     * حيث e ضغط البخار (hPa) من الرطوبة، و ws بوحدة م/ث (الرياح لدينا km/h ÷ 3.6).
     */
    private function apparentTemperature(?float $t, ?float $rh, ?float $ws): ?float
    {
        if ($t === null) {
            return null;
        }
        $rh = $rh ?? 50.0;
        $wsMs = ($ws ?? 0.0) / 3.6;
        $e = ($rh / 100) * 6.105 * exp(17.27 * $t / (237.7 + $t));
        return round($t + 0.33 * $e - 0.70 * $wsMs - 4.00, 1);
    }

    /** اشتقاق كود حالة (WMO مبسّط) من الغيوم والأمطار — لاختيار الأيقونة. */
    private function weatherCode(float $clouds, float $precip): int
    {
        if ($precip >= 7) return 65;   // مطر غزير
        if ($precip >= 2) return 63;   // مطر متوسط
        if ($precip >= 0.2) return 61; // مطر خفيف
        if ($clouds >= 85) return 3;   // غائم كلياً
        if ($clouds >= 50) return 2;   // غائم جزئياً
        if ($clouds >= 20) return 1;   // صافية في الغالب
        return 0;                      // سماء صافية
    }
}
