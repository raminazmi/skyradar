/**
 * RasterHeatmapGLLayer.ts
 * طبقة Heatmap من نسيج عالمي خام (GFS GRIB2 → PNG رمادي 1440×721، قيمة مُطبّعة) —
 * بدقّة 0.25° كاملة مثل Zoom Earth، بلا أي طلبات نقاط لـ Open-Meteo.
 *
 * الشيدر مطابق لـ HeatmapGLLayer (شريط ألوان + قناع ساحلي)، لكن مصدر القيم صورة عالمية
 * واحدة بدل شبكة نقاط. الحدود ثابتة عالمياً، والصفّ 0 من الصورة = الجنوب (يطابق v=0).
 */

import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MaplibreMap } from 'maplibre-gl';
import type { ForecastGridType } from '../../../config/weatherLayers';
import { type GLContext, createProgram, getLocations, createTexture, updateTexture, bindTexture } from './glUtils';
import { buildColorRamp } from './weatherTextures';

const VERTEX_SRC = `
attribute vec2 a_pos;
uniform mat4 u_matrix;
varying vec2 v_merc;
void main() { v_merc = a_pos; gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }`;

// مطابق لشيدر HeatmapGLLayer (قناع ساحلي) — أي تعديل لوني يبقى متوافقاً معه.
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
float mercV(float latDeg){ float lat=radians(latDeg); return (1.0 - log(tan(PI*0.25+lat*0.5))/PI)*0.5; }
float isLand(vec2 m){ return texture2D(u_mask, m).r > 0.5 ? 1.0 : 0.0; }
void main() {
    float lng = v_merc.x * 360.0 - 180.0;
    float latRad = 2.0 * atan(exp(PI * (1.0 - 2.0 * v_merc.y))) - PI * 0.5;
    float lat = degrees(latRad);
    float u = (lng - u_bounds.x) / (u_bounds.z - u_bounds.x);
    float v = (lat - u_bounds.y) / (u_bounds.w - u_bounds.y);
    if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) discard;
    if (u_useMask < 0.5) {
        gl_FragColor = texture2D(u_ramp, vec2(texture2D(u_value, vec2(u, v)).r, 0.5)) * u_opacity;
        return;
    }
    float pixelLand = isLand(vec2(v_merc.x, v_merc.y));
    vec2 gs = u_gridSize;
    float fx = u*gs.x - 0.5, fy = v*gs.y - 0.5;
    float x0 = floor(fx), y0 = floor(fy);
    float dx = fx - x0, dy = fy - y0;
    float valSum = 0.0, wSum = 0.0;
    for (int j=0;j<2;j++){ for (int i=0;i<2;i++){
        vec2 cuv = clamp(vec2((x0+float(i)+0.5)/gs.x,(y0+float(j)+0.5)/gs.y), vec2(0.0), vec2(1.0));
        float bw = (i==0?(1.0-dx):dx) * (j==0?(1.0-dy):dy);
        float sLon = u_bounds.x + cuv.x*(u_bounds.z-u_bounds.x);
        float sLat = u_bounds.y + cuv.y*(u_bounds.w-u_bounds.y);
        float w = bw * ((isLand(vec2((sLon+180.0)/360.0, mercV(sLat))) == pixelLand) ? 1.0 : 0.04);
        valSum += texture2D(u_value, cuv).r * w; wSum += w;
    }}
    if (wSum <= 0.0) discard;
    gl_FragColor = texture2D(u_ramp, vec2(valSum/wSum, 0.5)) * u_opacity;
}`;

const LAT_LIMIT = 85.051129;

export class RasterHeatmapGLLayer implements CustomLayerInterface {
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
    private valueReady = false;
    private destroyed = false;
    private valueSize: [number, number] = [1440, 721];

    private layerType: ForecastGridType;
    private opacity: number;
    private url: string;
    private rampDirty = true;

    constructor(id: string, layerType: ForecastGridType, url: string, opacity = 0.9) {
        this.id = id;
        this.layerType = layerType;
        this.url = url;
        this.opacity = opacity;
    }

    setUrl(url: string) { if (url !== this.url) { this.url = url; if (this.map) this.loadValue(this.mapGL()); } }
    setType(t: ForecastGridType) { if (t !== this.layerType) { this.layerType = t; this.rampDirty = true; this.map?.triggerRepaint(); } }
    setOpacity(o: number) { this.opacity = o; this.map?.triggerRepaint(); }

    private glRef: GLContext | null = null;
    private mapGL(): GLContext { return this.glRef!; }

    onAdd(map: MaplibreMap, gl: GLContext) {
        this.map = map;
        this.glRef = gl;
        this.program = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
        this.loc = getLocations(gl, this.program, ['a_pos'],
            ['u_matrix', 'u_value', 'u_ramp', 'u_mask', 'u_useMask', 'u_gridSize', 'u_opacity', 'u_bounds']);
        this.rampTexture = createTexture(gl, 256, 1, null, { filter: gl.LINEAR });
        this.valueTexture = createTexture(gl, 1, 1, new Uint8Array([0, 0, 0, 0]), { filter: gl.LINEAR });
        this.maskTexture = createTexture(gl, 1, 1, new Uint8Array([255, 255, 255, 255]), { filter: gl.LINEAR });

        // رباعي عالمي (مقصوص لحدّ مركاتور عند القطبين)
        const nw = MercatorCoordinate.fromLngLat({ lng: -180, lat: LAT_LIMIT });
        const ne = MercatorCoordinate.fromLngLat({ lng: 180, lat: LAT_LIMIT });
        const sw = MercatorCoordinate.fromLngLat({ lng: -180, lat: -LAT_LIMIT });
        const se = MercatorCoordinate.fromLngLat({ lng: 180, lat: -LAT_LIMIT });
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([nw.x, nw.y, sw.x, sw.y, ne.x, ne.y, se.x, se.y]), gl.STATIC_DRAW);

        this.loadImageInto(gl, this.maskTexture, `${import.meta.env.BASE_URL}landmask.png`, () => { this.maskReady = true; });
        this.loadValue(gl);
    }

    private loadValue(gl: GLContext) {
        if (!this.valueTexture) return;
        this.loadImageInto(gl, this.valueTexture, this.url, (w, h) => { this.valueReady = true; this.valueSize = [w, h]; });
    }

    private loadImageInto(gl: GLContext, tex: WebGLTexture, src: string, onReady: (w: number, h: number) => void) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // قد تصل الصورة بعد إزالة الطبقة (سباق StrictMode/تبديل سريع) — والنسيج
            // حينها محذوف؛ الربط به يرمي INVALID_OPERATION. نتحقّق قبل أي استخدام.
            if (this.destroyed) return;
            try {
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                onReady(img.naturalWidth, img.naturalHeight);
                this.map?.triggerRepaint();
            } catch { /* تجاهل */ }
        };
        img.src = src;
    }

    onRemove(_map: MaplibreMap, gl: GLContext) {
        this.destroyed = true;
        if (this.program) gl.deleteProgram(this.program);
        if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
        if (this.valueTexture) gl.deleteTexture(this.valueTexture);
        if (this.rampTexture) gl.deleteTexture(this.rampTexture);
        if (this.maskTexture) gl.deleteTexture(this.maskTexture);
        this.program = this.quadBuffer = this.valueTexture = this.rampTexture = this.maskTexture = null;
        this.map = this.glRef = null;
    }

    private errorLogged = false;
    render(gl: GLContext, options: CustomRenderMethodInput) {
        try { this.renderInner(gl, options); }
        catch (e) { if (!this.errorLogged) { console.error(`RasterHeatmapGLLayer(${this.id}) render error:`, e); this.errorLogged = true; } }
    }

    private renderInner(gl: GLContext, options: CustomRenderMethodInput) {
        if (!this.program || !this.loc || !this.valueReady || !this.quadBuffer || !this.rampTexture) return;
        if (this.rampDirty) { updateTexture(gl, this.rampTexture, 256, 1, buildColorRamp(this.layerType)); this.rampDirty = false; }

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.loc.uniforms.u_matrix, false, new Float32Array(options.defaultProjectionData.mainMatrix as ArrayLike<number>));
        gl.uniform4f(this.loc.uniforms.u_bounds, -180, -90, 180, 90);
        gl.uniform2f(this.loc.uniforms.u_gridSize, this.valueSize[0], this.valueSize[1]);
        gl.uniform1f(this.loc.uniforms.u_opacity, this.opacity);
        const coastal = this.layerType === 'temperature' || this.layerType === 'feels-like'
            || this.layerType === 'dewpoint' || this.layerType === 'humidity';
        gl.uniform1f(this.loc.uniforms.u_useMask, this.maskReady && coastal ? 1 : 0);

        bindTexture(gl, this.valueTexture!, 0); gl.uniform1i(this.loc.uniforms.u_value, 0);
        bindTexture(gl, this.rampTexture, 1); gl.uniform1i(this.loc.uniforms.u_ramp, 1);
        bindTexture(gl, this.maskTexture!, 2); gl.uniform1i(this.loc.uniforms.u_mask, 2);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(this.loc.attributes.a_pos);
        gl.vertexAttribPointer(this.loc.attributes.a_pos, 2, gl.FLOAT, false, 0, 0);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
