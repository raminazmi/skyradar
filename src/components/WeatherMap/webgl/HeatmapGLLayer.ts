/**
 * HeatmapGLLayer.ts
 * طبقة Heatmap للطقس بأسلوب Zoom Earth — مبنية كـ MapLibre Custom Layer (WebGL).
 *
 * لماذا Custom Layer؟ لأننا نرسم داخل سياق WebGL الخاص بالخريطة وبمصفوفة
 * إسقاطها، فتتزامن الطبقة تلقائياً مع كل pan/zoom دون أي حِيَل CSS transform.
 *
 * المبدأ:
 *   - نرفع قيم الشبكة كنسيج (texture)، والـ GPU يستوفيها خطّياً → حقل لوني ناعم.
 *   - نحوّل القيمة إلى لون عبر شريط ألوان (ramp) مبني من colorScales.ts نفسه
 *     → تطابق لوني تام مع تصميم Zoom Earth الحالي.
 *   - لكل بكسل نحسب الإحداثي الجغرافي من مركاتور (في الـ shader) لنطابق شبكة
 *     lat/lon بدقة حتى عند العرض الواسع.
 */

import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MaplibreMap } from 'maplibre-gl';
import type { ForecastGridType } from '../../../config/weatherLayers';
import type { WeatherGrid } from '../../../services/weatherGridService';
import {
    type GLContext,
    createProgram,
    getLocations,
    createTexture,
    updateTexture,
    bindTexture,
} from './glUtils';
import { buildColorRamp, buildValueTexture } from './weatherTextures';

const VERTEX_SRC = `
attribute vec2 a_pos;          // إحداثيات مركاتور [0..1]
uniform mat4 u_matrix;
varying vec2 v_merc;
void main() {
    v_merc = a_pos;
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT_SRC = `
precision highp float;
varying vec2 v_merc;
uniform sampler2D u_value;      // قيمة الشبكة المُطبّعة (R) + صلاحية (A)
uniform sampler2D u_ramp;       // شريط الألوان 256×1 (premultiplied)
uniform sampler2D u_mask;       // قناع يابسة/بحر بإسقاط مركاتور (R: يابسة>0.5)
uniform float u_useMask;        // 1 = كسر الاستيفاء عند الساحل (حافة حادّة)
uniform vec2 u_gridSize;        // (cols, rows) لشبكة القيم
uniform float u_opacity;
uniform vec4 u_bounds;          // (west, south, east, north) بالدرجات
const float PI = 3.141592653589793;

// mercator v (0=شمال أعلى .. 1=جنوب) لخط عرض معطى — لمطابقة عيّنة القناع.
float mercV(float latDeg) {
    float lat = radians(latDeg);
    return (1.0 - log(tan(PI * 0.25 + lat * 0.5)) / PI) * 0.5;
}
float isLand(vec2 mercUV) {
    return texture2D(u_mask, mercUV).r > 0.5 ? 1.0 : 0.0;
}

// استيفاء ثنائي ناعم (Hermite smoothstep) للقيمة المُطبّعة مع احترام العيّنات المفقودة.
vec2 sampleSmooth(vec2 uv) {
    vec2 gs = u_gridSize;
    vec2 f = uv * gs - 0.5;
    vec2 i0 = floor(f);
    vec2 d = f - i0;
    d = d * d * (3.0 - 2.0 * d);
    float rSum = 0.0, wSum = 0.0;
    for (int j = 0; j < 2; j++) {
        for (int i = 0; i < 2; i++) {
            vec2 cuv = clamp((i0 + vec2(float(i), float(j)) + 0.5) / gs, vec2(0.0), vec2(1.0));
            vec4 cell = texture2D(u_value, cuv);
            if (cell.a < 0.5) continue;
            float w = (i == 0 ? (1.0 - d.x) : d.x) * (j == 0 ? (1.0 - d.y) : d.y);
            rSum += cell.r * w; wSum += w;
        }
    }
    return vec2(wSum > 0.0 ? rSum / wSum : 0.0, wSum > 0.0 ? 1.0 : 0.0);
}

