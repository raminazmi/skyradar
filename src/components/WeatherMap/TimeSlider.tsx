import { useRef } from 'react';
import {
    FiChevronDown,
    FiChevronUp,
    FiPause,
    FiPlay,
    FiSkipBack,
    FiSkipForward,
} from 'react-icons/fi';
import { useWeatherStore } from '../../store/weatherStore';

const arabicMonths = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
];

interface TimeSliderProps {
    times: Array<string | number>;
    currentTimeIndex: number;
    isPlaying: boolean;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function TimeSlider({ times, currentTimeIndex, isPlaying }: TimeSliderProps) {
    const {
        setCurrentTimeIndex,
        setIsPlaying,
        frameFraction,
        setFrameFraction,
    } = useWeatherStore();
    const sliderRef = useRef<HTMLDivElement>(null);

    // الموضع المستمرّ = الإطار + كسره، مثبّتاً على خطوات 10 دقائق (1/6 ساعة) مثل Zoom Earth.
    const seekToPosition = (clientX: number) => {
        if (!sliderRef.current || times.length <= 1) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const position = clamp((clientX - rect.left) / rect.width, 0, 1);
        const exact = position * (times.length - 1);
        const snapped = Math.round(exact * 6) / 6;          // خطوة 10 دقائق
        const idx = clamp(Math.floor(snapped), 0, times.length - 1);
        setCurrentTimeIndex(idx);
        setFrameFraction(idx >= times.length - 1 ? 0 : snapped - idx);
    };

    // سحب متواصل على الشريط (مؤشّر/لمس) — يتتبّع الإصبع بخطوات 10 دقائق مثل Zoom Earth.
    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekToPosition(event.clientX);
    };
    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.buttons & 1) seekToPosition(event.clientX);
    };

    const jumpBy = (delta: number) => {
        setCurrentTimeIndex(clamp(currentTimeIndex + delta, 0, Math.max(0, times.length - 1)));
        setFrameFraction(0);
    };

    // خطوة 10 دقائق (1/6 إطار) للأمام/الخلف — تنقّل دقيق مثل Zoom Earth.
    const jumpMinutes = (dir: 1 | -1) => {
        const maxPos = Math.max(0, times.length - 1);
        const pos = clamp(currentTimeIndex + frameFraction + dir / 6, 0, maxPos);
        const snapped = Math.round(pos * 6) / 6;
        const idx = clamp(Math.floor(snapped), 0, maxPos);
        setCurrentTimeIndex(idx);
        setFrameFraction(idx >= maxPos ? 0 : snapped - idx);
    };

    const jumpByDays = (days: number) => {
        jumpBy(days * 24);
    };

    // الزمن المعروض = زمن الإطار + كسر الساعة (فيظهر :10، :20… مثل Zoom Earth).
    const baseEpoch = times[currentTimeIndex] ? Number(times[currentTimeIndex]) : Date.now() / 1000;
    const currentTime = new Date((baseEpoch + frameFraction * 3600) * 1000);
    const now = new Date();
    const hoursDiff = Math.round((currentTime.getTime() - now.getTime()) / (1000 * 60 * 60));

    let relativeLabel = 'الآن';
    if (hoursDiff > 0) {
        relativeLabel = hoursDiff < 24 ? `بعد ${hoursDiff} ساعة` : `بعد ${Math.floor(hoursDiff / 24)} يوم`;
    } else if (hoursDiff < 0) {
        relativeLabel = Math.abs(hoursDiff) < 24
            ? `قبل ${Math.abs(hoursDiff)} ساعة`
            : `قبل ${Math.floor(Math.abs(hoursDiff) / 24)} يوم`;
    }

    const dateLabel = `${currentTime.getDate()} ${arabicMonths[currentTime.getMonth()]}`;
    const hourLabel = `${String(currentTime.getHours()).padStart(2, '0')} : ${String(currentTime.getMinutes()).padStart(2, '0')}`;
    const progressPercentage = ((currentTimeIndex + frameFraction) / Math.max(1, times.length - 1)) * 100;

    return (
        <div className="time-slider-container">
            <div className="time-slider-track-shell">
                <div
                    className="slider-track"
                    ref={sliderRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    style={{ touchAction: 'none' }}
                >
                    <div className="slider-progress" style={{ width: `${progressPercentage}%` }} />
                    <div className="slider-handle" style={{ left: `${progressPercentage}%` }}>
                        <div className="handle-circle" />
                    </div>
                </div>
            </div>

            <div className="zoom-time-controller">
                <div className="zoom-time-card">
                    <button
                        className="time-nav-btn"
                        onClick={() => jumpBy(-6)}
                        title="إرجاع 6 ساعات"
                        type="button"
                    >
                        <FiSkipForward />
                    </button>

                    <div className="time-selector">
                        <button
                            className="time-arrow-btn"
                            onClick={() => jumpByDays(1)}
                            title="اليوم التالي"
                            type="button"
                        >
                            <FiChevronUp />
                        </button>
                        <div className="time-selector-value">{dateLabel}</div>
                        <button
                            className="time-arrow-btn"
                            onClick={() => jumpByDays(-1)}
                            title="اليوم السابق"
                            type="button"
                        >
                            <FiChevronDown />
                        </button>
                    </div>

                    <button
                        className="time-play-btn"
                        onClick={() => setIsPlaying(!isPlaying)}
                        title={isPlaying ? 'إيقاف الحركة' : 'تشغيل الحركة'}
                        type="button"
                    >
                        {isPlaying ? <FiPause /> : <FiPlay />}
                    </button>
                    
                    <div className="time-selector time-selector-hour">
                        <button
                            className="time-arrow-btn"
                            onClick={() => jumpMinutes(1)}
                            title="بعد 10 دقائق"
                            type="button"
                        >
                            <FiChevronUp />
                        </button>
                        <div className="time-selector-value time-selector-time">{hourLabel}</div>
                        <button
                            className="time-arrow-btn"
                            onClick={() => jumpMinutes(-1)}
                            title="قبل 10 دقائق"
                            type="button"
                        >
                            <FiChevronDown />
                        </button>
                    </div>

                    <button
                        className="time-nav-btn"
                        onClick={() => jumpBy(6)}
                        title="تقديم 6 ساعات"
                        type="button"
                    >
                        <FiSkipBack />
                    </button>
                </div>

                <div className="zoom-time-relative">{relativeLabel}</div>
            </div>
        </div>
    );
}
