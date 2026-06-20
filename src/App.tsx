import { lazy, Suspense } from 'react';
import { Header } from './components/WeatherMap/Header';
import './index.css';
import './components/WeatherMap/WeatherMap.css';

const NewWeatherMap = lazy(() =>
    import('./components/WeatherMap/NewWeatherMap').then((module) => ({
        default: module.NewWeatherMap,
    }))
);

function WeatherMapFallback() {
    return (
        <div className="weather-map-container dark" dir="rtl">
            <Header />
            <div className="map-wrapper map-skeleton" aria-hidden="true" />
        </div>
    );
}

function App() {
    return (
        <Suspense fallback={<WeatherMapFallback />}>
            <NewWeatherMap />
        </Suspense>
    );
}

export default App;
