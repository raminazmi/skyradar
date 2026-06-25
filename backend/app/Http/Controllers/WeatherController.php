<?php

namespace App\Http\Controllers;

use App\Exceptions\WeatherProviderException;
use App\Services\WeatherService;
use App\Services\GFSModelService;
use App\Services\ICONModelService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WeatherController extends Controller
{
    protected $weatherService;
    protected $gfsService;
    protected $iconService;

    public function __construct(
        WeatherService $weatherService,
        GFSModelService $gfsService,
        ICONModelService $iconService
    ) {
        $this->weatherService = $weatherService;
        $this->gfsService = $gfsService;
        $this->iconService = $iconService;
    }

    public function index()
    {
        return Inertia::render('WeatherMap', [
            'availableModels' => ['GFS', 'ICON'],
            'defaultModel' => 'GFS',
            'availableLayers' => [
                'wind',
                'wind-gusts',
                'temperature',
                'feels-like',
                'precipitation',
                'pressure',
                'humidity',
                'dewpoint',
                'clouds',
                'radar',
                'satellite',
                'hurricanes',
                'wildfires'
            ]
        ]);
    }

    public function availableModels()
    {
        return response()->json([
            'models' => [
                $this->gfsService->getModelInfo(),
                $this->iconService->getModelInfo()
            ]
        ]);
    }

    public function forecast(Request $request)
    {
        $validated = $request->validate([
            'latitude' => 'required|numeric|min:-90|max:90',
            'longitude' => 'required|numeric|between:-540,540',
            'model' => 'required|in:GFS,ICON',
            'hours' => 'integer|min:1|max:384'
        ]);

        try {
            $data = $this->weatherService->getForecast(
                (float) $validated['latitude'],
                (float) $validated['longitude'],
                $validated['model'],
                (int) ($validated['hours'] ?? 168)
            );
        } catch (WeatherProviderException $exception) {
            return $this->providerFailureResponse($exception);
        }

        return response()->json($data);
    }

    public function grid(Request $request)
    {
        $validated = $request->validate([
            'north' => 'required|numeric|between:-90,90',
            'south' => 'required|numeric|between:-90,90',
            'east' => 'required|numeric|between:-540,540',
            'west' => 'required|numeric|between:-540,540',
            'model' => 'required|in:GFS,ICON',
            'type' => 'required|in:wind,wind-gusts,temperature,feels-like,precipitation,pressure,humidity,dewpoint,clouds',
            'timeIndex' => 'nullable|integer|min:0|max:383',
            'resolution' => 'nullable|integer|min:4|max:60',
        ]);

        $startedAt = microtime(true);
        try {
            $data = $this->weatherService->getGridData(
                [
                    'north' => (float) $validated['north'],
                    'south' => (float) $validated['south'],
                    'east' => (float) $validated['east'],
                    'west' => (float) $validated['west'],
                ],
                $validated['model'],
                $validated['type'],
                (int) ($validated['timeIndex'] ?? 0),
                (int) ($validated['resolution'] ?? 12)
            );
        } catch (WeatherProviderException $exception) {
            return $this->providerFailureResponse($exception);
        }

        $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);

        // قياس قبل/بعد: زمن المعالجة بالخادم يظهر في ترويسة الاستجابة (X-Grid-Time-Ms).
        // ترويسات الكاش تتيح للمتصفح/CDN خدمة الإطار نفسه بلا رحلة جديدة للخادم.
        return response()->json($data)
            ->header('X-Grid-Time-Ms', (string) $elapsedMs)
            ->header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
    }

    protected function providerFailureResponse(WeatherProviderException $exception)
    {
        return response()->json([
            'error' => true,
            'message' => $exception->getMessage(),
            'source' => 'weather-provider',
        ], $exception->getStatusCode());
    }

    public function gfsData(Request $request)
    {
        $validated = $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'variables' => 'array',
            'hours' => 'integer'
        ]);

        $data = $this->gfsService->getRegionalData(
            $validated['latitude'],
            $validated['longitude'],
            $validated['variables'] ?? ['temperature', 'wind', 'precipitation'],
            $validated['hours'] ?? 168
        );

        return response()->json($data);
    }

    public function iconData(Request $request)
    {
        $validated = $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'variables' => 'array',
            'hours' => 'integer'
        ]);

        $data = $this->iconService->getRegionalData(
            $validated['latitude'],
            $validated['longitude'],
            $validated['variables'] ?? ['temperature', 'wind', 'precipitation'],
            $validated['hours'] ?? 168
        );

        return response()->json($data);
    }

    public function satelliteInfo()
    {
        return response()->json([
            'sources' => [
                'GOES-East' => [
                    'region' => 'Americas',
                    'updateInterval' => 10,
                    'resolution' => '1km'
                ],
                'GOES-West' => [
                    'region' => 'Pacific',
                    'updateInterval' => 10,
                    'resolution' => '1km'
                ],
                'Himawari-8' => [
                    'region' => 'Asia-Pacific',
                    'updateInterval' => 10,
                    'resolution' => '0.5km'
                ],
                'Meteosat' => [
                    'region' => 'Europe-Africa',
                    'updateInterval' => 15,
                    'resolution' => '1km'
                ]
            ]
        ]);
    }

    public function tropicalCyclones()
    {
        $cyclones = $this->weatherService->getTropicalCyclones();

        return response()->json([
            'cyclones' => $cyclones,
            'lastUpdated' => now()->toIso8601String()
        ]);
    }

    public function wildfires()
    {
        $fires = $this->weatherService->getWildfires();

        return response()->json([
            'fires' => $fires,
            'lastUpdated' => now()->toIso8601String()
        ]);
    }
}
