<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="راصد ويذر - عرض حي وفوري للطقس حول العالم بنماذج GFS و ICON">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    
    <title inertia>راصد ويذر</title>
    
    <!-- Scripts -->
    @viteReactRefresh
    @vite(['resources/js/app.tsx', 'resources/css/app.css'])
    @inertiaHead
</head>
<body class="font-cairo antialiased">
    @inertia
</body>
</html>
