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
// يدعم الاستيفاء الزمني: يأخذ القيمة المنعّمة من إطارين (u_value, u_value2) ويمزجهما بـ u_blend
// قبل تمريرها لشريط الألوان — حركة ناعمة بين الساعات مثل Zoom Earth، بلا بيانات جديدة.
const FRAGMENT_SRC = `
precision highp float;
varying vec2 v_merc;
uniform sampler2D u_value;
uniform sampler2D u_value2;
uniform sampler2D u_ramp;
uniform sampler2D u_mask;
uniform float u_useMask;
uniform float u_blend;
uniform vec2 u_gridSize;
uniform float u_opacity;
uniform vec4 u_bounds;
const float PI = 3.141592653589793;
const float SMOOTH_SIGMA2 = 1.1;
float mercV(float latDeg){ float lat=radians(latDeg); return (1.0 - log(tan(PI*0.25+lat*0.5))/PI)*0.5; }
float isLand(vec2 m){ return texture2D(u_mask, m).r > 0.5 ? 1.0 : 0.0; }

// القيمة المنعّمة لإطار واحد عند (uv). يعيد سالباً لو لا وزن (يُستخدم للتجاهل).
float smoothVal(sampler2D tex, vec2 uv, vec2 gs, vec2 texel, float pixelLand) {
    if (u_useMask < 0.5) {
        float vs = 0.0, ws = 0.0;
        for (int j=-1;j<=1;j++){ for (int i=-1;i<=1;i++){
            float w = exp(-0.5 * float(i*i + j*j) / SMOOTH_SIGMA2);
            vec2 cuv = clamp(uv + vec2(float(i),float(j))*texel, vec2(0.0), vec2(1.0));
            vs += texture2D(tex, cuv).r * w; ws += w;
        }}
        return vs / ws;
    }
    float sx = uv.x*gs.x, sy = uv.y*gs.y;
    float cx0 = floor(sx - 0.5), cy0 = floor(sy - 0.5);
    float valSum = 0.0, wSum = 0.0;
    for (int j=-1;j<=2;j++){ for (int i=-1;i<=2;i++){
        float cx = cx0 + float(i), cy = cy0 + float(j);
        float dxk = sx - (cx + 0.5), dyk = sy - (cy + 0.5);
        float gw = exp(-0.5 * (dxk*dxk + dyk*dyk) / SMOOTH_SIGMA2);
        vec2 cuv = clamp(vec2((cx+0.5)/gs.x,(cy+0.5)/gs.y), vec2(0.0), vec2(1.0));
        float sLon = u_bounds.x + cuv.x*(u_bounds.z-u_bounds.x);
        float sLat = u_bounds.y + cuv.y*(u_bounds.w-u_bounds.y);
        float w = gw * ((isLand(vec2((sLon+180.0)/360.0, mercV(sLat))) == pixelLand) ? 1.0 : 0.04);
        valSum += texture2D(tex, cuv).r * w; wSum += w;
    }}
    return wSum > 0.0 ? valSum / wSum : -1.0;
}

void main() {
    // الطول يُلَفّ لنسخة العالم الواحدة (fract) فتظهر الطبقة في كل النسخ المكرّرة أثناء التحريك.
    float u = fract(v_merc.x);
    float latRad = 2.0 * atan(exp(PI * (1.0 - 2.0 * v_merc.y))) - PI * 0.5;
    float lat = degrees(latRad);
    float v = (lat - u_bounds.y) / (u_bounds.w - u_bounds.y);
    if (v < 0.0 || v > 1.0) discard;              // خط العرض فقط (الطول ملفوف)
    vec2 gs = u_gridSize;
    vec2 texel = 1.0 / gs;
    float pixelLand = isLand(vec2(u, v_merc.y));   // قناع البرّ ملفوف كذلك

    float a = smoothVal(u_value, vec2(u,v), gs, texel, pixelLand);
    if (a < 0.0) discard;
    float val = a;
    if (u_blend > 0.001) {                         // مزج زمني مع الإطار التالي
        float b = smoothVal(u_value2, vec2(u,v), gs, texel, pixelLand);
        if (b >= 0.0) val = mix(a, b, u_blend);
    }
    gl_FragColor = texture2D(u_ramp, vec2(val, 0.5)) * u_opacity;
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
    private valueTexture2: WebGLTexture | null = null;   // الإطار التالي (للاستيفاء الزمني)
    private rampTexture: WebGLTexture | null = null;
    private maskTexture: WebGLTexture | null = null;
    private maskReady = false;
    private valueReady = false;
    private valueReady2 = false;
    private destroyed = false;
    private valueSize: [number, number] = [1440, 721];

    private layerType: ForecastGridType;
    private opacity: number;
    private url: string;
    private url2 = '';
    private blend = 0;
    private rampDirty = true;

    constructor(id: string, layerType: ForecastGridType, url: string, opacity = 0.9) {
        this.id = id;
        this.layerType = layerType;
        this.url = url;
        this.opacity = opacity;
    }

    setUrl(url: string) {
        if (url === this.url) return;
        // تقدّم الشريط: الإطار "التالي" صار الحالي — نبدّل النسيجين على الـ GPU مباشرة
        // بدل إعادة تنزيل/فكّ الصورة نفسها (يلغي وميض/كلفة كل خطوة تشغيل).
        if (url === this.url2 && this.valueReady2 && this.valueTexture && this.valueTexture2) {
            [this.valueTexture, this.valueTexture2] = [this.valueTexture2, this.valueTexture];
            this.valueReady = true;
            this.valueReady2 = false;
            this.url = url;
            this.url2 = '';
            this.map?.triggerRepaint();
            return;
        }
        this.url = url;
        if (this.map) this.loadValue(this.mapGL());
    }
    // الإطار التالي ونسبة المزج للاستيفاء الزمني. blend=0 → الإطار الحالي فقط.
    setNextUrl(url: string) {
        if (url === this.url2) return;
        this.url2 = url;
        if (this.map && url) this.loadValue2(this.mapGL());
    }
    setBlend(b: number) { const nb = Math.max(0, Math.min(1, b)); if (nb !== this.blend) { this.blend = nb; this.map?.triggerRepaint(); } }
    setType(t: ForecastGridType) { if (t !== this.layerType) { this.layerType = t; this.rampDirty = true; this.map?.triggerRepaint(); } }
    setOpacity(o: number) { this.opacity = o; this.map?.triggerRepaint(); }

    private glRef: GLContext | null = null;
    private mapGL(): GLContext { return this.glRef!; }

    onAdd(map: MaplibreMap, gl: GLContext) {
        this.map = map;
        this.glRef = gl;
        this.program = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
        this.loc = getLocations(gl, this.program, ['a_pos'],
            ['u_matrix', 'u_value', 'u_value2', 'u_ramp', 'u_mask', 'u_useMask', 'u_blend', 'u_gridSize', 'u_opacity', 'u_bounds']);
        this.rampTexture = createTexture(gl, 256, 1, null, { filter: gl.LINEAR });
        this.valueTexture = createTexture(gl, 1, 1, new Uint8Array([0, 0, 0, 0]), { filter: gl.LINEAR });
        this.valueTexture2 = createTexture(gl, 1, 1, new Uint8Array([0, 0, 0, 0]), { filter: gl.LINEAR });
        this.maskTexture = createTexture(gl, 1, 1, new Uint8Array([255, 255, 255, 255]), { filter: gl.LINEAR });

        // رباعي يغطّي عدّة نسخ عالم أفقياً (مركاتور x من -N إلى 1+N) كي تظهر الطبقة في كل
        // النسخ المكرّرة (renderWorldCopies) أثناء التحريك بلا فراغات. الطول يُلَفّ في الشيدر
        // (fract) فتُعاد عيّنة النسيج العالمي لكل نسخة. y من نسخة واحدة (خط العرض لا يتكرّر).
        const yN = MercatorCoordinate.fromLngLat({ lng: 0, lat: LAT_LIMIT }).y;
        const yS = MercatorCoordinate.fromLngLat({ lng: 0, lat: -LAT_LIMIT }).y;
        const N = 3;                       // 3 نسخ لكل جانب (7 إجمالاً) تكفي حتى أدنى تكبير
        const x0 = -N, x1 = 1 + N;
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, yN, x0, yS, x1, yN, x1, yS]), gl.STATIC_DRAW);

        this.loadImageInto(gl, this.maskTexture, `${import.meta.env.BASE_URL}landmask.png`, () => { this.maskReady = true; });
        this.loadValue(gl);
        if (this.url2) this.loadValue2(gl);
    }

    private loadValue(gl: GLContext) {
        if (!this.valueTexture) return;
        this.loadImageInto(gl, this.valueTexture, this.url, (w, h) => { this.valueReady = true; this.valueSize = [w, h]; });
    }

    private loadValue2(gl: GLContext) {
        if (!this.valueTexture2 || !this.url2) return;
        this.valueReady2 = false;
        this.loadImageInto(gl, this.valueTexture2, this.url2, () => { this.valueReady2 = true; });
    }

    private loadImageInto(gl: GLContext, tex: WebGLTexture, src: string, onReady: (w: number, h: number) => void, retries = 2) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        // فشل الشبكة العابر (قطع تدفّق HTTP/2 على الاستضافة المشتركة) — نعيد المحاولة بمهلة.
        img.onerror = () => {
            if (this.destroyed || retries <= 0) return;
            window.setTimeout(() => {
                if (!this.destroyed) this.loadImageInto(gl, tex, src, onReady, retries - 1);
            }, 1200);
        };
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
        if (this.valueTexture2) gl.deleteTexture(this.valueTexture2);
        if (this.rampTexture) gl.deleteTexture(this.rampTexture);
        if (this.maskTexture) gl.deleteTexture(this.maskTexture);
        this.program = this.quadBuffer = this.valueTexture = this.valueTexture2 = this.rampTexture = this.maskTexture = null;
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
            || this.layerType === 'wet-bulb'
            || this.layerType === 'dewpoint' || this.layerType === 'humidity';
        gl.uniform1f(this.loc.uniforms.u_useMask, this.maskReady && coastal ? 1 : 0);
        // نمزج مع الإطار التالي فقط حين يكون جاهزاً ونسبة المزج > 0 (وإلا الإطار الحالي وحده).
        const blend = (this.valueReady2 && this.blend > 0.001) ? this.blend : 0;
        gl.uniform1f(this.loc.uniforms.u_blend, blend);

        bindTexture(gl, this.valueTexture!, 0); gl.uniform1i(this.loc.uniforms.u_value, 0);
        bindTexture(gl, this.rampTexture, 1); gl.uniform1i(this.loc.uniforms.u_ramp, 1);
        bindTexture(gl, this.maskTexture!, 2); gl.uniform1i(this.loc.uniforms.u_mask, 2);
        bindTexture(gl, this.valueTexture2!, 3); gl.uniform1i(this.loc.uniforms.u_value2, 3);

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
