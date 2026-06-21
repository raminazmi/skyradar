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
    /**
     * يُرجع true إذا كان إطار الوقت المطلوب جاهزاً (مخزّن) للعرض. إن أرجع false،
     * يؤجّل التشغيلُ التقدّمَ ويحفّز التحميل المُسبق — فلا يظهر إطار مجمّد (منطق Zoom Earth).
     */
    canAdvance?: (timeIndex: number) => boolean;
}

export function useAutoplay({ isPlaying, playbackSpeed, weatherData, canAdvance }: Params): void {
    useEffect(() => {
        if (!isPlaying || !weatherData?.hourly.time) return;
        const length = weatherData.hourly.time.length;
        // نتحقّق على فترات قصيرة (نبضات) فنتقدّم فور جهوزية الإطار، لا على إيقاع ثابت أعمى.
        const frameMs = 800 / playbackSpeed;
        const tickMs  = Math.max(80, Math.min(frameMs, 200));
        let elapsed = 0;   // الزمن منذ آخر تقدّم
        let waited  = 0;   // كم انتظرنا جهوزية الإطار الحالي

        const interval = setInterval(() => {
            elapsed += tickMs;
            if (elapsed < frameMs) return;           // لم يحن وقت الإطار التالي بعد
            const store = useWeatherStore.getState();
            const next  = store.currentTimeIndex + 1;

            if (next >= length) { store.setIsPlaying(false); store.setCurrentTimeIndex(0); elapsed = 0; return; }

            // ننتظر جهوزية الإطار التالي (مع حدّ أقصى ~2 ثانية ثم نتقدّم رغم ذلك تفادياً للتجمّد)
            if (canAdvance && !canAdvance(next) && waited < 2000) {
                waited += tickMs;
                return;
            }
            store.setCurrentTimeIndex(next);
            elapsed = 0;
            waited  = 0;
        }, tickMs);

        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, weatherData, canAdvance]);
}
