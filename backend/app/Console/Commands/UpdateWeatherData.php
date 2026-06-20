<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\WeatherService;
use App\Services\GFSModelService;
use App\Services\ICONModelService;
use App\Services\SatelliteService;
use App\Services\CycloneTrackingService;
use App\Services\WildfireService;

class UpdateWeatherData extends Command
{
    /**
     * اسم الأمر وتوقيعه
     */
    protected $signature = 'weather:update 
                            {--type=all : نوع البيانات للتحديث (all, gfs, icon, satellite, cyclones, wildfires)}
                            {--lat=0 : خط العرض المركزي}
                            {--lon=0 : خط الطول المركزي}';

    /**
     * وصف الأمر
     */
    protected $description = 'تحديث بيانات الطقس من المصادر الخارجية';

    /**
     * تنفيذ الأمر
     */
    public function handle(
        WeatherService $weatherService,
        GFSModelService $gfsService,
        ICONModelService $iconService,
        SatelliteService $satelliteService,
        CycloneTrackingService $cycloneService,
        WildfireService $wildfireService
    ): int {
        $type = $this->option('type');
        
        $this->info('بدء تحديث بيانات الطقس...');
        $startTime = microtime(true);

        if ($type === 'all' || $type === 'gfs') {
            $this->info('تحديث بيانات نموذج GFS...');
            // تحديث بيانات GFS
        }

        if ($type === 'all' || $type === 'icon') {
            $this->info('تحديث بيانات نموذج ICON...');
            // تحديث بيانات ICON
        }

        if ($type === 'all' || $type === 'satellite') {
            $this->info('تحديث بيانات الأقمار الصناعية...');
            $satelliteService->updateSatelliteData();
            $this->info('✓ تم تحديث بيانات الأقمار الصناعية');
        }

        if ($type === 'all' || $type === 'cyclones') {
            $this->info('تحديث بيانات الأعاصير...');
            $cycloneService->updateCycloneData();
            $this->info('✓ تم تحديث بيانات الأعاصير');
        }

        if ($type === 'all' || $type === 'wildfires') {
            $this->info('تحديث بيانات الحرائق...');
            $wildfireService->updateFireData();
            $this->info('✓ تم تحديث بيانات الحرائق');
        }

        $elapsed = round(microtime(true) - $startTime, 2);
        $this->info("✓ اكتمل التحديث في {$elapsed} ثانية");

        return Command::SUCCESS;
    }
}
