<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * تعريف جدولة المهام
     */
    protected function schedule(Schedule $schedule): void
    {
        // تحديث بيانات الأقمار الصناعية كل 10 دقائق
        $schedule->command('weather:update --type=satellite')
            ->everyTenMinutes()
            ->withoutOverlapping()
            ->appendOutputTo(storage_path('logs/weather-satellite.log'));

        // تحديث بيانات الأعاصير كل ساعة
        $schedule->command('weather:update --type=cyclones')
            ->hourly()
            ->withoutOverlapping()
            ->appendOutputTo(storage_path('logs/weather-cyclones.log'));

        // تحديث بيانات الحرائق كل 6 ساعات
        $schedule->command('weather:update --type=wildfires')
            ->everySixHours()
            ->withoutOverlapping()
            ->appendOutputTo(storage_path('logs/weather-wildfires.log'));

        // تحديث شامل كل 6 ساعات
        $schedule->command('weather:update')
            ->everySixHours()
            ->withoutOverlapping()
            ->appendOutputTo(storage_path('logs/weather-update.log'));
    }

    /**
     * تسجيل أوامر التطبيق
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
