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
        playbackSpeed,
        setCurrentTimeIndex,
        setIsPlaying,
        setPlaybackSpeed,
    } = useWeatherStore();
    const sliderRef = useRef<HTMLDivElement>(null);

    const handleSliderClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!sliderRef.current || times.length <= 1) {
            return;
        }

        const rect = sliderRef.current.getBoundingClientRect();
        const position = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        setCurrentTimeIndex(Math.round(position * (times.length - 1)));
    };

    const jumpBy = (delta: number) => {
        setCurrentTimeIndex(clamp(currentTimeIndex + delta, 0, Math.max(0, times.length - 1)));
    };

    const jumpByDays = (days: number) => {
        jumpBy(days * 24);
    };

    const currentTime = times[currentTimeIndex] ? new Date(Number(times[currentTimeIndex]) * 1000) : new Date();
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
    const progressPercentage = (currentTimeIndex / Math.max(1, times.length - 1)) * 100;

    return (
        <div className="time-slider-container">
            <div className="time-slider-track-shell">
                <div className="slider-track" ref={sliderRef} onClick={handleSliderClick}>
                    <div className="slider-progress" style={{ width: `${progressPercentage}%` }} />
                    <div className="slider-handle" style={{ left: `${progressPercentage}%` }}>
                        <div className="handle-circle" />
                    </div>
                </div>
            </div>

            <div className="zoom-time-controller">
                <div className="zoom-time-speed">
                    {[1, 2, 4].map((speed) => (
                        <button
                            key={speed}
                            className={`zoom-speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
                            onClick={() => setPlaybackSpeed(speed)}
                            type="button"
                        >
                            {speed}x
                        </button>
                    ))}
                </div>

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
                            onClick={() => jumpBy(1)}
                            title="الساعة التالية"
                            type="button"
                        >
                            <FiChevronUp />
                        </button>
                        <div className="time-selector-value time-selector-time">{hourLabel}</div>
                        <button
                            className="time-arrow-btn"
                            onClick={() => jumpBy(-1)}
                            title="الساعة السابقة"
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
