/**
 * TiledHeatmapGLLayer.ts
 * طبقة Heatmap مُبلّطة (multi-tile) بأسلوب Zoom Earth — MapLibre Custom Layer (WebGL).
 *
 * تحمل مجموعة بلاطات، كلٌّ بنسيج قيمها ورباعيها الخاص. تُرسم البلاطات الجاهزة فقط،
 * فتظهر "مربّعاً مربّعاً" كلّما وصلت بياناتها. الشيدر مطابق لـ HeatmapGLLayer
 * (استيفاء واعٍ بالساحل عبر قناع اليابسة/البحر) لكن مكرَّر لكل بلاطة.
 */

import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MaplibreMap } from 'maplibre-gl';
import type { ForecastGridType } from '../../../config/weatherLayers';
import type { WeatherGrid } from '../../../services/weatherGridService';
import { type GLContext, createProgram, getLocations, createTexture, updateTexture, bindTexture } from './glUtils';
import { buildColorRamp, buildValueTexture } from './weatherTextures';

const VERTEX_SRC = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
varying vec2 v_merc;
void main() {
    v_merc = a_pos;
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`;

// مطابق لشيدر HeatmapGLLayer (قناع ساحلي) — أي تعديل لوني يجب أن يبقى متوافقاً معه.
const FRAGMENT_SRC = `
precision highp float;
varying vec2 v_merc;
uniform sampler2D u_value;
uniform sampler2D u_ramp;
uniform sampler2D u_mask;
uniform float u_useMask;
uniform vec2 u_gridSize;
uniform float u_opacity;
uniform vec4 u_bounds;
const float PI = 3.141592653589793;
float mercV(float latDeg) {
    float lat = radians(latDeg);
    return (1.0 - log(tan(PI * 0.25 + lat * 0.5)) / PI) * 0.5;
}
float isLand(vec2 mercUV) { return texture2D(u_mask, mercUV).r > 0.5 ? 1.0 : 0.0; }

// استيفاء ثنائي ناعم (smoothstep) للقيمة المُطبّعة: يحترم العيّنات المفقودة (A<0.5)
// ويعيد (القيمة، الصلاحية). منحنى Hermite يزيل الوجوه الخطّية → تدرّج أنعم كـ Zoom Earth
// دون أي طلبات API إضافية.
vec2 sampleSmooth(vec2 uv) {
    vec2 gs = u_gridSize;
    vec2 f = uv * gs - 0.5;
    vec2 i0 = floor(f);
    vec2 d = f - i0;
    d = d * d * (3.0 - 2.0 * d);            // Hermite smoothstep على أوزان البلاطة
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

    if (u_useMask < 0.5) {
        vec2 ra = sampleSmooth(vec2(u, v));
        if (ra.y < 0.5) discard;
        gl_FragColor = texture2D(u_ramp, vec2(ra.x, 0.5)) * u_opacity;
        return;
    }
    float pixelLand = isLand(vec2(v_merc.x, v_merc.y));
    vec2 gs = u_gridSize;
    float fx = u * gs.x - 0.5;
    float fy = v * gs.y - 0.5;
    float x0 = floor(fx), y0 = floor(fy);
    float dx = fx - x0, dy = fy - y0;
    dx = dx * dx * (3.0 - 2.0 * dx);        // smoothstep أيضاً في المسار الساحلي
    dy = dy * dy * (3.0 - 2.0 * dy);
    float valSum = 0.0, wSum = 0.0;
    for (int j = 0; j < 2; j++) {
        for (int i = 0; i < 2; i++) {
            vec2 cuv = clamp(vec2((x0 + float(i) + 0.5) / gs.x,
                                  (y0 + float(j) + 0.5) / gs.y), vec2(0.0), vec2(1.0));
            vec4 cell = texture2D(u_value, cuv);
            if (cell.a < 0.5) continue;
            float bw = (i == 0 ? (1.0 - dx) : dx) * (j == 0 ? (1.0 - dy) : dy);
            float sLon = u_bounds.x + cuv.x * (u_bounds.z - u_bounds.x);
            float sLat = u_bounds.y + cuv.y * (u_bounds.w - u_bounds.y);
            float sLand = isLand(vec2((sLon + 180.0) / 360.0, mercV(sLat)));
            float w = bw * ((sLand == pixelLand) ? 1.0 : 0.04);
            valSum += cell.r * w;
            wSum += w;
        }
    }
    if (wSum <= 0.0) discard;
    gl_FragColor = texture2D(u_ramp, vec2(valSum / wSum, 0.5)) * u_opacity;
}`;

const LAT_LIMIT = 85.051129;

interface GpuTile {
    grid: WeatherGrid;
    valueTexture: WebGLTexture;
    quadBuffer: WebGLBuffer;
    cols: number;
    rows: number;
    bounds: { west: number; south: number; east: number; north: number };
}

export class TiledHeatmapGLLayer implements CustomLayerInterface {
    public readonly id: string;
    public readonly type = 'custom' as const;
    public readonly renderingMode = '2d' as const;

    private map: MaplibreMap | null = null;
    private program: WebGLProgram | null = null;
    private loc: ReturnType<typeof getLocations> | null = null;
    private rampTexture: WebGLTexture | null = null;
    private maskTexture: WebGLTexture | null = null;
    private maskReady = false;

    private layerType: ForecastGridType;
    private opacity: number;
    private rampDirty = true;

    /** البلاطات المطلوب عرضها (تُحدَّث من React)؛ تُوفَّق مع GPU داخل render. */
    private desired = new Map<string, WeatherGrid>();
    private gpu = new Map<string, GpuTile>();

    constructor(id: string, layerType: ForecastGridType, opacity = 0.8) {
        this.id = id;
        this.layerType = layerType;
        this.opacity = opacity;
    }

    // ── واجهة عامة ────────────────────────────────────────────────────────────
    setTiles(tiles: { key: string; grid: WeatherGrid }[]) {
        const next = new Map<string, WeatherGrid>();
        for (const t of tiles) next.set(t.key, t.grid);
        this.desired = next;
        this.map?.triggerRepaint();
    }

    setType(layerType: ForecastGridType) {
        if (layerType === this.layerType) return;
        this.layerType = layerType;
        this.rampDirty = true;
        this.desired = new Map();          // ألوان/قيم مختلفة — أفرغ البلاطات القديمة
        this.map?.triggerRepaint();
    }

    setOpacity(opacity: number) {
        this.opacity = opacity;
        this.map?.triggerRepaint();
    }

    // ── دورة الحياة ───────────────────────────────────────────────────────────
    onAdd(map: MaplibreMap, gl: GLContext) {
        this.map = map;
        this.program = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
        this.loc = getLocations(gl, this.program, ['a_pos'],
            ['u_matrix', 'u_value', 'u_ramp', 'u_mask', 'u_useMask', 'u_gridSize', 'u_opacity', 'u_bounds']);
        this.rampTexture = createTexture(gl, 256, 1, null, { filter: gl.LINEAR });
        this.maskTexture = createTexture(gl, 1, 1, new Uint8Array([255, 255, 255, 255]), { filter: gl.LINEAR });
        this.loadMask(gl);
    }

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
            } catch { /* تجاهل */ }
        };
        img.src = `${import.meta.env.BASE_URL}landmask.png`;
    }

    onRemove(_map: MaplibreMap, gl: GLContext) {
        for (const t of this.gpu.values()) { gl.deleteTexture(t.valueTexture); gl.deleteBuffer(t.quadBuffer); }
        this.gpu.clear();
        if (this.program) gl.deleteProgram(this.program);
        if (this.rampTexture) gl.deleteTexture(this.rampTexture);
        if (this.maskTexture) gl.deleteTexture(this.maskTexture);
        this.program = this.rampTexture = this.maskTexture = null;
        this.map = null;
    }

    private errorLogged = false;
    render(gl: GLContext, options: CustomRenderMethodInput) {
        try { this.renderInner(gl, options); }
        catch (e) { if (!this.errorLogged) { console.error(`TiledHeatmapGLLayer(${this.id}) render error:`, e); this.errorLogged = true; } }
    }

    private renderInner(gl: GLContext, options: CustomRenderMethodInput) {
        if (!this.program || !this.loc || !this.rampTexture || !this.maskTexture) return;

        if (this.rampDirty) {
            updateTexture(gl, this.rampTexture, 256, 1, buildColorRamp(this.layerType));
            this.rampDirty = false;
        }
        this.reconcileTiles(gl);
        if (this.gpu.size === 0) return;

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.loc.uniforms.u_matrix, false,
            new Float32Array(options.defaultProjectionData.mainMatrix as ArrayLike<number>));
        gl.uniform1f(this.loc.uniforms.u_opacity, this.opacity);

        const coastalField = this.layerType === 'temperature' || this.layerType === 'feels-like'
            || this.layerType === 'dewpoint' || this.layerType === 'humidity';
        gl.uniform1f(this.loc.uniforms.u_useMask, this.maskReady && coastalField ? 1 : 0);

        bindTexture(gl, this.rampTexture, 1);
        gl.uniform1i(this.loc.uniforms.u_ramp, 1);
        bindTexture(gl, this.maskTexture, 2);
        gl.uniform1i(this.loc.uniforms.u_mask, 2);

        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        for (const tile of this.gpu.values()) {
            const b = tile.bounds;
            gl.uniform4f(this.loc.uniforms.u_bounds, b.west, b.south, b.east, b.north);
            gl.uniform2f(this.loc.uniforms.u_gridSize, tile.cols, tile.rows);
            bindTexture(gl, tile.valueTexture, 0);
            gl.uniform1i(this.loc.uniforms.u_value, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, tile.quadBuffer);
            gl.enableVertexAttribArray(this.loc.attributes.a_pos);
            gl.vertexAttribPointer(this.loc.attributes.a_pos, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
    }

    /** يُنشئ نُسُج البلاطات الجديدة ويحذف غير المطلوبة (يُستدعى داخل render حيث يتوفّر gl). */
    private reconcileTiles(gl: GLContext) {
        // حذف ما لم يَعُد مطلوباً
        for (const [key, tile] of this.gpu) {
            if (!this.desired.has(key)) {
                gl.deleteTexture(tile.valueTexture);
                gl.deleteBuffer(tile.quadBuffer);
                this.gpu.delete(key);
            }
        }
        // إنشاء الجديد
        for (const [key, grid] of this.desired) {
            if (this.gpu.has(key)) continue;
            const built = this.buildTile(gl, grid);
            if (built) this.gpu.set(key, built);
        }
    }

    private buildTile(gl: GLContext, grid: WeatherGrid): GpuTile | null {
        const { data, width, height } = buildValueTexture(grid);
        const valueTexture = createTexture(gl, width, height, data, { filter: gl.LINEAR });

        const b = grid.bounds;
        const north = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, b.north));
        const south = Math.max(-LAT_LIMIT, Math.min(LAT_LIMIT, b.south));
        const nw = MercatorCoordinate.fromLngLat({ lng: b.west, lat: north });
        const ne = MercatorCoordinate.fromLngLat({ lng: b.east, lat: north });
        const sw = MercatorCoordinate.fromLngLat({ lng: b.west, lat: south });
        const se = MercatorCoordinate.fromLngLat({ lng: b.east, lat: south });
        const verts = new Float32Array([nw.x, nw.y, sw.x, sw.y, ne.x, ne.y, se.x, se.y]);
        const quadBuffer = gl.createBuffer();
        if (!quadBuffer) { gl.deleteTexture(valueTexture); return null; }
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

        return { grid, valueTexture, quadBuffer, cols: grid.cols, rows: grid.rows, bounds: b };
    }
}
