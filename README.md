# 🌍 Sky Radar

A real-time global weather visualization platform, built on a custom WebGL rendering pipeline and visually inspired by [zoom.earth](https://zoom.earth), with full Arabic-first support (RTL UI and Arabic city labels).


## ✨ Features

### 🗺️ Advanced interactive map (MapLibre GL JS + WebGL)
- Multiple weather layers (wind, precipitation, temperature, clouds) rendered as custom WebGL layers on top of the map
- Animated GPU wind particles that follow real wind vector data in real time
- Color-graded heatmaps with gradients tuned to match real-world weather visualization references
- Hillshade terrain relief from real elevation data, themed separately for light/dark map styles
- Time slider with autoplay and adjustable speeds

### 🌤️ Weather models
- **GFS**: 25km resolution, 16-day forecast, NOAA
- **ICON**: 13km resolution, 7.5-day forecast, DWD
- Quick switching between models with smooth transitions

### 🛰️ Multiple data sources
- Live weather data via Open-Meteo (GFS/ICON)
- Cyclone tracking
- Wildfire detection (NASA FIRMS)

### 🔍 Search and icons
- Arabic city search with client-side caching and automatic cancellation of stale requests
- Realistic weather icons that adapt to time of day (day/night) and current conditions

### 🌐 Fully Arabic interface
- 100% Arabic (Modern Standard Arabic) UI with correct RTL layout
- Arabic units of measurement (km/h, mm, etc.)

## 🏗️ Tech stack

```
Frontend: React 19 + TypeScript + Vite + Tailwind CSS + Zustand
          MapLibre GL JS (react-map-gl) + custom WebGL layers
Backend:  Laravel (PHP) — aggregates and caches Open-Meteo data
          (Http::pool for batched requests, two-tier caching: fresh + stale-fallback)
Database: MySQL
Cache:    Redis (optional — also works without it via file-based cache)
```

## 🚀 Getting started

### Frontend (React)
```bash
npm install
npm run dev      # development
npm run build    # production
```

### Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

The frontend expects the API to be reachable at `/api/v1` (proxied via Vite in development).

## 📚 Usage

1. **Open the site** → the live map appears immediately
2. **Pick a layer** from the sidebar (wind, precipitation, etc.)
3. **Switch models** between GFS and ICON
4. **Play the timeline** to see weather evolve over time
5. **Click the map** or search for a city to select a specific location

## 📄 Key files

```
src/
├── components/WeatherMap/
│   ├── NewWeatherMap.tsx       # Main map component
│   ├── HeatmapWebGLLayer.tsx   # Heatmap layer (WebGL)
│   ├── ParticleWebGLLayer.tsx  # Wind particle layer (WebGL)
│   ├── CentralLegend.tsx       # Color legend
│   ├── webgl/layerOrder.ts     # Map layer ordering (borders/terrain/coastlines)
│   └── hooks/                  # Data fetching and styling hooks
├── services/
│   ├── weatherGridService.ts   # Weather grid fetching with caching and request batching
│   └── geocodingService.ts     # City search with caching and stale-request cancellation
└── store/
    └── weatherStore.ts

backend/
└── app/
    ├── Http/Controllers/WeatherController.php
    └── Services/
        ├── WeatherService.php      # Weather grid fetching (batching/caching)
        └── LocationService.php     # Location search (6-hour cache)
```

## 🐛 Troubleshooting

### Map feels slow?
- Lower the `resolution` parameter in grid requests (`weatherGridService`)
- Enable Redis on the backend for faster caching, or rely on the default file cache

### Data not updating?
```bash
# Make sure Redis is running (optional)
redis-server
```

## 📜 License

Open source — see [LICENSE](LICENSE).

## 🙏 Acknowledgements

- **NOAA/NCEP** — GFS model
- **DWD** — ICON model
- **Open-Meteo** — free weather API
- **MapLibre GL JS** — mapping engine
- **NASA FIRMS** — wildfire data

---

<div align="center">

### Sky Radar — Weather, visualized differently 🌍🌤️⛅

</div>
