/**
 * ParticleGLLayer.ts
 * محرّك جسيمات الرياح بـ WebGL — أسلوب Zoom Earth/Windy، كـ MapLibre Custom Layer.
 *
 * مبني على تقنية Mapbox "webgl-wind" (Vladimir Agafonkin, MIT)، مُكيَّفة لخريطة
 * متحرّكة: مواضع الجسيمات تُحاكى على الـ GPU في نسيج (ping-pong)، وتُرسم مع ذيول
 * متراكمة في framebuffer، ثم تُسقَط على الشاشة عبر مصفوفة إسقاط الخريطة.
 *
 * كل شيء RGBA8 (لا حاجة لإضافات float) → متوافق وسريع. عشرات الآلاف من الجسيمات بـ 60fps.
 */

import { type CustomLayerInterface, type CustomRenderMethodInput, type Map as MaplibreMap } from 'maplibre-gl';
import type { WeatherGrid } from '../../../services/weatherGridService';
import { type GLContext, createProgram, getLocations, createTexture, createBuffer } from './glUtils';
import { buildValueTexture, WIND_UV_MAX } from './weatherTextures';
import { QUAD_VERT, SCREEN_FRAG, UPDATE_FRAG, DRAW_VERT, DRAW_FRAG } from './particleShaders';
import { computeTrailAlpha } from '../../../config/layerAnimation';

// ── Layer ─────────────────────────────────────────────────────────────────

export interface ParticleSettings {
    speed: number;       // مضاعف سرعة (0..~2)، 1 افتراضي
    trail: number;       // 0..1 طول الذيل
    opacity: number;     // 0..1 سطوع الجسيمات
    density: number;     // 0..1 كثافة (يحدّد عدد الجسيمات)
}

export class ParticleGLLayer implements CustomLayerInterface {
    public readonly id: string;
    public readonly type = 'custom' as const;
    public readonly renderingMode = '2d' as const;

    private map: MaplibreMap | null = null;
    private gl: GLContext | null = null;

    private drawProgram: WebGLProgram | null = null;
    private updateProgram: WebGLProgram | null = null;
    private screenProgram: WebGLProgram | null = null;
    private drawLoc: ReturnType<typeof getLocations> | null = null;
    private updateLoc: ReturnType<typeof getLocations> | null = null;
    private screenLoc: ReturnType<typeof getLocations> | null = null;

    private quadBuffer: WebGLBuffer | null = null;
    private indexBuffer: WebGLBuffer | null = null;
    private framebuffer: WebGLFramebuffer | null = null;

    private windTexture: WebGLTexture | null = null;
    private particleState0: WebGLTexture | null = null;
    private particleState1: WebGLTexture | null = null;
    private screenTex0: WebGLTexture | null = null;
    private screenTex1: WebGLTexture | null = null;
    private screenW = 0;
    private screenH = 0;

    // الحجم الأقصى ثابت دائماً — نرسم منه فقط numDrawn بحسب الزووم
    private particleRes = 320;            // 320² ≈ 102k جسيم (الحجم الأقصى)
    private numParticles = 320 * 320;
    private numDrawn = 320 * 320;         // يتغيّر ديناميكياً في renderInner
    private grid: WeatherGrid | null = null;
    private gridDirty = false;
    private moving = false;

    private settings: ParticleSettings = { speed: 1, trail: 0.95, opacity: 0.85, density: 0.95 };
    private darkMode = true;

    constructor(id: string, settings?: Partial<ParticleSettings>, darkMode = true) {
        this.id = id;
        this.darkMode = darkMode;
        if (settings) this.settings = { ...this.settings, ...settings };
    }

    // ── واجهة عامة ────────────────────────────────────────────────────────────
    setWindGrid(grid: WeatherGrid | null) {
        this.grid = grid;
        this.gridDirty = true;
        this.map?.triggerRepaint();
    }

    setDarkMode(darkMode: boolean) {
        this.darkMode = darkMode;
        this.map?.triggerRepaint();
    }

    setSettings(settings: Partial<ParticleSettings>) {
        this.settings = { ...this.settings, ...settings };
        this.map?.triggerRepaint();
    }

