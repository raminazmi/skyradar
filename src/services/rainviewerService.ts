import axios from 'axios';

export interface RainViewerFrame {
    time: number;
    path: string;
}

interface RainViewerWeatherMaps {
    version: string;
    generated: number;
    host: string;
    radar?: {
        past?: RainViewerFrame[];
        nowcast?: RainViewerFrame[];
    };
}

interface CachedWeatherMaps {
    data: RainViewerWeatherMaps;
    timestamp: number;
}

class RainViewerService {
    private cache: CachedWeatherMaps | null = null;
    private inFlight: Promise<RainViewerWeatherMaps> | null = null;
    private readonly cacheTtl = 5 * 60 * 1000;
    private readonly metadataUrl = 'https://api.rainviewer.com/public/weather-maps.json';

    async getWeatherMaps(): Promise<RainViewerWeatherMaps> {
        if (this.cache && Date.now() - this.cache.timestamp < this.cacheTtl) {
            return this.cache.data;
        }

        if (this.inFlight) {
            return this.inFlight;
        }

        this.inFlight = axios.get<RainViewerWeatherMaps>(this.metadataUrl)
            .then((response) => {
                this.cache = { data: response.data, timestamp: Date.now() };
                return response.data;
            })
            .finally(() => {
                this.inFlight = null;
            });

        return this.inFlight;
    }

    async getRadarFrames(): Promise<{ host: string; frames: RainViewerFrame[]; generated: number }> {
        const data = await this.getWeatherMaps();
        const pastFrames = data.radar?.past ?? [];
        const nowcastFrames = data.radar?.nowcast ?? [];

        return {
            host: data.host,
            frames: [...pastFrames, ...nowcastFrames],
            generated: data.generated,
        };
    }

    buildRadarTileUrl(host: string, frame: RainViewerFrame): string {
        return `${host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png`;
    }
}

export const rainviewerService = new RainViewerService();
