/**
 * useAutoplay.ts
 * يقدّم مؤشّر الوقت تلقائياً أثناء التشغيل، ويتوقّف ويعود للبداية عند النهاية.
 */

import { useEffect } from 'react';
import { useWeatherStore, type WeatherData } from '../../../store/weatherStore';

interface Params {
    isPlaying: boolean;
    playbackSpeed: number;
    weatherData: WeatherData | null;
}

export function useAutoplay({ isPlaying, playbackSpeed, weatherData }: Params): void {
    useEffect(() => {
        if (!isPlaying || !weatherData?.hourly.time) return;
        const interval = setInterval(() => {
            const store = useWeatherStore.getState();
            const next  = store.currentTimeIndex + 1;
            if (next >= weatherData.hourly.time.length) {
                store.setIsPlaying(false); store.setCurrentTimeIndex(0);
            } else {
                store.setCurrentTimeIndex(next);
            }
        }, 800 / playbackSpeed);
        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, weatherData]);
}
