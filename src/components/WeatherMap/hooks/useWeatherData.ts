/**
 * useWeatherData.ts
 * يجلب بيانات الطقس للموقع المحدّد عند تغيّر الموقع أو النموذج، مع إلغاء الطلبات القديمة.
 */

import { useEffect, useRef } from 'react';
import { weatherService } from '../../../services/weatherService';
import { logApiErrorThrottled } from '../../../services/apiRateLimit';
import { useWeatherStore } from '../../../store/weatherStore';

interface Params {
    currentLocation: { lat: number; lon: number } | null;
    selectedModel: string;
}

export function useWeatherData({ currentLocation, selectedModel }: Params): void {
    const setWeatherData = useWeatherStore(s => s.setWeatherData);
    const setIsLoading   = useWeatherStore(s => s.setIsLoading);
    const requestRef = useRef(0);

    useEffect(() => {
        if (!currentLocation) return;
        const id = ++requestRef.current;
        setIsLoading(true);
        weatherService.getWeatherData(currentLocation.lat, currentLocation.lon, selectedModel)
            .then(data => { if (requestRef.current === id) setWeatherData(data); })
            .catch(err  => { if (requestRef.current === id) logApiErrorThrottled('خطأ في بيانات الطقس:', err); })
            .finally(() => { if (requestRef.current === id) setIsLoading(false); });
    }, [currentLocation, selectedModel, setWeatherData, setIsLoading]);
}
