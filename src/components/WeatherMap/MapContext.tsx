/**
 * MapContext.tsx
 * سياق مشترك لمرجع خريطة MapLibre — يُستخدَم بدلاً من useMap من react-leaflet
 */

import { createContext, useContext, type RefObject } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';

interface MapContextValue {
    mapRef: RefObject<MapRef | null>;
}

export const MapContext = createContext<MapContextValue>({
    mapRef: { current: null },
});

export function useMapRef(): RefObject<MapRef | null> {
    return useContext(MapContext).mapRef;
}
