/**
 * rasterSampler.ts
 * يقرأ قيمة الطقس مباشرةً من نُسج GFS الرمادية المحلّية (public/rasters/*.png) عند أي
 * إحداثي — بلا أي طلب لـ Open-Meteo. هذا يُلغي اعتماد التلميح/الرياح على الـ API
 * (وينهي أخطاء 429 نهائياً) مادام مصدر الطبقات هو نفسه نُسج NOAA GFS المجانية.
 *
 * التطبيع معكوس تماماً لما يكتبه gfs_to_raster.py:
 *   - السلَّمية: القيمة الرمادية g∈[0,255] →  value = vmin + (g/255)·(vmax−vmin)
 *   - الرياح (RGB): R=السرعة، G=U، B=V  (مطابق WIND_UV_MAX / WIND_SPEED_MAX).
 *
 * هندسة الصورة (مطابقة للسكربت والشيدر): الصفّ 0 (أعلى الصورة) = الجنوب، والعمود 0 =
 * خط الطول −180.
 */

import type { ForecastGridType } from '../config/weatherLayers';
import { VALUE_RANGES, WIND_UV_MAX } from '../components/WeatherMap/webgl/weatherTextures';
import { queuePrefetch } from './prefetchQueue';

const WIND_SPEED_MAX = 120; // يطابق VALUE_RANGES['wind'] و WIND_SPEED_MAX في السكربت

interface RasterField {
    width: number;
    height: number;
    data: Uint8ClampedArray; // RGBA
}

export interface WindSample {
    u: number;
    v: number;
    speed: number;
    direction: number; // اتجاه المصدر (meteorological) بالدرجات
}

function normalizeLongitude(value: number): number {
    return ((((value + 180) % 360) + 360) % 360) - 180;
}

/** سقف الكاش: كل حقل ImageData بالدقة الكاملة (~1-4MB) — بلا سقف كان يتضخّم أثناء التشغيل. */
const MAX_FIELDS = 16;

class RasterSampler {
    private fields = new Map<string, RasterField>();
    private loading = new Map<string, Promise<RasterField | null>>();
    private dir = 'rasters/';

    /** يتبع مجلد النموذج المختار (rasters/ ↔ rasters/ecmwf/ ↔ rasters/icon/) — تحدّده الواجهة. */
    setDir(dir: string): void {
        if (dir === this.dir) return;
        this.dir = dir;
        // الحقول القديمة تخصّ نموذجاً آخر — نفرغ الكاش كي لا تُقرأ قيم النموذج الخطأ.
        this.fields.clear();
        this.loading.clear();
    }

    private url(type: ForecastGridType | 'wind', idx: number): string {
        return `${import.meta.env.BASE_URL}${this.dir}${type}_${String(idx).padStart(3, '0')}.png`;
    }

    /** يحمّل صورة في ImageData (مع رجوع للإطار 000 إن لم يتوفّر الإطار المطلوب). */
    private async loadField(type: ForecastGridType | 'wind', idx: number): Promise<RasterField | null> {
        const key = `${type}_${idx}`;
        const cached = this.fields.get(key);
        if (cached) return cached;
        const inFlight = this.loading.get(key);
        if (inFlight) return inFlight;

        const task = this.decode(this.url(type, idx))
            .catch(() => (idx === 0 ? null : this.decode(this.url(type, 0)).catch(() => null)))
            .then((field) => {
                if (field) {
                    this.fields.set(key, field);
                    while (this.fields.size > MAX_FIELDS) {
                        const oldest = this.fields.keys().next().value;
                        if (oldest === undefined) break;
                        this.fields.delete(oldest);
                    }
                }
                this.loading.delete(key);
                return field;
            });
        this.loading.set(key, task);
        return task;
    }