void main() {
    float lng = v_merc.x * 360.0 - 180.0;
    float latRad = 2.0 * atan(exp(PI * (1.0 - 2.0 * v_merc.y))) - PI * 0.5;
    float lat = degrees(latRad);
    float u = (lng - u_bounds.x) / (u_bounds.z - u_bounds.x);
    float v = (lat - u_bounds.y) / (u_bounds.w - u_bounds.y);
    if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) discard;

    // المسار البسيط: استيفاء ناعم (smoothstep) بلا قناع.
    if (u_useMask < 0.5) {
        vec2 ra = sampleSmooth(vec2(u, v));
        if (ra.y < 0.5) discard;                         // نقطة مفقودة
        vec4 col = texture2D(u_ramp, vec2(ra.x, 0.5));   // premultiplied
        gl_FragColor = col * u_opacity;
        return;
    }

    // المسار الواعي بالساحل: استيفاء ثنائي يدوي يُضعِّف العيّنات المخالفة لنوع
    // البكسل (يابسة/بحر) فينكسر الحقل اللوني عند خطّ الساحل بحافة حادّة كـ Zoom Earth.
    float pixelLand = isLand(vec2(v_merc.x, v_merc.y));
    vec2 gs = u_gridSize;
    float fx = u * gs.x - 0.5;
    float fy = v * gs.y - 0.5;
    float x0 = floor(fx), y0 = floor(fy);
    float dx = fx - x0, dy = fy - y0;
    dx = dx * dx * (3.0 - 2.0 * dx);        // smoothstep في المسار الساحلي
    dy = dy * dy * (3.0 - 2.0 * dy);

    float valSum = 0.0, wSum = 0.0;
    for (int j = 0; j < 2; j++) {
        for (int i = 0; i < 2; i++) {
            vec2 cuv = clamp(vec2((x0 + float(i) + 0.5) / gs.x,
                                  (y0 + float(j) + 0.5) / gs.y), vec2(0.0), vec2(1.0));
            vec4 cell = texture2D(u_value, cuv);
            if (cell.a < 0.5) continue;                  // عيّنة مفقودة
            float bw = (i == 0 ? (1.0 - dx) : dx) * (j == 0 ? (1.0 - dy) : dy);
            float sLon = u_bounds.x + cuv.x * (u_bounds.z - u_bounds.x);
            float sLat = u_bounds.y + cuv.y * (u_bounds.w - u_bounds.y);
            float sLand = isLand(vec2((sLon + 180.0) / 360.0, mercV(sLat)));
            float typeW = (sLand == pixelLand) ? 1.0 : 0.04; // المخالف يكاد يُلغى
            float w = bw * typeW;
            valSum += cell.r * w;
            wSum += w;
        }
    }
    if (wSum <= 0.0) discard;
    vec4 col = texture2D(u_ramp, vec2(valSum / wSum, 0.5));
    gl_FragColor = col * u_opacity;
}`;

const LAT_LIMIT = 85.051129; // حدّ مركاتور لتفادي اللانهاية عند القطبين

export class HeatmapGLLayer implements CustomLayerInterface {
    public readonly id: string;
    public readonly type = 'custom' as const;
    public readonly renderingMode = '2d' as const;

    private map: MaplibreMap | null = null;
    private program: WebGLProgram | null = null;
    private loc: ReturnType<typeof getLocations> | null = null;

    private quadBuffer: WebGLBuffer | null = null;
    private valueTexture: WebGLTexture | null = null;
    private rampTexture: WebGLTexture | null = null;
    private maskTexture: WebGLTexture | null = null;
    private maskReady = false;

    private grid: WeatherGrid | null = null;
    private layerType: ForecastGridType;
    private opacity: number;
    private rampDirty = true;
    private gridDirty = false;

    constructor(id: string, layerType: ForecastGridType, opacity = 0.8) {
        this.id = id;
        this.layerType = layerType;
        this.opacity = opacity;
    }

    // ── واجهة عامة يستدعيها مكوّن React ───────────────────────────────────────
    setGrid(grid: WeatherGrid | null) {
        this.grid = grid;
        this.gridDirty = true;
        this.map?.triggerRepaint();
    }

    setType(layerType: ForecastGridType) {
        if (layerType === this.layerType) return;
        this.layerType = layerType;
        this.rampDirty = true;
        this.map?.triggerRepaint();
    }

    setOpacity(opacity: number) {
        this.opacity = opacity;
        this.map?.triggerRepaint();
    }

    // ── دورة حياة الطبقة ──────────────────────────────────────────────────────
    onAdd(map: MaplibreMap, gl: GLContext) {
        this.map = map;
        this.program = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
        this.loc = getLocations(gl, this.program, ['a_pos'],
            ['u_matrix', 'u_value', 'u_ramp', 'u_mask', 'u_useMask', 'u_gridSize', 'u_opacity', 'u_bounds']);
        this.rampTexture = createTexture(gl, 256, 1, null, { filter: gl.LINEAR });
        this.valueTexture = createTexture(gl, 1, 1, new Uint8Array([0, 0, 0, 0]), { filter: gl.LINEAR });
        // قناع مبدئي 1×1 "يابسة" حتى يصل القناع الحقيقي (سلوك = استيفاء عادي).
        this.maskTexture = createTexture(gl, 1, 1, new Uint8Array([255, 255, 255, 255]), { filter: gl.LINEAR });
        this.loadMask(gl);
        this.quadBuffer = gl.createBuffer();
    }

    /** يحمّل قناع اليابسة/البحر (mercator PNG) إلى نسيج، ويُفعّل كسر الاستيفاء عند الساحل. */
    private loadMask(gl: GLContext) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (!this.maskTexture) return;
            try {
                gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                this.maskReady = true;
                this.map?.triggerRepaint();
            } catch { /* تجاهل: نبقى على الاستيفاء العادي */ }
        };
        img.src = `${import.meta.env.BASE_URL}landmask.png`;
    }

    onRemove(_map: MaplibreMap, gl: GLContext) {
        if (this.program) gl.deleteProgram(this.program);
        if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
        if (this.valueTexture) gl.deleteTexture(this.valueTexture);
        if (this.rampTexture) gl.deleteTexture(this.rampTexture);
        if (this.maskTexture) gl.deleteTexture(this.maskTexture);
        this.program = this.quadBuffer = this.valueTexture = this.rampTexture = this.maskTexture = null;
        this.map = null;
    }

    private errorLogged = false;

    render(gl: GLContext, options: CustomRenderMethodInput) {
        try {
            this.renderInner(gl, options);
        } catch (e) {
            if (!this.errorLogged) { console.error(`HeatmapGLLayer(${this.id}) render error:`, e); this.errorLogged = true; }
        }
    }

    private renderInner(gl: GLContext, options: CustomRenderMethodInput) {
        if (!this.program || !this.loc || !this.grid || !this.valueTexture || !this.rampTexture) return;

        if (this.rampDirty) {
            updateTexture(gl, this.rampTexture, 256, 1, buildColorRamp(this.layerType));
            this.rampDirty = false;
        }
        if (this.gridDirty) {
            this.uploadGrid(gl);
            this.gridDirty = false;
        }
        if (!this.quadBuffer) return;

        gl.useProgram(this.program);
        // MapLibre v5: للطبقات المخصّصة المرسومة بإحداثيات MercatorCoordinate [0..1]
        // نستخدم mainMatrix (هي التي تُسقط الإحداثيات المركاتورية إلى فضاء القصّ)،
        // وليس modelViewProjectionMatrix التي تتوقّع إحداثيات "world space".
        gl.uniformMatrix4fv(this.loc.uniforms.u_matrix, false, new Float32Array(options.defaultProjectionData.mainMatrix as ArrayLike<number>));

        const b = this.grid.bounds;
        gl.uniform4f(this.loc.uniforms.u_bounds, b.west, b.south, b.east, b.north);
        gl.uniform1f(this.loc.uniforms.u_opacity, this.opacity);
        gl.uniform2f(this.loc.uniforms.u_gridSize, this.grid.cols, this.grid.rows);
        // القناع يُفعَّل فقط للحقول السطحية المرتبطة بنوع السطح (حرارة/إحساس/ندى/رطوبة)؛
        // الأمطار/الغيوم/الضغط تعبر السواحل فيزيائياً فلا يجوز كسرها عندها.
        const coastalField = this.layerType === 'temperature' || this.layerType === 'feels-like'
            || this.layerType === 'dewpoint' || this.layerType === 'humidity';
        gl.uniform1f(this.loc.uniforms.u_useMask, this.maskReady && coastalField ? 1 : 0);

        bindTexture(gl, this.valueTexture, 0);
        gl.uniform1i(this.loc.uniforms.u_value, 0);
        bindTexture(gl, this.rampTexture, 1);
        gl.uniform1i(this.loc.uniforms.u_ramp, 1);
        bindTexture(gl, this.maskTexture!, 2);
        gl.uniform1i(this.loc.uniforms.u_mask, 2);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(this.loc.attributes.a_pos);
        gl.vertexAttribPointer(this.loc.attributes.a_pos, 2, gl.FLOAT, false, 0, 0);

        // مهم: MapLibre قد يترك CULL_FACE/DEPTH_TEST مفعّلين فيُقصّ الرباعي → نعطّلهما.
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied (وضع MapLibre)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ── رفع بيانات الشبكة إلى الـ GPU ─────────────────────────────────────────
    private uploadGrid(gl: GLContext) {
        if (!this.grid || !this.valueTexture || !this.quadBuffer) return;

        // 1) نسيج القيم
        const { data, width, height } = buildValueTexture(this.grid);
        updateTexture(gl, this.valueTexture, width, height, data);

        // 2) رباعي يغطّي حدود الشبكة بإحداثيات مركاتور
        const b = this.grid.bounds;
        const north = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, b.north));
        const south = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, b.south));
        const nw = MercatorCoordinate.fromLngLat({ lng: b.west, lat: north });
        const ne = MercatorCoordinate.fromLngLat({ lng: b.east, lat: north });
        const sw = MercatorCoordinate.fromLngLat({ lng: b.west, lat: south });
        const se = MercatorCoordinate.fromLngLat({ lng: b.east, lat: south });

        // ترتيب TRIANGLE_STRIP: NW, SW, NE, SE
        const verts = new Float32Array([
            nw.x, nw.y,
            sw.x, sw.y,
            ne.x, ne.y,
            se.x, se.y,
        ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    }
}