    // ── دورة الحياة ───────────────────────────────────────────────────────────
    onAdd(map: MaplibreMap, gl: GLContext) {
        this.map = map;
        this.gl = gl;

        this.drawProgram = createProgram(gl, DRAW_VERT, DRAW_FRAG);
        this.updateProgram = createProgram(gl, QUAD_VERT, UPDATE_FRAG);
        this.screenProgram = createProgram(gl, QUAD_VERT, SCREEN_FRAG);
        this.drawLoc = getLocations(gl, this.drawProgram, ['a_index'],
            ['u_particles', 'u_wind', 'u_particles_res', 'u_matrix', 'u_bounds', 'u_point_size', 'u_alpha', 'u_color']);
        this.updateLoc = getLocations(gl, this.updateProgram, ['a_pos'],
            ['u_particles', 'u_wind', 'u_rand_seed', 'u_speed', 'u_drop_rate', 'u_drop_rate_bump']);
        this.screenLoc = getLocations(gl, this.screenProgram, ['a_pos'], ['u_screen', 'u_opacity']);

        this.quadBuffer = createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
        this.framebuffer = gl.createFramebuffer();
        this.windTexture = createTexture(gl, 1, 1, new Uint8Array([128, 128, 128, 0]), { filter: gl.LINEAR });

        this.initParticles(gl);
        this.initIndexBuffer(gl);

        // تنظيف الذيول عند بدء الحركة لتفادي التلطيخ (الذيول في فضاء الشاشة)
        this.onMoveStart = () => { this.moving = true; };
        this.onMoveEnd = () => { this.moving = false; };
        map.on('movestart', this.onMoveStart);
        map.on('moveend', this.onMoveEnd);
    }

    onRemove(map: MaplibreMap, gl: GLContext) {
        if (this.onMoveStart) map.off('movestart', this.onMoveStart);
        if (this.onMoveEnd) map.off('moveend', this.onMoveEnd);
        for (const p of [this.drawProgram, this.updateProgram, this.screenProgram]) if (p) gl.deleteProgram(p);
        for (const b of [this.quadBuffer, this.indexBuffer]) if (b) gl.deleteBuffer(b);
        if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
        for (const t of [this.windTexture, this.particleState0, this.particleState1, this.screenTex0, this.screenTex1]) {
            if (t) gl.deleteTexture(t);
        }
        this.map = this.gl = null;
    }

    private onMoveStart?: () => void;
    private onMoveEnd?: () => void;

    private initParticles(gl: GLContext) {
        if (this.particleState0) gl.deleteTexture(this.particleState0);
        if (this.particleState1) gl.deleteTexture(this.particleState1);
        const n = this.particleRes * this.particleRes;
        const state = new Uint8Array(n * 4);
        for (let i = 0; i < state.length; i++) state[i] = Math.floor(Math.random() * 256);
        this.particleState0 = createTexture(gl, this.particleRes, this.particleRes, state, { filter: gl.NEAREST });
        this.particleState1 = createTexture(gl, this.particleRes, this.particleRes, new Uint8Array(state), { filter: gl.NEAREST });
    }

    private initIndexBuffer(gl: GLContext) {
        if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
        const indices = new Float32Array(this.numParticles);
        for (let i = 0; i < this.numParticles; i++) indices[i] = i;
        this.indexBuffer = createBuffer(gl, indices);
    }

    private ensureScreenTextures(gl: GLContext) {
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        if (w === this.screenW && h === this.screenH && this.screenTex0) return;
        this.screenW = w;
        this.screenH = h;
        if (this.screenTex0) gl.deleteTexture(this.screenTex0);
        if (this.screenTex1) gl.deleteTexture(this.screenTex1);
        const empty = new Uint8Array(w * h * 4);
        this.screenTex0 = createTexture(gl, w, h, empty, { filter: gl.NEAREST });
        this.screenTex1 = createTexture(gl, w, h, new Uint8Array(empty), { filter: gl.NEAREST });
    }

    private errorLogged = false;

    // ── الرسم ─────────────────────────────────────────────────────────────────
    render(gl: GLContext, options: CustomRenderMethodInput) {
        try {
            this.renderInner(gl, options);
        } catch (e) {
            if (!this.errorLogged) { console.error(`ParticleGLLayer(${this.id}) render error:`, e); this.errorLogged = true; }
        }
        this.map?.triggerRepaint(); // حركة مستمرة
    }

