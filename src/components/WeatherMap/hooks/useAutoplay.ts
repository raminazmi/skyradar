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
        // زمن عبور ساعة كاملة (نمزج الإطارين خلالها بنعومة بدل قفزة) — استيفاء زمني مثل Zoom Earth.
        const frameMs = 1600 / playbackSpeed;
        const tickMs  = 60;                 // ~16 تحديثاً/ثانية → حركة ناعمة
        let waited = 0;                     // انتظار جهوزية الإطار التالي

        const interval = setInterval(() => {
            const store = useWeatherStore.getState();
            const idx = store.currentTimeIndex;
            const frac = store.frameFraction + tickMs / frameMs;

            if (frac < 1) { store.setFrameFraction(frac); return; }   // ما زلنا داخل الساعة → مزج

            const next = idx + 1;
            if (next >= length) {                 // النهاية → عُد إلى "الآن" وتوقّف
                store.setIsPlaying(false);
                store.setCurrentTimeIndex(Math.max(0, Math.min(length - 1, homeIndex)));
                store.setFrameFraction(0);
                return;
            }
            // ننتظر جهوزية الإطار التالي (حدّ ~2ث) عند الحافّة كي لا يقفز فوق إطار غير محمّل.
            if (canAdvance && !canAdvance(next) && waited < 2000) {
                waited += tickMs;
                store.setFrameFraction(0.999);
                return;
            }
            store.setCurrentTimeIndex(next);
            store.setFrameFraction(0);
            waited = 0;
        }, tickMs);

        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, frameCount, canAdvance, homeIndex]);
}
