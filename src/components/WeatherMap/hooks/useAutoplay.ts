/**
 * useAutoplay.ts
 * يقدّم مؤشّر الوقت تلقائياً أثناء التشغيل، ويتوقّف ويعود للبداية عند النهاية.
 */

import { useEffect } from 'react';
import { useWeatherStore } from '../../../store/weatherStore';

interface Params {
    isPlaying: boolean;
    playbackSpeed: number;
    /** عدد إطارات الشريط الزمني (ساعات التوقّع) — مستقلّ عن Open-Meteo. */
    frameCount: number;
    /**
     * يُرجع true إذا كان إطار الوقت المطلوب جاهزاً (مخزّن) للعرض. إن أرجع false،
     * يؤجّل التشغيلُ التقدّمَ ويحفّز التحميل المُسبق — فلا يظهر إطار مجمّد (منطق Zoom Earth).
     */
    canAdvance?: (timeIndex: number) => boolean;
    /** الإطار الذي يعود إليه التشغيل عند بلوغ النهاية — إطار "الآن" لا بداية الدورة (الماضي). */
    homeIndex?: number;
}

export function useAutoplay({ isPlaying, playbackSpeed, frameCount, canAdvance, homeIndex = 0 }: Params): void {
    useEffect(() => {
        if (!isPlaying || frameCount < 2) return;
        const length = frameCount;
        // خطوات 10 دقائق منفصلة مثل Zoom Earth: 6 خطوات فرعية لكل ساعة (الكسر = sub/6).
        // المزج البصري يعطي تدرّجاً بين الخطوات بلا بيانات جديدة، والساعة تتقدّم 00→10→20…
        const SUB = 6;
        const stepMs = Math.max(150, (1000 / playbackSpeed));   // زمن لبث كل خطوة 10 دقائق
        const tickMs = Math.min(stepMs, 120);
        let elapsed = 0;
        let waited = 0;

        const interval = setInterval(() => {
            elapsed += tickMs;
            if (elapsed < stepMs) return;                       // لم يحن وقت الخطوة التالية
            const store = useWeatherStore.getState();
            const idx = store.currentTimeIndex;
            const sub = Math.round(store.frameFraction * SUB);  // الخطوة الفرعية الحالية 0..5

            if (sub < SUB - 1) {                                // خطوة داخل نفس الساعة
                store.setFrameFraction((sub + 1) / SUB);
                elapsed = 0;
                return;
            }

            const next = idx + 1;                              // الخطوة التالية = الساعة التالية
            if (next >= length) {                              // النهاية → عُد إلى "الآن" وتوقّف
                store.setIsPlaying(false);
                store.setCurrentTimeIndex(Math.max(0, Math.min(length - 1, homeIndex)));
                store.setFrameFraction(0);
                return;
            }
            if (canAdvance && !canAdvance(next) && waited < 2000) {
                waited += tickMs;
                return;
            }
            store.setCurrentTimeIndex(next);
            store.setFrameFraction(0);
            elapsed = 0;
            waited = 0;
        }, tickMs);

        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, frameCount, canAdvance, homeIndex]);
}
