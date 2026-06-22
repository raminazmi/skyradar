<?php

namespace App\Providers;

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // خوادم MySQL/MyISAM القديمة تحدّ طول الفهرس بـ 1000 بايت؛
        // مع utf8mb4 نضبط الطول الافتراضي إلى 191 لتفادي الخطأ 1071.
        Schema::defaultStringLength(191);
    }
}
