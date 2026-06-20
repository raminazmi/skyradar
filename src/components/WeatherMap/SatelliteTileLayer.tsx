/**
 * SatelliteTileLayer.tsx — MapLibre version
 * طبقة الصور الساتلية من NASA GIBS
 */

import { Source, Layer } from 'react-map-gl/maplibre';
import { useWeatherStore } from '../../store/weatherStore';

function getGibsDate(): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

export function SatelliteTileLayer() {
    const { visibleLayers } = useWeatherStore();

    if (!visibleLayers.satellite) return null;

    const date    = getGibsDate();
    const layerId = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
    const tileUrl = [
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best',
        layerId, 'default', date,
        'GoogleMapsCompatible_Level9',
        '{z}', '{y}', '{x}.jpg',
    ].join('/');

    return (
        <Source
            key={`satellite-src-${date}`}
            id="satellite-source"
            type="raster"
            tiles={[tileUrl]}
            tileSize={256}
            maxzoom={9}
        >
            <Layer
                id="satellite-layer"
                type="raster"
                paint={{ 'raster-opacity': 0.82 }}
            />
        </Source>
    );
}
