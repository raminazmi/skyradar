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
uniform float u_opacity;
uniform vec4 u_bounds;          // (west, south, east, north) بالدرجات
const float PI = 3.141592653589793;
void main() {
    float lng = v_merc.x * 360.0 - 180.0;
    float latRad = 2.0 * atan(exp(PI * (1.0 - 2.0 * v_merc.y))) - PI * 0.5;
    float lat = degrees(latRad);
    float u = (lng - u_bounds.x) / (u_bounds.z - u_bounds.x);
    float v = (lat - u_bounds.y) / (u_bounds.w - u_bounds.y);
    if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) discard;
    vec4 cell = texture2D(u_value, vec2(u, v));
    if (cell.a < 0.5) discard;                       // نقطة مفقودة
    vec4 col = texture2D(u_ramp, vec2(cell.r, 0.5)); // premultiplied
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
        this.loc = getLocations(gl, this.program, ['a_pos'], ['u_matrix', 'u_value', 'u_ramp', 'u_opacity', 'u_bounds']);
        this.rampTexture = createTexture(gl, 256, 1, null, { filter: gl.LINEAR });
        this.valueTexture = createTexture(gl, 1, 1, new Uint8Array([0, 0, 0, 0]), { filter: gl.LINEAR });
        this.quadBuffer = gl.createBuffer();
    }

    onRemove(_map: MaplibreMap, gl: GLContext) {
        if (this.program) gl.deleteProgram(this.program);
        if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
        if (this.valueTexture) gl.deleteTexture(this.valueTexture);
        if (this.rampTexture) gl.deleteTexture(this.rampTexture);
        this.program = this.quadBuffer = this.valueTexture = this.rampTexture = null;
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

        bindTexture(gl, this.valueTexture, 0);
        gl.uniform1i(this.loc.uniforms.u_value, 0);
        bindTexture(gl, this.rampTexture, 1);
        gl.uniform1i(this.loc.uniforms.u_ramp, 1);

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