    private decode(src: string): Promise<RasterField> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (!ctx) return reject(new Error('no 2d context'));
                    ctx.drawImage(img, 0, 0);
                    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    resolve({ width: canvas.width, height: canvas.height, data });
                } catch (e) {
                    reject(e as Error);
                }
            };
            img.onerror = () => reject(new Error(`failed to load ${src}`));
            img.src = src;
        });
    }

    /** يضمن تحميل نسيج طبقة/إطار مسبقاً (للاستدعاء من الخطافات قبل المرور).
     * يمرّ عبر طابور التزامن — إحماء غير عاجل يجب ألّا يغرق الاستضافة المشتركة. */
    prefetch(type: ForecastGridType | 'wind', idx: number): void {
        const key = `${type}_${idx}`;
        if (this.fields.has(key) || this.loading.has(key)) return;
        queuePrefetch(() => this.loadField(type, idx));
    }

    /** يحمّل النسيج وينتظره — لبناء شبكة (مثل حقل الرياح) من الصورة. */
    async ensure(type: ForecastGridType | 'wind', idx: number): Promise<boolean> {
        return (await this.loadField(type, idx)) !== null;
    }

    /** فِهرسة بكسل مع لفّ خط الطول وقصّ خط العرض، وقراءة قناة channel. */
    private channelAt(field: RasterField, x: number, y: number, channel: number): number {
        const { width, height, data } = field;
        const xx = ((x % width) + width) % width;
        const yy = Math.max(0, Math.min(height - 1, y));
        return data[(yy * width + xx) * 4 + channel];
    }

    /** استيفاء ثنائي الخطّية لقناة عند lat/lon → قيمة 0..255. */
    private bilinear(field: RasterField, lat: number, lon: number, channel: number): number {
        const { width, height } = field;
        const lonN = normalizeLongitude(lon);
        const fx = ((lonN + 180) / 360) * width;
        const fy = ((lat + 90) / 180) * (height - 1);
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const dx = fx - x0;
        const dy = fy - y0;
        const c00 = this.channelAt(field, x0, y0, channel);
        const c10 = this.channelAt(field, x0 + 1, y0, channel);
        const c01 = this.channelAt(field, x0, y0 + 1, channel);
        const c11 = this.channelAt(field, x0 + 1, y0 + 1, channel);
        return (
            c00 * (1 - dx) * (1 - dy) +
            c10 * dx * (1 - dy) +
            c01 * (1 - dx) * dy +
            c11 * dx * dy
        );
    }

    /**
     * قيمة طبقة سلَّمية بوحدتها الأصلية عند lat/lon. يُرجع null إن لم يكن النسيج
     * محمّلاً بعد (يُطلَق تحميله ضمنياً، ويُحاول المستدعي ثانيةً في الإطار التالي).
     */
    sampleScalar(type: ForecastGridType, idx: number, lat: number, lon: number): number | null {
        const field = this.fields.get(`${type}_${idx}`);
        if (!field) { void this.loadField(type, idx); return null; }
        const [vmin, vmax] = VALUE_RANGES[type];
        const g = this.bilinear(field, lat, lon, 0); // القناة R
        return vmin + (g / 255) * (vmax - vmin);
    }

    /** سرعة/اتجاه الرياح عند lat/lon من نسيج الرياح RGB. null إن لم يُحمَّل بعد. */
    sampleWind(idx: number, lat: number, lon: number): WindSample | null {
        const field = this.fields.get(`wind_${idx}`) ?? this.fields.get('wind_0');
        if (!field) { void this.loadField('wind', idx); return null; }
        const g = this.bilinear(field, lat, lon, 1); // U في القناة G
        const b = this.bilinear(field, lat, lon, 2); // V في القناة B
        const u = (g / 255 - 0.5) * 2 * WIND_UV_MAX;
        const v = (b / 255 - 0.5) * 2 * WIND_UV_MAX;
        const speed = Math.sqrt(u * u + v * v);
        const direction = (270 - (Math.atan2(v, u) * 180) / Math.PI + 360) % 360;
        return { u, v, speed, direction };
    }

    /** أقصى مدى للسرعة (للتطبيع) — يطابق نسق النسيج. */
    get windSpeedMax(): number { return WIND_SPEED_MAX; }
}

export const rasterSampler = new RasterSampler();
