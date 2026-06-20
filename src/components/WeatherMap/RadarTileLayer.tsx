/**
 * RadarTileLayer.tsx — MapLibre version
 * طبقة الرادار — تستخدم Source + Layer من react-map-gl
 */

import { useEffect, useMemo, useState } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { rainviewerService, type RainViewerFrame } from '../../services/rainviewerService';
import { useWeatherStore } from '../../store/weatherStore';

interface RadarState {
    host: string;
    frames: RainViewerFrame[];
}

export function RadarTileLayer() {
    const { visibleLayers, currentTimeIndex, isPlaying, layerAnimationSettings } = useWeatherStore();
    const [radar, setRadar] = useState<RadarState | null>(null);

    useEffect(() => {
        if (!visibleLayers.radar) return;
        let cancelled = false;
        rainviewerService.getRadarFrames()
            .then((frames) => { if (!cancelled) setRadar(frames); })
            .catch(() => { if (!cancelled) setRadar(null); });
        return () => { cancelled = true; };
    }, [visibleLayers.radar]);

    const frame = useMemo(() => {
        if (!radar?.frames.length) return null;
        if (!isPlaying || layerAnimationSettings.radar.reduceMotion)
            return radar.frames[radar.frames.length - 1];
        return radar.frames[currentTimeIndex % radar.frames.length];
    }, [currentTimeIndex, isPlaying, layerAnimationSettings.radar.reduceMotion, radar]);

    if (!visibleLayers.radar || !radar || !frame) return null;

    const tileUrl = rainviewerService.buildRadarTileUrl(radar.host, frame);

    return (
        <Source
            key={`radar-src-${frame.time}`}
            id="radar-source"
            type="raster"
            tiles={[tileUrl]}
            tileSize={256}
        >
            <Layer
                id="radar-layer"
                type="raster"
                paint={{ 'raster-opacity': 0.76 }}
                layout={{ visibility: 'visible' }}
            />
        </Source>
    );
}