    private renderInner(gl: GLContext, options: CustomRenderMethodInput) {
        if (!this.grid || !this.drawProgram || !this.updateProgram || !this.screenProgram) return;
        if (!this.framebuffer || !this.windTexture || !this.particleState0 || !this.particleState1) return;

        if (this.gridDirty) {
            const { data, width, height } = buildValueTexture(this.grid);
            gl.bindTexture(gl.TEXTURE_2D, this.windTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
            this.gridDirty = false;
        }

        // حساب عدد الجسيمات المرسومة من الزووم الحالي (zoom in → أكثر، zoom out → أقل)
        const zoom = this.map?.getZoom() ?? 3;
        const zoomT = Math.max(0, Math.min(1, zoom / 10));   // 0 عند zoom=0، 1 عند zoom=10+
        const minCount = Math.round(0.03 * this.numParticles);
        const maxCount = this.numParticles;
        const zoomCount = minCount + (maxCount - minCount) * (zoomT * zoomT);
        this.numDrawn = Math.round(zoomCount * Math.max(0.05, this.settings.density));

        // مهم: MapLibre قد يترك CULL_FACE/DEPTH_TEST مفعّلين فيُقصّ الرباعيات → نعطّلهما.
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);

        this.ensureScreenTextures(gl);
        const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

        // 1) محاكاة: تحديث مواضع الجسيمات إلى particleState1
        this.updateParticles(gl);

        // 2) رسم على نسيج الشاشة (مع ذيول)، إلا أثناء الحركة (نمسح لتفادي التلطيخ)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.screenTex1, 0);
        gl.viewport(0, 0, this.screenW, this.screenH);

        const fade = this.moving ? 0.0 : computeTrailAlpha(this.settings.trail);
        gl.disable(gl.BLEND);
        this.drawScreenTexture(gl, this.screenTex0!, fade);     // خلفية متلاشية
        this.drawParticles(gl, options);                         // الجسيمات فوقها

        // 3) دمج نسيج الشاشة على إطار الخريطة
        gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.drawScreenTexture(gl, this.screenTex1!, 1.0);

        // تبديل (ping-pong)
        [this.particleState0, this.particleState1] = [this.particleState1, this.particleState0];
        [this.screenTex0, this.screenTex1] = [this.screenTex1, this.screenTex0];

        // تنظيف حالة GL حتى لا نفسد رسم MapLibre التالي
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    private updateParticles(gl: GLContext) {
        if (!this.updateProgram || !this.updateLoc || !this.framebuffer) return;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.particleState1, 0);
        gl.viewport(0, 0, this.particleRes, this.particleRes);
        gl.disable(gl.BLEND);

        gl.useProgram(this.updateProgram);
        this.bindAttrib(gl, this.quadBuffer!, this.updateLoc.attributes.a_pos, 2);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.particleState0);
        gl.uniform1i(this.updateLoc.uniforms.u_particles, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.windTexture);
        gl.uniform1i(this.updateLoc.uniforms.u_wind, 1);

        // خطوة ثابتة في فضاء النسيج [0,1] حتى تبدو سرعة الجسيمات متساوية على الشاشة
        // بغضّ النظر عن مستوى الزووم (تقسيم على lngSpan كان يُجمّد الجسيمات عند zoom out).
        const k = 0.0030 * this.settings.speed;
        gl.uniform2f(this.updateLoc.uniforms.u_speed, k, k);
        gl.uniform1f(this.updateLoc.uniforms.u_rand_seed, Math.random());
        gl.uniform1f(this.updateLoc.uniforms.u_drop_rate, 0.003);
        gl.uniform1f(this.updateLoc.uniforms.u_drop_rate_bump, 0.01);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    private drawParticles(gl: GLContext, options: CustomRenderMethodInput) {
        if (!this.drawProgram || !this.drawLoc) return;
        gl.useProgram(this.drawProgram);
        this.bindAttrib(gl, this.indexBuffer!, this.drawLoc.attributes.a_index, 1);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.particleState1);
        gl.uniform1i(this.drawLoc.uniforms.u_particles, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.windTexture);
        gl.uniform1i(this.drawLoc.uniforms.u_wind, 1);

        const b = this.grid!.bounds;
        gl.uniform1f(this.drawLoc.uniforms.u_particles_res, this.particleRes);
        // MapLibre v5: نستخدم mainMatrix لإحداثيات MercatorCoordinate [0..1] (وليس modelViewProjectionMatrix).
        gl.uniformMatrix4fv(this.drawLoc.uniforms.u_matrix, false, new Float32Array(options.defaultProjectionData.mainMatrix as ArrayLike<number>));
        gl.uniform4f(this.drawLoc.uniforms.u_bounds, b.west, b.south, b.east, b.north);
        // حجم أكبر قليلاً (كان 2.1) لتبدو الجسيمات أوضح وأجمل دون مبالغة
        gl.uniform1f(this.drawLoc.uniforms.u_point_size, 3.2);
        gl.uniform1f(this.drawLoc.uniforms.u_alpha, this.settings.opacity);
        // أبيض في الوضع الداكن، أزرق داكن مائل للرمادي في الفاتح (يظهر بوضوح فوق خريطة فاتحة)
        if (this.darkMode) gl.uniform3f(this.drawLoc.uniforms.u_color, 1.0, 1.0, 1.0);
        else gl.uniform3f(this.drawLoc.uniforms.u_color, 0.13, 0.18, 0.28);

        gl.drawArrays(gl.POINTS, 0, this.numDrawn);
    }

    private drawScreenTexture(gl: GLContext, texture: WebGLTexture, opacity: number) {
        if (!this.screenProgram || !this.screenLoc) return;
        gl.useProgram(this.screenProgram);
        this.bindAttrib(gl, this.quadBuffer!, this.screenLoc.attributes.a_pos, 2);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.screenLoc.uniforms.u_screen, 0);
        gl.uniform1f(this.screenLoc.uniforms.u_opacity, opacity);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    private bindAttrib(gl: GLContext, buffer: WebGLBuffer, location: number, size: number) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    }
}
